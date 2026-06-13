"use strict";

const mongoose = require("mongoose");
const Redis = require("ioredis");
const { BaseService } = require("../../shared/base/BaseService");
const { tenantContext } = require("../../shared/context/tenant-context");
const {
  LeadSummaryRepository,
  SalesSummaryRepository,
  CommissionSummaryRepository,
  TaskSummaryRepository,
  LeadMonthlySummaryRepository,
  SalesMonthlySummaryRepository,
  CommissionMonthlySummaryRepository,
  AgentPerformanceSummaryRepository,
} = require("./analytics.repository");
const { ValidationError } = require("../../shared/errors");

// ---------------------------------------------------------------------------
// AnalyticsService
//
// Responsibilities:
//   1. Event-Driven Ingestion   — updateSummaryFrom<Domain>Event() methods
//      update BOTH daily summary buckets AND monthly rollup buckets AND
//      agent performance buckets atomically.
//   2. Dashboard Queries        — getDashboard<Domain>() reads pre-computed
//      summary collections and returns chart-ready JSON.
//   3. Cache Layer              — Redis-backed distributed TTL cache with a
//      graceful in-process Map fallback when Redis is unreachable.
//      Cache keys are role-, branch-, and agent-scoped to prevent cross-
//      boundary data leakage.
//   4. Export Trigger           — enqueueExport() pushes a BullMQ job for
//      async PDF/CSV generation by the export worker.
//
// Security:
//   - getLeadAnalytics / getSalesAnalytics etc. call _buildBranchMatch()
//     which locks branch-restricted roles to their own branchId BEFORE the
//     cache key is computed, so cache keys are always permission-accurate.
//   - Agent performance endpoint enforces that agents can only see their own
//     agentId performance metrics.
// ---------------------------------------------------------------------------

// ── MAX_RANGE_DAYS guard ───────────────────────────────────────────────────
const MAX_RANGE_DAYS = 366;

// ── Redis-backed TTL cache with in-process Map fallback ───────────────────

class RedisCache {
  /**
   * @param {object} opts
   * @param {number} opts.ttlSeconds  Redis key TTL in seconds (default 60)
   * @param {string} [opts.prefix]    Key namespace prefix (default 'analytics')
   */
  constructor({ ttlSeconds = 60, prefix = "analytics" } = {}) {
    this._ttl = ttlSeconds;
    this._prefix = prefix;
    this._redis = null;
    this._mem = new Map(); // fallback only

    // Lazy-connect — never crash the server if Redis is down at startup
    try {
      const { loadEnv } = require("../../config/env.config");
      const env = loadEnv();
      this._redis = new Redis({
        host: env.REDIS_HOST || "localhost",
        port: env.REDIS_PORT || 6379,
        password: env.REDIS_PASSWORD || undefined,
        db: env.REDIS_DB || 0,
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
      });
      this._redis.on("error", (err) => {
        // Degrade gracefully to in-process fallback without crashing
        console.warn(
          "[RedisCache] Redis unavailable, falling back to in-process cache:",
          err.message,
        );
      });
    } catch {
      this._redis = null;
    }
  }

  _fullKey(key) {
    return `${this._prefix}:${key}`;
  }

  async get(key) {
    const fullKey = this._fullKey(key);
    // Try Redis first
    if (this._redis && this._redis.status === "ready") {
      try {
        const raw = await this._redis.get(fullKey);
        return raw ? JSON.parse(raw) : null;
      } catch {
        /* fall through to in-process */
      }
    }
    // In-process Map fallback
    const entry = this._mem.get(fullKey);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this._mem.delete(fullKey);
      return null;
    }
    return entry.value;
  }

  async set(key, value) {
    const fullKey = this._fullKey(key);
    if (this._redis && this._redis.status === "ready") {
      try {
        await this._redis.set(fullKey, JSON.stringify(value), "EX", this._ttl);
        return;
      } catch {
        /* fall through */
      }
    }
    this._mem.set(fullKey, { value, expiresAt: Date.now() + this._ttl * 1000 });
  }

  async del(key) {
    const fullKey = this._fullKey(key);
    if (this._redis && this._redis.status === "ready") {
      try {
        await this._redis.del(fullKey);
      } catch {
        /* ignore */
      }
    }
    this._mem.delete(fullKey);
  }

  /**
   * Invalidate all keys matching a pattern — use Redis SCAN to avoid KEYS.
   * Falls back to clearing the entire in-process Map.
   * @param {string} pattern  e.g. 'analytics:org:abc:*'
   */
  async clearPattern(pattern) {
    if (this._redis && this._redis.status === "ready") {
      try {
        const fullPattern = this._fullKey(pattern);
        let cursor = "0";
        do {
          const [nextCursor, keys] = await this._redis.scan(
            cursor,
            "MATCH",
            fullPattern,
            "COUNT",
            100,
          );
          if (keys.length) await this._redis.del(...keys);
          cursor = nextCursor;
        } while (cursor !== "0");
        return;
      } catch {
        /* fall through */
      }
    }
    // Fallback: clear the entire local map (safe for single-instance dev)
    this._mem.clear();
  }
}

