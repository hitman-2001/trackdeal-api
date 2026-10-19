'use strict';

/**
 * TrackDeal CRM — Standalone Email Service
 * 
 * Provides automated email generation and delivery for:
 * 1. Staff Welcome & Credential Dispatch (upon onboarding/creation)
 * 2. Daily Overdue Task & Follow-up Digest (morning summary for admins)
 * 
 * NOTE: As per system specification, this service is fully implemented
 * and ready to dispatch via SMTP / Nodemailer or API providers, but is not
 * directly hooked into runtime request handlers until SMTP credentials are provided.
 */

class EmailService {
  constructor(options = {}) {
    this.host = options.host || process.env.SMTP_HOST || 'smtp-relay.brevo.com';
    this.port = parseInt(options.port || process.env.SMTP_PORT || '587', 10);
    this.secure = options.secure ?? (this.port === 465);
    this.user = options.user || process.env.SMTP_USER || '';
    this.pass = options.pass || process.env.SMTP_PASS || '';
    this.from = options.from || process.env.SMTP_FROM || process.env.EMAIL_FROM || 'TrackDeal CRM <contact@trackdeal.in>';
    this.appUrl = options.appUrl || process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173';
  }

  /**
   * Send an arbitrary email with HTML and text fallback.
   * If nodemailer is present and credentials configured, dispatches real email;
   * otherwise logs email details in development/simulation mode.
   */
  async sendEmail({ to, subject, html, text }) {
    if (!to) {
      throw new Error('Email recipient "to" address is required.');
    }

    let nodemailer = null;
    let nodemailerErr = null;
    try {
      nodemailer = require('nodemailer');
    } catch (err) {
      nodemailerErr = err.message;
    }

    if (nodemailer && this.user && this.pass) {
      try {
        const transporter = nodemailer.createTransport({
          host: this.host,
          port: this.port,
          secure: this.secure,
          auth: {
            user: this.user,
            pass: this.pass,
          },
        });

        const info = await transporter.sendMail({
          from: this.from,
          to,
          subject,
          text: text || '',
          html,
        });

        return { success: true, messageId: info.messageId, mode: 'smtp' };
      } catch (err) {
        console.error('[EmailService] SMTP delivery failed:', err.message);
        throw err;
      }
    }

    // Standalone Simulation / Development Mode
    let reason = '';
    if (!nodemailer) {
      reason = `nodemailer module is missing (${nodemailerErr || 'Cannot find module nodemailer'}). Rebuild Docker container or run npm install.`;
    } else if (!this.user || !this.pass) {
      reason = `SMTP_USER or SMTP_PASS environment variable is not configured in .env (user=${this.user ? 'set' : 'missing'}, pass=${this.pass ? 'set' : 'missing'}).`;
    }

    console.log('\n==================== [TrackDeal Email Dispatch (Simulation Mode)] ====================');
    if (reason) console.log(`Note:    ${reason}`);
    console.log(`To:      ${to}`);
    console.log(`From:    ${this.from}`);
    console.log(`Subject: ${subject}`);
    console.log('--------------------------------------------------------------------------------------');
    console.log(`Preview Text:\n${text || '(HTML Template Attached)'}`);
    console.log('======================================================================================\n');

    return {
      success: true,
      simulated: true,
      to,
      subject,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 1. Automated Staff Credentials Email
   * Dispatches login username & temporary password to newly onboarded staff.
   */
  async sendStaffWelcomeCredentialsEmail({
    to,
    staffName = 'Staff Member',
    username,
    email,
    password,
    loginUrl,
    organizationName = 'TrackDeal',
    roleName = 'Staff Member',
  }) {
    const targetEmail = to || email;
    if (!targetEmail) {
      throw new Error('Recipient email is required for staff credentials.');
    }

    const resolvedLoginUrl = loginUrl || `${this.appUrl}/login`;
    const resolvedUsername = username || email || targetEmail;
    const subject = `Welcome to ${organizationName} - Your Account Login Credentials`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; }
    table { border-collapse: collapse; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #f1f5f9; padding: 36px 0; }
    .main { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 600px; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.04); }
    .header { background: linear-gradient(135deg, #1b3d2f 0%, #264f3c 100%); padding: 32px 36px; text-align: left; }
    .header-badge { display: inline-block; background-color: rgba(255,255,255,0.18); color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 10px; border-radius: 9999px; margin-bottom: 8px; }
    .header h1 { margin: 0; font-size: 22px; color: #ffffff; font-weight: 800; letter-spacing: -0.02em; }
    .header p { margin: 6px 0 0 0; font-size: 13px; color: #d1fae5; }
    .content { padding: 32px 36px; }
    .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
    .message { font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 24px; }
    .credentials-card { background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px 22px; margin-bottom: 24px; }
    .cred-row { margin-bottom: 14px; }
    .cred-row:last-child { margin-bottom: 0; }
    .cred-label { font-weight: 700; color: #64748b; text-transform: uppercase; font-size: 10px; letter-spacing: 0.06em; display: block; margin-bottom: 4px; }
    .cred-value { font-size: 14px; font-weight: 700; color: #0f172a; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; background: #ffffff; padding: 7px 12px; border-radius: 6px; border: 1px solid #cbd5e1; display: inline-block; word-break: break-all; }
    .cta-container { text-align: center; margin: 28px 0 20px 0; }
    .cta-button { display: inline-block; background-color: #264f3c; color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 13px 32px; border-radius: 8px; box-shadow: 0 2px 6px rgba(38,79,60,0.3); }
    .security-note { background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 14px; border-radius: 6px; font-size: 12px; color: #92400e; line-height: 1.5; margin-bottom: 20px; }
    .footer { background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 22px 36px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main" align="center" cellpadding="0" cellspacing="0">
      <tr>
        <td class="header">
          <div class="header-badge">Staff Onboarding</div>
          <h1>TrackDeal CRM</h1>
          <p>${organizationName} &bull; Account Setup</p>
        </td>
      </tr>
      <tr>
        <td class="content">
          <div class="greeting">Hello ${staffName},</div>
          <div class="message">
            Welcome to the team! Your staff account for <strong>${organizationName}</strong> has been configured on <strong>TrackDeal CRM</strong>. You can now log in to manage admissions prospects, scheduled callbacks, and daily lead activities.
          </div>

          <div class="credentials-card">
            <div class="cred-row">
              <span class="cred-label">Login Portal URL</span>
              <div style="font-size: 13px; font-weight: 600;">
                <a href="${resolvedLoginUrl}" style="color: #264f3c; text-decoration: underline;">${resolvedLoginUrl}</a>
              </div>
            </div>
            <div class="cred-row">
              <span class="cred-label">Registered Email / Username</span>
              <span class="cred-value">${resolvedUsername}</span>
            </div>
            <div class="cred-row">
              <span class="cred-label">Password</span>
              <span class="cred-value">${password || '••••••••'}</span>
            </div>
            <div class="cred-row">
              <span class="cred-label">Assigned Role</span>
              <span style="font-size: 13px; font-weight: 700; color: #1e293b;">${roleName}</span>
            </div>
          </div>

          <div class="cta-container">
            <a href="${resolvedLoginUrl}" class="cta-button">Log In to Your Workspace</a>
          </div>

          <div class="message" style="font-size: 12px; color: #64748b; margin-bottom: 0;">
            If you encounter issues accessing your account, please contact your organization administrator or reply to this email.
          </div>
        </td>
      </tr>
      <tr>
        <td class="footer">
          &copy; ${new Date().getFullYear()} TrackDeal CRM &bull; All rights reserved.<br>
          Automated onboarding communication dispatched for ${organizationName}.
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
    `;

    const text = `
Welcome to ${organizationName} - Staff Onboarding

Hello ${staffName},

Your staff account for ${organizationName} has been generated on TrackDeal CRM.

Here are your account credentials:
- Login Portal: ${resolvedLoginUrl}
- Username / Email: ${resolvedUsername}
- Password: ${password || '••••••••'}
- Assigned Role: ${roleName}

Portal Link: ${resolvedLoginUrl}

TrackDeal CRM Operations
    `.trim();

    return this.sendEmail({
      to: targetEmail,
      subject,
      html,
      text,
    });
  }

  /**
   * 2. Daily Overdue Task Digest Email
   * Automated morning digest sent to administrators summarizing pending and overdue tasks across all staff members.
   * 
   * @param {Object} payload
   * @param {string} payload.toAdmin - Admin's email address
   * @param {string} payload.adminName - Admin's full name
   * @param {string} payload.organizationName - Name of institution/tenant
   * @param {string|Date} payload.date - Digest date
   * @param {Array} payload.staffMembersWithTasks - Array of staff objects with their pending & overdue tasks
   *   [
   *     {
   *       staffName: 'Ramesh Sharma',
   *       staffEmail: 'ramesh@example.com',
   *       role: 'Counselor',
   *       tasks: [
   *         {
   *           leadName: 'Aarav Gupta',
   *           leadPhone: '+91 9876543210',
   *           schoolName: 'St. Xavier High School',
   *           taskTitle: 'Fee Inquiry Call Back',
   *           dueDate: '2026-10-12',
   *           dueTime: '10:00 AM',
   *           status: 'overdue', // 'overdue' | 'due_today' | 'pending'
   *           delayLabel: 'Overdue by 1 day',
   *           priority: 'high'
   *         }
   *       ]
   *     }
   *   ]
   */
  /**
   * 2. Daily Staff Operations & Overdue Digest Email (11:00 AM IST)
   * Automated morning summary dispatched to Organization Administrators detailing:
   * - Staff work completed in the day (activities, callbacks logged, attended prospects)
   * - Overdue tasks requiring immediate escalation or action
   * - Upcoming tasks scheduled for today
   */
  async sendDailyOverdueTaskDigestEmail({
    toAdmin,
    adminName = 'Administrator',
    organizationName = 'TrackDeal',
    date = new Date(),
    staffMembers = [],
    staffMembersWithTasks = [],
    dashboardUrl,
  }) {
    if (!toAdmin) {
      throw new Error('Admin recipient "toAdmin" email address is required.');
    }

    const formattedDate = new Date(date).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Normalize staff members list (supports both new staffMembers and legacy staffMembersWithTasks)
    const members = (staffMembers.length > 0 ? staffMembers : staffMembersWithTasks).map((m) => {
      const completed = m.completedTasks || [];
      const overdue = m.overdueTasks || (m.tasks || []).filter(t => t.status === 'overdue' || (t.delayLabel && t.delayLabel.toLowerCase().includes('overdue')));
      const today = m.todayTasks || (m.tasks || []).filter(t => t.status === 'due_today' || (t.delayLabel && t.delayLabel.toLowerCase().includes('today')));
      return {
        staffName: m.staffName || 'Staff Member',
        staffEmail: m.staffEmail || '',
        role: m.role || 'Staff',
        completedTasks: completed,
        overdueTasks: overdue,
        todayTasks: today,
      };
    });

    // Calculate aggregated metrics
    let totalCompleted = 0;
    let totalOverdue = 0;
    let totalDueToday = 0;

    members.forEach((m) => {
      totalCompleted += m.completedTasks.length;
      totalOverdue += m.overdueTasks.length;
      totalDueToday += m.todayTasks.length;
    });

    const resolvedDashboardUrl = dashboardUrl || `${this.appUrl}/education/leads`;
    const subject = `${organizationName} Daily Operations Digest: ${formattedDate} (${totalOverdue} Overdue, ${totalCompleted} Done)`;

    // Build staff sections HTML
    let staffCardsHtml = '';

    if (members.length === 0) {
      staffCardsHtml = `
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 24px; text-align: center; color: #166534;">
          <h4 style="margin: 0 0 6px 0; font-size: 15px; font-weight: 700;">No Staff Operations Pending</h4>
          <p style="margin: 0; font-size: 13px; color: #15803d;">All staff members are on track and no open overdue items exist.</p>
        </div>
      `;
    } else {
      staffCardsHtml = members.map((member) => {
        const completedCount = member.completedTasks.length;
        const overdueCount = member.overdueTasks.length;

        // 1. Render Completed Work Rows
        let completedRows = '';
        if (completedCount > 0) {
          completedRows = member.completedTasks.map((item) => `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 12px; font-size: 12px;">
                <strong style="color: #0f172a; display: block;">${item.leadName || 'Student Prospect'}</strong>
                <span style="color: #64748b; font-size: 11px;">${item.leadPhone || ''} ${item.schoolName ? `&bull; ${item.schoolName}` : ''}</span>
              </td>
              <td style="padding: 10px 12px; font-size: 12px; color: #334155;">
                <div style="font-weight: 600; color: #047857;">${item.actionTitle || 'Activity Logged'}</div>
                ${item.outcome ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">${item.outcome}</div>` : ''}
              </td>
              <td style="padding: 10px 12px; font-size: 11px; color: #64748b; text-align: right; white-space: nowrap;">
                ${item.completedAt || 'Today'}
              </td>
            </tr>
          `).join('');
        }

        // 2. Render Overdue Tasks Rows
        let overdueRows = '';
        if (overdueCount > 0) {
          overdueRows = member.overdueTasks.map((item) => `
            <tr style="border-bottom: 1px solid #f1f5f9; background-color: #fffbfb;">
              <td style="padding: 10px 12px; font-size: 12px;">
                <strong style="color: #0f172a; display: block;">${item.leadName || 'Student Prospect'}</strong>
                <span style="color: #64748b; font-size: 11px;">${item.leadPhone || ''} ${item.schoolName ? `&bull; ${item.schoolName}` : ''}</span>
              </td>
              <td style="padding: 10px 12px; font-size: 12px; color: #334155;">
                <div style="font-weight: 600; color: #b91c1c;">${item.taskTitle || 'Scheduled Follow-up'}</div>
                <div style="font-size: 11px; color: #64748b;">Scheduled: ${item.dueTime || item.dueDate || 'Past Due'}</div>
              </td>
              <td style="padding: 10px 12px; text-align: right; white-space: nowrap;">
                <span style="display: inline-block; background-color: #fee2e2; border: 1px solid #fecaca; color: #b91c1c; font-weight: 700; font-size: 10px; padding: 3px 8px; border-radius: 9999px;">
                  ${item.delayLabel || 'Overdue'}
                </span>
              </td>
            </tr>
          `).join('');
        }

        return `
          <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 20px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <!-- Staff Member Header -->
            <div style="background-color: #f8fafc; padding: 14px 18px; border-bottom: 1px solid #e2e8f0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td>
                    <strong style="font-size: 14px; color: #0f172a;">${member.staffName}</strong>
                    <span style="display: inline-block; background-color: #e2e8f0; color: #334155; font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 4px; margin-left: 6px;">
                      ${member.role}
                    </span>
                    ${member.staffEmail ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">${member.staffEmail}</div>` : ''}
                  </td>
                  <td style="text-align: right; vertical-align: middle;">
                    <span style="display: inline-block; background-color: ${completedCount > 0 ? '#ecfdf5' : '#f1f5f9'}; color: ${completedCount > 0 ? '#047857' : '#64748b'}; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; margin-right: 6px;">
                      ${completedCount} Done
                    </span>
                    <span style="display: inline-block; background-color: ${overdueCount > 0 ? '#fee2e2' : '#f1f5f9'}; color: ${overdueCount > 0 ? '#b91c1c' : '#64748b'}; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px;">
                      ${overdueCount} Overdue
                    </span>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Overdue Tasks Table (if any) -->
            ${overdueCount > 0 ? `
              <div style="padding: 12px 16px 4px 16px;">
                <div style="font-size: 11px; font-weight: 700; color: #b91c1c; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">
                  Action Required &bull; Overdue Tasks (${overdueCount})
                </div>
                <table style="width: 100%; text-align: left; border-collapse: collapse; margin-bottom: 12px;">
                  <thead>
                    <tr style="background-color: #fef2f2; font-size: 10px; color: #991b1b; text-transform: uppercase; letter-spacing: 0.04em;">
                      <th style="padding: 6px 12px;">Prospect</th>
                      <th style="padding: 6px 12px;">Task</th>
                      <th style="padding: 6px 12px; text-align: right;">Delay</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${overdueRows}
                  </tbody>
                </table>
              </div>
            ` : ''}

            <!-- Completed Work Table (if any) -->
            ${completedCount > 0 ? `
              <div style="padding: 12px 16px 8px 16px; ${overdueCount > 0 ? 'border-top: 1px dashed #e2e8f0;' : ''}">
                <div style="font-size: 11px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">
                  Productivity Proof &bull; Work Completed in Day (${completedCount})
                </div>
                <table style="width: 100%; text-align: left; border-collapse: collapse;">
                  <thead>
                    <tr style="background-color: #f0fdf4; font-size: 10px; color: #166534; text-transform: uppercase; letter-spacing: 0.04em;">
                      <th style="padding: 6px 12px;">Prospect</th>
                      <th style="padding: 6px 12px;">Action Taken</th>
                      <th style="padding: 6px 12px; text-align: right;">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${completedRows}
                  </tbody>
                </table>
              </div>
            ` : ''}

            ${completedCount === 0 && overdueCount === 0 ? `
              <div style="padding: 18px; text-align: center; color: #94a3b8; font-size: 12px;">
                No overdue tasks or actions recorded in this window.
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    }

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #f1f5f9; padding: 32px 0; }
    .main { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 680px; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.04); }
    .header { background: linear-gradient(135deg, #1b3d2f 0%, #264f3c 100%); padding: 30px 36px; text-align: left; }
    .header-badge { display: inline-block; background-color: rgba(255,255,255,0.18); color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 10px; border-radius: 9999px; margin-bottom: 8px; }
    .header h1 { margin: 0; font-size: 21px; color: #ffffff; font-weight: 800; }
    .header p { margin: 6px 0 0 0; font-size: 13px; color: #d1fae5; }
    .content { padding: 32px 36px; }
    .greeting { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
    .subtext { font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 24px; }
    .kpi-table { width: 100%; border-collapse: separate; border-spacing: 8px; margin-bottom: 24px; }
    .kpi-cell { padding: 14px 12px; border-radius: 10px; text-align: center; width: 25%; }
    .kpi-num { font-size: 22px; font-weight: 800; line-height: 1; margin-bottom: 4px; }
    .kpi-lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
    .section-title { font-size: 13px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 14px; }
    .cta-container { text-align: center; margin: 32px 0 20px 0; }
    .cta-button { display: inline-block; background-color: #264f3c; color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 13px 30px; border-radius: 8px; box-shadow: 0 2px 6px rgba(38,79,60,0.3); }
    .footer { background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 22px 36px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main" align="center" cellpadding="0" cellspacing="0">
      <tr>
        <td class="header">
          <div class="header-badge">Executive Daily Digest &bull; 11:00 AM IST</div>
          <h1>${organizationName}</h1>
          <p>Daily Operations &bull; Staff Performance Summary &bull; ${formattedDate}</p>
        </td>
      </tr>
      <tr>
        <td class="content">
          <div class="greeting">Good Morning, ${adminName}</div>
          <div class="subtext">
            Here is your daily 11:00 AM executive operations summary of work completed by your staff today, along with pending overdue tasks requiring attention.
          </div>

          <!-- KPI Metric Highlights -->
          <table class="kpi-table" cellpadding="0" cellspacing="0">
            <tr>
              <td class="kpi-cell" style="background-color: #ecfdf5; border: 1px solid #a7f3d0;">
                <div class="kpi-num" style="color: #047857;">${totalCompleted}</div>
                <div class="kpi-lbl" style="color: #065f46;">Work Done Today</div>
              </td>
              <td class="kpi-cell" style="background-color: #fef2f2; border: 1px solid #fecaca;">
                <div class="kpi-num" style="color: #b91c1c;">${totalOverdue}</div>
                <div class="kpi-lbl" style="color: #991b1b;">Overdue Tasks</div>
              </td>
              <td class="kpi-cell" style="background-color: #eff6ff; border: 1px solid #bfdbfe;">
                <div class="kpi-num" style="color: #1d4ed8;">${totalDueToday}</div>
                <div class="kpi-lbl" style="color: #1e40af;">Due Today</div>
              </td>
              <td class="kpi-cell" style="background-color: #f8fafc; border: 1px solid #e2e8f0;">
                <div class="kpi-num" style="color: #0f172a;">${members.length}</div>
                <div class="kpi-lbl" style="color: #475569;">Active Staff</div>
              </td>
            </tr>
          </table>

          <!-- Staff Breakdown List -->
          <div>
            <div class="section-title">Staff Activity &amp; Task Breakdown</div>
            ${staffCardsHtml}
          </div>

          <div class="cta-container">
            <a href="${resolvedDashboardUrl}" class="cta-button">Open CRM Operations Dashboard</a>
          </div>
        </td>
      </tr>
      <tr>
        <td class="footer">
          &copy; ${new Date().getFullYear()} TrackDeal CRM &bull; Automated 11:00 AM IST Executive Operations Digest for ${organizationName}.<br>
          Dispatched centrally from contact@trackdeal.in.
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
    `;

    const text = `
${organizationName} - Daily Operations Digest (${formattedDate})
Administrator: ${adminName}

Executive Summary:
- Work Done Today: ${totalCompleted}
- Overdue Tasks: ${totalOverdue}
- Due Today: ${totalDueToday}
- Active Staff: ${members.length}

Review follow-ups & live operations in TrackDeal CRM:
${resolvedDashboardUrl}

TrackDeal Operations Team (contact@trackdeal.in)
    `.trim();

    return this.sendEmail({
      to: toAdmin,
      subject,
      html,
      text,
    });
  }
}

const defaultEmailService = new EmailService();

module.exports = {
  EmailService,
  emailService: defaultEmailService,
};

