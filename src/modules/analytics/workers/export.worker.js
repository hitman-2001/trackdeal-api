'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const { tenantContext } = require('../../../shared/context/tenant-context');
const { AnalyticsService } = require('../analytics.service');

// ---------------------------------------------------------------------------
// Export Report Worker — BullMQ Job Processor
//
// Consumes jobs from the `pdf_generation` queue.
// Each job carries:
//   {
//     reportType : 'leads' | 'sales' | 'commission' | 'tasks' | 'executive'
//     format     : 'pdf' | 'csv'
//     startDate  : ISO string
//     endDate    : ISO string
//     branchId   : ObjectId string | null
//     filters    : {}
//     requestedBy: userId string
//     organizationId: ObjectId string
//   }
//
// Strategy:
//   1. Fetch analytics data (reusing AnalyticsService dashboard methods).
//   2. Render an HTML report template in-process.
//   3. For PDF: launch headless Puppeteer, generate PDF buffer.
//   4. For CSV: serialise the row data to CSV string.
//   5. Write the output file to /tmp (or OS temp dir) and attach the path
//      to job.returnvalue so the controller can stream it to the client.
//
// Puppeteer is launched with a sandbox-safe config for containerised envs.
// ---------------------------------------------------------------------------

// ── CSV utilities ─────────────────────────────────────────────────────────

function objectsToCsv(rows) {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const v = row[h] == null ? '' : String(row[h]);
          // Escape commas and quotes in field values
          return v.includes(',') || v.includes('"') || v.includes('\n')
            ? `"${v.replace(/"/g, '""')}"`
            : v;
        })
        .join(','),
    ),
  ];
  return lines.join('\n');
}

// ── HTML template builders ─────────────────────────────────────────────────