// ── Shared cache singleton ─────────────────────────────────────────────────
const _cache = new RedisCache({ ttlSeconds: 60 });

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Normalise a JS Date to midnight UTC to act as the daily bucket key.
 */
function toDateBucket(d) {
  const dt = new Date(d);
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
}

/**
 * Normalise a JS Date to the 1st day of the month at midnight UTC,
 * used as the monthly rollup bucket key.
 */
function toMonthBucket(d) {
  const dt = new Date(d);
  dt.setUTCDate(1);
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
}

/**
 * Parse and validate a date range from query params.
 * Defaults to last 30 days.
 * Maximum window is MAX_RANGE_DAYS (366 days).
 *
 * @param {string} [startDate]
 * @param {string} [endDate]
 * @returns {{ start: Date, end: Date }}
 */
function parseDateRange(startDate, endDate) {
  const end = endDate ? toDateBucket(endDate) : toDateBucket(new Date());
  const start = startDate
    ? toDateBucket(startDate)
    : new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);

  if (start > end) {
    throw new ValidationError("startDate must be before or equal to endDate");
  }

  const diffDays = (end - start) / (1000 * 60 * 60 * 24);
  if (diffDays > MAX_RANGE_DAYS) {
    throw new ValidationError(
      `Date range cannot exceed ${MAX_RANGE_DAYS} days. Requested: ${Math.ceil(diffDays)} days.`,
    );
  }

  return { start, end };
}

/**
 * Build a role-, branch-, and agent-aware cache key that prevents cross-
 * boundary cache hits between different roles/branches/agents.
 *
 * @param {string}   domain      e.g. 'lead', 'sales', 'commission', 'tasks'
 * @param {object}   actor       { organizationId, role, branchId?, id }
 * @param {Date}     start
 * @param {Date}     end
 * @param {object}   [extra]     extra filter tokens (branchId override, projectId, source…)
 */
