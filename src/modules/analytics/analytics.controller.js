'use strict';

const fs = require('fs');
const path = require('path');
const { AnalyticsService } = require('./analytics.service');

// ---------------------------------------------------------------------------
// AnalyticsController
//
// Thin HTTP adapter — parses query params, calls AnalyticsService, returns JSON.
//
// Routes handled (all under /analytics):
//   GET  /leads                — Lead funnel & source analytics
//   GET  /sales                — Sales funnel & deal value analytics
//   GET  /commission           — Finance & commission collection analytics
//   GET  /tasks                — Task compliance & SLA analytics
//   GET  /executive            — Executive summary (all domains)
//   POST /export               — Enqueue async PDF/CSV export
//   GET  /export/:jobId/status — Poll BullMQ export job status
//   GET  /export/:jobId/download — Stream completed report file
// ---------------------------------------------------------------------------

const analyticsService = new AnalyticsService();

// ── Helper: extract pagination / date params ───────────────────────────────

function extractParams(query) {
  const {
    startDate,
    endDate,
    branchId,
    projectId,
    agentId,
    source,
    format,
    reportType,
  } = query;

  return { startDate, endDate, branchId, projectId, agentId, source, format, reportType };
}

// ── Lead Analytics ─────────────────────────────────────────────────────────

/**
 * GET /analytics/leads
 * Access: admin, finance, branch_manager, team_leader, agent
 */
async function getLeadAnalytics(request, reply) {
  const actor = request.user;
  const params = extractParams(request.query);
  const data = await analyticsService.getLeadAnalytics(params, actor);
  return reply.send({ success: true, data });
}

// ── Sales Analytics ────────────────────────────────────────────────────────

/**
 * GET /analytics/sales
 * Access: admin, finance, branch_manager, team_leader
 */
async function getSalesAnalytics(request, reply) {
  const actor = request.user;
  const params = extractParams(request.query);
  const data = await analyticsService.getSalesAnalytics(params, actor);
  return reply.send({ success: true, data });
}

// ── Commission Analytics ───────────────────────────────────────────────────

/**
 * GET /analytics/commission
 * Access: admin, finance only
 */
async function getCommissionAnalytics(request, reply) {
  const actor = request.user;
  const params = extractParams(request.query);
  const data = await analyticsService.getCommissionAnalytics(params, actor);
  return reply.send({ success: true, data });
}

// ── Task Analytics ─────────────────────────────────────────────────────────

/**
 * GET /analytics/tasks
 * Access: admin, finance, branch_manager, team_leader
 */
async function getTaskAnalytics(request, reply) {
  const actor = request.user;
  const params = extractParams(request.query);
  const data = await analyticsService.getTaskAnalytics(params, actor);
  return reply.send({ success: true, data });
}

// ── Executive Summary ──────────────────────────────────────────────────────

/**
 * GET /analytics/executive
 * Access: admin, finance only
 */
async function getExecutiveSummary(request, reply) {
  const actor = request.user;
  const params = extractParams(request.query);
  const data = await analyticsService.getExecutiveSummary(params, actor);
  return reply.send({ success: true, data });
}

// ── Agent Performance Analytics ────────────────────────────────────────────

/**
 * GET /analytics/agents
 * Access: admin, finance, branch_manager — agents see only their own data
 */
async function getAgentPerformance(request, reply) {
  const actor = request.user;
  const params = extractParams(request.query);
  const data = await analyticsService.getAgentPerformance(params, actor);
  return reply.send({ success: true, data });
}

// ── Export: Enqueue ────────────────────────────────────────────────────────

/**
 * POST /analytics/export
 * Body: { reportType, format, startDate, endDate, branchId?, filters? }
 * Access: admin, finance
 */
async function enqueueExport(request, reply) {
  const actor = request.user;
  const { reportType, format, startDate, endDate, branchId, filters } = request.body;

  const result = await analyticsService.enqueueExport(
    { reportType, format, startDate, endDate, branchId, filters },
    actor,
  );

  return reply.code(202).send({
    success: true,
    message: 'Export job queued. Use the jobId to poll for completion.',
    jobId: result.jobId,
    pollUrl: `/analytics/export/${result.jobId}/status`,
  });
}

// ── Export: Job Status ─────────────────────────────────────────────────────

/**
 * GET /analytics/export/:jobId/status
 * Returns the current BullMQ job state.
 * Access: admin, finance
 */
async function getExportStatus(request, reply) {
  const { jobId } = request.params;
  const { pdfQueue } = require('../../queues/queue-manager');

  const job = await pdfQueue().getJob(jobId);
  if (!job) {
    return reply.code(404).send({ success: false, message: 'Export job not found.' });
  }

  const state = await job.getState();
  const result = job.returnvalue || null;

  return reply.send({
    success: true,
    jobId,
    state,          // 'waiting' | 'active' | 'completed' | 'failed' | 'delayed'
    progress: job.progress,
    failedReason: job.failedReason || null,
    downloadUrl: state === 'completed' && result ? `/analytics/export/${jobId}/download` : null,
  });
}

// ── Export: Download File ──────────────────────────────────────────────────

/**
 * GET /analytics/export/:jobId/download
 * Streams the generated report file.
 * Access: admin, finance
 */
async function downloadExport(request, reply) {
  const { jobId } = request.params;
  const { pdfQueue } = require('../../queues/queue-manager');

  const job = await pdfQueue().getJob(jobId);
  if (!job) {
    return reply.code(404).send({ success: false, message: 'Export job not found.' });
  }

  const state = await job.getState();
  if (state !== 'completed' || !job.returnvalue?.filePath) {
    return reply.code(409).send({
      success: false,
      message: `Export is not ready yet. Current state: ${state}`,
    });
  }

  const { filePath, mimeType, filename } = job.returnvalue;

  // Verify file exists on disk
  if (!fs.existsSync(filePath)) {
    return reply.code(410).send({ success: false, message: 'Export file has expired or been removed.' });
  }

  const fileStream = fs.createReadStream(filePath);
  reply.header('Content-Type', mimeType);
  reply.header('Content-Disposition', `attachment; filename="${filename}"`);
  return reply.send(fileStream);
}

async function getBrokerDashboard(request, reply) {
  const actor = request.user;
  const params = extractParams(request.query);
  const data = await analyticsService.getBrokerExecutiveDashboard(params, actor);
  return reply.send({ success: true, data });
}

module.exports = {
  getLeadAnalytics,
  getSalesAnalytics,
  getCommissionAnalytics,
  getTaskAnalytics,
  getExecutiveSummary,
  getAgentPerformance,
  getBrokerDashboard,
  enqueueExport,
  getExportStatus,
  downloadExport,
};