function buildHtmlReport(reportType, data) {
  const reportTitles = {
    leads: 'Lead Analytics Report',
    sales: 'Sales Analytics Report',
    commission: 'Commission Finance Report',
    tasks: 'Task Compliance Report',
    executive: 'Executive Summary Report',
  };

  const title = reportTitles[reportType] || 'Analytics Report';
  const period = data.period
    ? `${new Date(data.period.startDate).toDateString()} — ${new Date(data.period.endDate).toDateString()}`
    : '';

  // Serialise KPIs / totals section
  const totalsHtml = data.totals
    ? Object.entries(data.totals)
        .map(
          ([k, v]) => `
      <div class="kpi-card">
        <span class="kpi-label">${k.replace(/([A-Z])/g, ' $1')}</span>
        <span class="kpi-value">${typeof v === 'number' ? v.toLocaleString() : v}</span>
      </div>`,
        )
        .join('')
    : '';

  // Serialise time-series as a simple table
  const timeSeriesRows = data.timeSeries || data.leads?.timeSeries || data.sales?.timeSeries || [];
  const tableHtml =
    timeSeriesRows.length > 0
      ? `
    <table>
      <thead><tr>${Object.keys(timeSeriesRows[0])
        .map((h) => `<th>${h.replace(/([A-Z])/g, ' $1')}</th>`)
        .join('')}</tr></thead>
      <tbody>
        ${timeSeriesRows
          .map(
            (row) =>
              `<tr>${Object.values(row)
                .map((v) => `<td>${v == null ? '—' : typeof v === 'number' ? v.toLocaleString() : v}</td>`)
                .join('')}</tr>`,
          )
          .join('')}
      </tbody>
    </table>`
      : '<p class="empty">No data for the selected period.</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: #f9fafb;
      color: #1f2937;
      padding: 48px 56px;
    }
    header {
      border-bottom: 3px solid #4f46e5;
      padding-bottom: 20px;
      margin-bottom: 32px;
    }
    header h1 { font-size: 26px; font-weight: 700; color: #4f46e5; }
    header p  { font-size: 13px; color: #6b7280; margin-top: 4px; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 40px;
    }
    .kpi-card {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 18px 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,.06);
    }
    .kpi-label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #9ca3af; margin-bottom: 8px; }
    .kpi-value { display: block; font-size: 24px; font-weight: 700; color: #111827; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
    th { background: #4f46e5; color: #fff; padding: 10px 14px; font-size: 12px; text-align: left; text-transform: uppercase; letter-spacing: .05em; }
    td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #f3f4f6; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: #f9fafb; }
    .empty { color: #9ca3af; font-style: italic; margin-top: 20px; }
    footer { margin-top: 48px; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 16px; }
  </style>
</head>
<body>
  <header>
    <h1>${title}</h1>
    <p>Period: ${period} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString()}</p>
  </header>
  <div class="kpi-grid">${totalsHtml}</div>
  ${tableHtml}
  <footer>This report is generated by Track Deal CRM. Confidential — not for distribution.</footer>
</body>
</html>`;
}

// ── Main Job Processor ─────────────────────────────────────────────────────

/**
 * BullMQ job processor for the `pdf_generation` queue.
 * @param {import('bullmq').Job} job
 * @returns {Promise<{ filePath: string, mimeType: string, filename: string }>}
 */
async function processExportJob(job) {
  const {
    reportType,
    format,
    startDate,
    endDate,
    branchId,
    organizationId,
    requestedBy,
  } = job.data;

  console.log(
    `[ExportWorker] Processing job ${job.id}: type=${reportType}, format=${format}, org=${organizationId}`,
  );

  // ── Fetch analytics data via service (system override — worker context) ──
  const analyticsService = new AnalyticsService();
  const actor = {
    id: requestedBy,
    organizationId,
    role: 'system', // System actor; all branch restrictions bypassed
    branchId: null,
  };
  const params = { startDate, endDate, branchId };

  // Run inside the correct tenant context scoped to this organization.
  // isSystemOverride:false lets the repository queryRange() read organizationId
  // from context normally, while the organizationId is explicitly set so
  // summary collections return only this org's data.
  let data;
  await tenantContext.run({ organizationId, isSystemOverride: false }, async () => {
    switch (reportType) {
      case 'leads':
        data = await analyticsService.getLeadAnalytics(params, actor);
        break;
      case 'sales':
        data = await analyticsService.getSalesAnalytics(params, actor);
        break;
      case 'commission':
        data = await analyticsService.getCommissionAnalytics(params, actor);
        break;
      case 'tasks':
        data = await analyticsService.getTaskAnalytics(params, actor);
        break;
      case 'executive':
        data = await analyticsService.getExecutiveSummary(params, actor);
        break;
      default:
        throw new Error(`Unknown reportType: ${reportType}`);
    }
  });

  // ── Generate output file ──────────────────────────────────────────────────
  const tmpDir = os.tmpdir();
  const timestamp = Date.now();

  if (format === 'csv') {
    // Flatten timeSeries for CSV
    const rows = data.timeSeries || [];
    const csvContent = objectsToCsv(rows);
    const filename = `report_${reportType}_${timestamp}.csv`;
    const filePath = path.join(tmpDir, filename);
    await fs.writeFile(filePath, csvContent, 'utf8');

    console.log(`[ExportWorker] CSV written: ${filePath}`);
    return { filePath, mimeType: 'text/csv', filename };
  }

  // Default: PDF via Puppeteer
  const htmlContent = buildHtmlReport(reportType, data);

  // Lazily require puppeteer so the worker only pays the startup cost when needed
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch {
    // puppeteer-core fallback
    puppeteer = require('puppeteer-core');
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', bottom: '20px', left: '0', right: '0' },
    });

    const filename = `report_${reportType}_${timestamp}.pdf`;
    const filePath = path.join(tmpDir, filename);
    await fs.writeFile(filePath, pdfBuffer);

    console.log(`[ExportWorker] PDF written: ${filePath}`);
    return { filePath, mimeType: 'application/pdf', filename };
  } finally {
    await browser.close();
  }
}

module.exports = { processExportJob };