function buildCacheKey(domain, actor, start, end, extra = {}) {
  const BRANCH_RESTRICTED = ["branch_manager", "agent", "team_leader"];

  // Effective branchId: locked roles always use their own branch
  const effectiveBranch = BRANCH_RESTRICTED.includes(actor.role)
    ? actor.branchId || "none"
    : extra.branchId || "all";

  // Agents have personal scope; include actorId so two agents don't share a key
  const agentScope = actor.role === "agent" ? actor.id : "shared";

  const tokens = [
    `org:${actor.organizationId}`,
    `role:${actor.role}`,
    `branch:${effectiveBranch}`,
    `agent:${agentScope}`,
    `${start.toISOString()}:${end.toISOString()}`,
    ...Object.entries(extra)
      .filter(([k]) => k !== "branchId") // already included above
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v || "all"}`),
  ];

  return `${domain}:${tokens.join(":")}`;
}

// ── Main Service ───────────────────────────────────────────────────────────

class AnalyticsService extends BaseService {
  constructor(deps = {}) {
    super(deps);
    this.leadSummaryRepo = deps.leadSummaryRepo || new LeadSummaryRepository();
    this.salesSummaryRepo =
      deps.salesSummaryRepo || new SalesSummaryRepository();
    this.commissionSummaryRepo =
      deps.commissionSummaryRepo || new CommissionSummaryRepository();
    this.taskSummaryRepo = deps.taskSummaryRepo || new TaskSummaryRepository();
    this.leadMonthlyRepo =
      deps.leadMonthlyRepo || new LeadMonthlySummaryRepository();
    this.salesMonthlyRepo =
      deps.salesMonthlyRepo || new SalesMonthlySummaryRepository();
    this.commissionMonthlyRepo =
      deps.commissionMonthlyRepo || new CommissionMonthlySummaryRepository();
    this.agentPerformanceRepo =
      deps.agentPerformanceRepo || new AgentPerformanceSummaryRepository();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. EVENT-DRIVEN INGESTION
  //    Each method writes to: daily summary + monthly rollup + agent summary.
  // ──────────────────────────────────────────────────────────────────────────

  async updateFromLeadEvent(payload) {
    try {
      const {
        organizationId,
        branchId = null,
        agentId = null,
        source = "unknown",
        status = "new",
        holdValue = 0,
        leadCountDelta = 1,
        agentDeltas = null,
      } = payload;

      const orgId = new mongoose.Types.ObjectId(organizationId);
      const brId = branchId ? new mongoose.Types.ObjectId(branchId) : null;
      const today = toDateBucket(new Date());
      const thisMonth = toMonthBucket(new Date());

      const dailyFilter = {
        organizationId: orgId,
        branchId: brId,
        date: today,
        source,
        status,
      };
      const monthFilter = {
        organizationId: orgId,
        branchId: brId,
        date: thisMonth,
        source,
        status,
      };
      const inc = { leadCount: leadCountDelta, totalHoldValue: holdValue || 0 };

      await Promise.all([
        this.leadSummaryRepo.upsertSummary(dailyFilter, inc),
        this.leadMonthlyRepo.upsertSummary(monthFilter, inc),
      ]);

      // Agent performance bucket
      if (agentId && agentDeltas) {
        const agentId_ = new mongoose.Types.ObjectId(agentId);
        const agentFilter = {
          organizationId: orgId,
          branchId: brId,
          agentId: agentId_,
          date: today,
        };
        await this.agentPerformanceRepo.upsertSummary(agentFilter, agentDeltas);
      }

      await _cache.clearPattern(`org:${organizationId}:*`);
    } catch (err) {
      console.error(
        "[AnalyticsService] updateFromLeadEvent error:",
        err.message,
      );
    }
  }

  async updateFromDealEvent(payload) {
    try {
      const {
        organizationId,
        branchId = null,
        agentId = null,
        projectId = null,
        dealValue = 0,
        isReservation = false,
        dealCountDelta = 1,
        reservationBounced = false,
        agentDeltas = null,
      } = payload;

      const orgId = new mongoose.Types.ObjectId(organizationId);
      const brId = branchId ? new mongoose.Types.ObjectId(branchId) : null;
      const projId = projectId ? new mongoose.Types.ObjectId(projectId) : null;
      const today = toDateBucket(new Date());
      const thisMonth = toMonthBucket(new Date());

      const dailyFilter = {
        organizationId: orgId,
        branchId: brId,
        date: today,
        projectId: projId,
      };
      const monthFilter = {
        organizationId: orgId,
        branchId: brId,
        date: thisMonth,
        projectId: projId,
      };

      const inc = {
        dealsClosedCount: dealCountDelta,
        grossDealValue: dealValue || 0,
      };
      if (isReservation) inc.reservationsCount = 1;
      if (reservationBounced) inc.reservationsBouncedCount = 1;

      await Promise.all([
        this.salesSummaryRepo.upsertSummary(dailyFilter, inc),
        this.salesMonthlyRepo.upsertSummary(monthFilter, inc),
      ]);

      // Agent performance bucket
      if (agentId && agentDeltas) {
        const agentId_ = new mongoose.Types.ObjectId(agentId);
        const agentFilter = {
          organizationId: orgId,
          branchId: brId,
          agentId: agentId_,
          date: today,
        };
        await this.agentPerformanceRepo.upsertSummary(agentFilter, agentDeltas);
      }

      await _cache.clearPattern(`org:${organizationId}:*`);
    } catch (err) {
      console.error(
        "[AnalyticsService] updateFromDealEvent error:",
        err.message,
      );
    }
  }

  async updateFromCommissionEvent(payload) {
    try {
      const {
        organizationId,
        branchId = null,
        expectedRevenue = 0,
        collectedRevenue = 0,
        outstandingRevenue = 0,
        adjustmentDeductions = 0,
        totalChequesPending = 0,
        totalChequesBounced = 0,
        totalChequesIssued = 0,
      } = payload;

      const orgId = new mongoose.Types.ObjectId(organizationId);
      const brId = branchId ? new mongoose.Types.ObjectId(branchId) : null;
      const today = toDateBucket(new Date());
      const thisMonth = toMonthBucket(new Date());

      const dailyFilter = {
        organizationId: orgId,
        branchId: brId,
        date: today,
      };
      const monthFilter = {
        organizationId: orgId,
        branchId: brId,
        date: thisMonth,
      };
      const inc = {
        expectedRevenue,
        collectedRevenue,
        outstandingRevenue,
        adjustmentDeductions,
        totalChequesPending,
        totalChequesBounced,
        totalChequesIssued,
      };

      await Promise.all([
        this.commissionSummaryRepo.upsertSummary(dailyFilter, inc),
        this.commissionMonthlyRepo.upsertSummary(monthFilter, inc),
      ]);

      await _cache.clearPattern(`org:${organizationId}:*`);
    } catch (err) {
      console.error(
        "[AnalyticsService] updateFromCommissionEvent error:",
        err.message,
      );
    }
  }

  async updateFromTaskEvent(payload) {
    try {
      const {
        organizationId,
        branchId = null,
        agentId = null,
        tasksCompletedDelta = 0,
        tasksPendingDelta = 0,
        slaViolationsDelta = 0,
        agentDeltas = null,
      } = payload;

      const orgId = new mongoose.Types.ObjectId(organizationId);
      const brId = branchId ? new mongoose.Types.ObjectId(branchId) : null;
      const today = toDateBucket(new Date());

      const dailyFilter = {
        organizationId: orgId,
        branchId: brId,
        date: today,
      };
      const inc = {
        tasksCompleted: tasksCompletedDelta,
        tasksPending: tasksPendingDelta,
        slaViolations: slaViolationsDelta,
      };

      await this.taskSummaryRepo.upsertSummary(dailyFilter, inc);

      if (agentId && agentDeltas) {
        const agentId_ = new mongoose.Types.ObjectId(agentId);
        const agentFilter = {
          organizationId: orgId,
          branchId: brId,
          agentId: agentId_,
          date: today,
        };
        await this.agentPerformanceRepo.upsertSummary(agentFilter, agentDeltas);
      }

      await _cache.clearPattern(`org:${organizationId}:*`);
    } catch (err) {
      console.error(
        "[AnalyticsService] updateFromTaskEvent error:",
        err.message,
      );
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. DASHBOARD QUERIES
  //    Read from pre-computed summary collections. Cache-first, then DB.
  //    All queries enforce tenant isolation via repository.queryRange().
  //    For ranges > 60 days the service automatically uses monthly rollups.
  // ──────────────────────────────────────────────────────────────────────────

  async getLeadAnalytics(params = {}, actor) {
    const { start, end } = parseDateRange(params.startDate, params.endDate);
    const cacheKey = buildCacheKey("lead", actor, start, end, {
      branchId: params.branchId,
      source: params.source,
    });

    const cached = await _cache.get(cacheKey);
    if (cached) return cached;

    const match = this._buildBranchMatch(actor, params.branchId);
    if (params.source) match.source = params.source;

    const useMonthly = this._shouldUseMonthly(start, end);
    const rows = useMonthly
      ? await this.leadMonthlyRepo.queryRange(match, start, end)
      : await this.leadSummaryRepo.queryRange(match, start, end);

    const result = this._buildLeadDashboard(rows, start, end);

    await _cache.set(cacheKey, result);
    return result;
  }

  async getSalesAnalytics(params = {}, actor) {
    const { start, end } = parseDateRange(params.startDate, params.endDate);
    const cacheKey = buildCacheKey("sales", actor, start, end, {
      branchId: params.branchId,
      projectId: params.projectId,
    });

    const cached = await _cache.get(cacheKey);
    if (cached) return cached;

    const match = this._buildBranchMatch(actor, params.branchId);
    if (params.projectId && params.projectId !== "all" && mongoose.Types.ObjectId.isValid(params.projectId))
      match.projectId = new mongoose.Types.ObjectId(params.projectId);

    const useMonthly = this._shouldUseMonthly(start, end);
    const rows = useMonthly
      ? await this.salesMonthlyRepo.queryRange(match, start, end)
      : await this.salesSummaryRepo.queryRange(match, start, end);

    const result = this._buildSalesDashboard(rows, start, end);

    await _cache.set(cacheKey, result);
    return result;
  }

  async getCommissionAnalytics(params = {}, actor) {
    const { start, end } = parseDateRange(params.startDate, params.endDate);
    const cacheKey = buildCacheKey("commission", actor, start, end, {
      branchId: params.branchId,
    });

    const cached = await _cache.get(cacheKey);
    if (cached) return cached;

    const match = this._buildBranchMatch(actor, params.branchId);

    const useMonthly = this._shouldUseMonthly(start, end);
    const rows = useMonthly
      ? await this.commissionMonthlyRepo.queryRange(match, start, end)
      : await this.commissionSummaryRepo.queryRange(match, start, end);

    const result = this._buildCommissionDashboard(rows, start, end);

    await _cache.set(cacheKey, result);
    return result;
  }

  async getTaskAnalytics(params = {}, actor) {
    const { start, end } = parseDateRange(params.startDate, params.endDate);
    const cacheKey = buildCacheKey("tasks", actor, start, end, {
      branchId: params.branchId,
    });

    const cached = await _cache.get(cacheKey);
    if (cached) return cached;

    const match = this._buildBranchMatch(actor, params.branchId);
    const rows = await this.taskSummaryRepo.queryRange(match, start, end);
    const result = this._buildTaskDashboard(rows, start, end);

    await _cache.set(cacheKey, result);
    return result;
  }

  async getExecutiveSummary(params = {}, actor) {
    const { start, end } = parseDateRange(params.startDate, params.endDate);
    const cacheKey = buildCacheKey("exec", actor, start, end, {
      branchId: params.branchId,
    });

    const cached = await _cache.get(cacheKey);
    if (cached) return cached;

    const match = this._buildBranchMatch(actor, params.branchId);
    const useMonthly = this._shouldUseMonthly(start, end);

    const [leadRows, salesRows, commissionRows, taskRows] = await Promise.all([
      useMonthly
        ? this.leadMonthlyRepo.queryRange(match, start, end)
        : this.leadSummaryRepo.queryRange(match, start, end),
      useMonthly
        ? this.salesMonthlyRepo.queryRange(match, start, end)
        : this.salesSummaryRepo.queryRange(match, start, end),
      useMonthly
        ? this.commissionMonthlyRepo.queryRange(match, start, end)
        : this.commissionSummaryRepo.queryRange(match, start, end),
      this.taskSummaryRepo.queryRange(match, start, end),
    ]);

    const result = {
      period: { startDate: start, endDate: end },
      leads: this._sumLeads(leadRows),
      sales: this._sumSales(salesRows),
      commission: this._sumCommission(commissionRows),
      tasks: this._sumTasks(taskRows),
    };

    await _cache.set(cacheKey, result);
    return result;
  }

  /**
   * Return agent performance metrics for a given agent or all agents in scope.
   *
   * @param {object} params — { startDate?, endDate?, agentId?, branchId? }
   * @param {object} actor
   */
  async getAgentPerformance(params = {}, actor) {
    const { start, end } = parseDateRange(params.startDate, params.endDate);

    // Agents can only query their own performance
    const scopedAgentId =
      actor.role === "agent" ? actor.id : params.agentId || null;

    const cacheKey = buildCacheKey("agent", actor, start, end, {
      branchId: params.branchId,
      agentId: scopedAgentId,
    });

    const cached = await _cache.get(cacheKey);
    if (cached) return cached;

    const match = this._buildBranchMatch(actor, params.branchId);
    if (scopedAgentId && scopedAgentId !== "all" && mongoose.Types.ObjectId.isValid(scopedAgentId))
      match.agentId = new mongoose.Types.ObjectId(scopedAgentId);

    const rows = await this.agentPerformanceRepo.queryRange(match, start, end);
    const result = this._buildAgentDashboard(rows, start, end);

    await _cache.set(cacheKey, result);
    return result;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. EXPORT TRIGGER
  // ──────────────────────────────────────────────────────────────────────────

  async enqueueExport(params, actor) {
    const { pdfQueue } = require("../../queues/queue-manager");
    const { start, end } = parseDateRange(params.startDate, params.endDate);

    const jobPayload = {
      reportType: params.reportType,
      format: params.format || "pdf",
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      branchId: params.branchId || null,
      filters: params.filters || {},
      requestedBy: actor.id,
      organizationId: actor.organizationId,
    };

    const job = await pdfQueue().add("export-report", jobPayload, {
      attempts: 2,
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 100 },
    });

    return { jobId: job.id };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE — Branch/Tenant isolation helpers
  // ──────────────────────────────────────────────────────────────────────────

  _buildBranchMatch(actor, requestedBranchId) {
    const branchRestrictedRoles = ["branch_manager", "agent", "team_leader"];

    if (branchRestrictedRoles.includes(actor.role) && actor.branchId) {
      if (mongoose.Types.ObjectId.isValid(actor.branchId)) {
        return { branchId: new mongoose.Types.ObjectId(actor.branchId) };
      }
    }

    if (requestedBranchId && requestedBranchId !== "all") {
      if (mongoose.Types.ObjectId.isValid(requestedBranchId)) {
        return { branchId: new mongoose.Types.ObjectId(requestedBranchId) };
      }
    }

    return {};
  }

  /**
   * Automatically use monthly rollup collections when the query window
   * exceeds 60 days, avoiding excessive daily-document scans.
   */
  _shouldUseMonthly(start, end) {
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);
    return diffDays > 60;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE — Dashboard builders
  // ──────────────────────────────────────────────────────────────────────────

  _buildLeadDashboard(rows, start, end) {
    const totals = this._sumLeads(rows);
    const timeSeries = rows.map((r) => ({
      date: r._id.date,
      source: r._id.source,
      status: r._id.status,
      leadCount: r.leadCount,
      totalHoldValue: r.totalHoldValue,
    }));

    const bySource = this._groupBy(
      rows,
      (r) => r._id.source,
      { leadCount: 0 },
      (acc, r) => {
        acc.leadCount += r.leadCount;
      },
    );
    const byStatus = this._groupBy(
      rows,
      (r) => r._id.status,
      { leadCount: 0 },
      (acc, r) => {
        acc.leadCount += r.leadCount;
      },
    );

    return {
      period: { startDate: start, endDate: end },
      totals,
      timeSeries,
      bySource: Object.entries(bySource).map(([source, v]) => ({
        source,
        ...v,
      })),
      byStatus: Object.entries(byStatus).map(([status, v]) => ({
        status,
        ...v,
      })),
    };
  }

  _buildSalesDashboard(rows, start, end) {
    const totals = this._sumSales(rows);
    const timeSeries = rows.map((r) => ({
      date: r._id.date,
      projectId: r._id.projectId,
      dealsClosedCount: r.dealsClosedCount,
      grossDealValue: r.grossDealValue,
      reservationsCount: r.reservationsCount,
      reservationsBouncedCount: r.reservationsBouncedCount,
    }));

    const byProject = this._groupBy(
      rows,
      (r) => String(r._id.projectId || "unknown"),
      { dealsClosedCount: 0, grossDealValue: 0 },
      (acc, r) => {
        acc.dealsClosedCount += r.dealsClosedCount;
        acc.grossDealValue += r.grossDealValue;
      },
    );

    return {
      period: { startDate: start, endDate: end },
      totals,
      timeSeries,
      byProject: Object.entries(byProject).map(([projectId, v]) => ({
        projectId,
        ...v,
      })),
    };
  }

  _buildCommissionDashboard(rows, start, end) {
    const totals = this._sumCommission(rows);
    const timeSeries = rows.map((r) => ({
      date: r._id.date,
      branchId: r._id.branchId,
      expectedRevenue: r.expectedRevenue,
      collectedRevenue: r.collectedRevenue,
      outstandingRevenue: r.outstandingRevenue,
      adjustmentDeductions: r.adjustmentDeductions,
      totalChequesPending: r.totalChequesPending,
      totalChequesBounced: r.totalChequesBounced,
    }));

    // Collection efficiency: collected / expected
    const collectionEfficiency =
      totals.expectedRevenue > 0
        ? +((totals.collectedRevenue / totals.expectedRevenue) * 100).toFixed(2)
        : 0;

    // Bounce rate fix: bounced / (issued = cleared + bounced)
    // totalChequesIssued tracks all cheques ever recorded (cleared + pending + bounced)
    const totalIssued = totals.totalChequesIssued || 0;
    const bounceRate =
      totalIssued > 0
        ? +((totals.totalChequesBounced / totalIssued) * 100).toFixed(2)
        : 0;

    return {
      period: { startDate: start, endDate: end },
      totals,
      timeSeries,
      kpis: {
        collectionEfficiencyPct: collectionEfficiency,
        bounceRate,
      },
    };
  }

  _buildTaskDashboard(rows, start, end) {
    const totals = this._sumTasks(rows);
    const timeSeries = rows.map((r) => ({
      date: r._id.date,
      branchId: r._id.branchId,
      tasksCompleted: r.tasksCompleted,
      tasksPending: r.tasksPending,
      slaViolations: r.slaViolations,
    }));

    const totalTasks = totals.tasksCompleted + totals.tasksPending;
    const completionRate =
      totalTasks > 0
        ? +((totals.tasksCompleted / totalTasks) * 100).toFixed(2)
        : 0;

    return {
      period: { startDate: start, endDate: end },
      totals,
      timeSeries,
      kpis: {
        completionRatePct: completionRate,
        slaViolationRate:
          totalTasks > 0
            ? +((totals.slaViolations / totalTasks) * 100).toFixed(2)
            : 0,
      },
    };
  }

  _buildAgentDashboard(rows, start, end) {
    const byAgent = this._groupBy(
      rows,
      (r) => String(r._id.agentId),
      {
        leadsCreatedCount: 0,
        leadsWonCount: 0,
        leadsLostCount: 0,
        dealsClosedCount: 0,
        grossDealValue: 0,
        tasksCompleted: 0,
        tasksPending: 0,
      },
      (acc, r) => {
        acc.leadsCreatedCount += r.leadsCreatedCount || 0;
        acc.leadsWonCount += r.leadsWonCount || 0;
        acc.leadsLostCount += r.leadsLostCount || 0;
        acc.dealsClosedCount += r.dealsClosedCount || 0;
        acc.grossDealValue += r.grossDealValue || 0;
        acc.tasksCompleted += r.tasksCompleted || 0;
        acc.tasksPending += r.tasksPending || 0;
      },
    );

    return {
      period: { startDate: start, endDate: end },
      byAgent: Object.entries(byAgent).map(([agentId, v]) => {
        const conversionRate =
          v.leadsCreatedCount > 0
            ? +((v.leadsWonCount / v.leadsCreatedCount) * 100).toFixed(2)
            : 0;
        return { agentId, ...v, conversionRatePct: conversionRate };
      }),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE — Numeric reducers
  // ──────────────────────────────────────────────────────────────────────────

  _sumLeads(rows) {
    return rows.reduce(
      (acc, r) => {
        acc.leadCount += r.leadCount || 0;
        acc.totalHoldValue += r.totalHoldValue || 0;
        return acc;
      },
      { leadCount: 0, totalHoldValue: 0 },
    );
  }

  _sumSales(rows) {
    return rows.reduce(
      (acc, r) => {
        acc.dealsClosedCount += r.dealsClosedCount || 0;
        acc.grossDealValue += r.grossDealValue || 0;
        acc.reservationsCount += r.reservationsCount || 0;
        acc.reservationsBouncedCount += r.reservationsBouncedCount || 0;
        return acc;
      },
      {
        dealsClosedCount: 0,
        grossDealValue: 0,
        reservationsCount: 0,
        reservationsBouncedCount: 0,
      },
    );
  }

  _sumCommission(rows) {
    return rows.reduce(
      (acc, r) => {
        acc.expectedRevenue += r.expectedRevenue || 0;
        acc.collectedRevenue += r.collectedRevenue || 0;
        acc.outstandingRevenue += r.outstandingRevenue || 0;
        acc.adjustmentDeductions += r.adjustmentDeductions || 0;
        acc.totalChequesPending += r.totalChequesPending || 0;
        acc.totalChequesBounced += r.totalChequesBounced || 0;
        acc.totalChequesIssued += r.totalChequesIssued || 0;
        return acc;
      },
      {
        expectedRevenue: 0,
        collectedRevenue: 0,
        outstandingRevenue: 0,
        adjustmentDeductions: 0,
        totalChequesPending: 0,
        totalChequesBounced: 0,
        totalChequesIssued: 0,
      },
    );
  }

  _sumTasks(rows) {
    return rows.reduce(
      (acc, r) => {
        acc.tasksCompleted += r.tasksCompleted || 0;
        acc.tasksPending += r.tasksPending || 0;
        acc.slaViolations += r.slaViolations || 0;
        return acc;
      },
      { tasksCompleted: 0, tasksPending: 0, slaViolations: 0 },
    );
  }

  _groupBy(rows, keyFn, zeroAcc, reduceFn) {
    const map = {};
    for (const row of rows) {
      const key = keyFn(row);
      if (!map[key]) map[key] = { ...zeroAcc };
      reduceFn(map[key], row);
    }
    return map;
  }
}

module.exports = { AnalyticsService };
