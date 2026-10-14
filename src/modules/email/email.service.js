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
    this.host = options.host || process.env.SMTP_HOST || 'smtp.mailgun.org';
    this.port = parseInt(options.port || process.env.SMTP_PORT || '587', 10);
    this.secure = options.secure ?? (this.port === 465);
    this.user = options.user || process.env.SMTP_USER || '';
    this.pass = options.pass || process.env.SMTP_PASS || '';
    this.from = options.from || process.env.SMTP_FROM || 'TrackDeal CRM <noreply@trackdeal.com>';
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

    // Check if nodemailer is installed in the runtime environment
    let nodemailer = null;
    try {
      nodemailer = require('nodemailer');
    } catch {
      // nodemailer not yet in package.json dependencies
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
    console.log('\n==================== [TrackDeal Email Dispatch (Simulation Mode)] ====================');
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
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; }
    table { border-collapse: collapse; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #f8fafc; padding: 40px 0; }
    .main { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 600px; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 32px 36px; text-align: left; }
    .header h1 { margin: 0; font-size: 22px; color: #ffffff; font-weight: 700; letter-spacing: -0.02em; }
    .header p { margin: 6px 0 0 0; font-size: 13px; color: #bfdbfe; }
    .content { padding: 36px; }
    .greeting { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
    .message { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
    .credentials-box { background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px 24px; margin-bottom: 28px; }
    .cred-row { margin-bottom: 12px; font-size: 13px; }
    .cred-row:last-child { margin-bottom: 0; }
    .cred-label { font-weight: 600; color: #64748b; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; display: block; margin-bottom: 4px; }
    .cred-value { font-size: 15px; font-weight: 700; color: #0f172a; font-family: 'Courier New', Courier, monospace; background: #ffffff; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0; display: inline-block; word-break: break-all; }
    .cta-container { text-align: center; margin: 32px 0 24px 0; }
    .cta-button { display: inline-block; background-color: #2563eb; color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 32px; border-radius: 10px; box-shadow: 0 2px 6px rgba(37,99,235,0.25); }
    .security-note { background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; font-size: 12px; color: #92400e; line-height: 1.5; margin-bottom: 20px; }
    .footer { background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 36px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main" align="center" cellpadding="0" cellspacing="0">
      <tr>
        <td class="header">
          <h1>TrackDeal CRM</h1>
          <p>${organizationName} &bull; Staff Onboarding</p>
        </td>
      </tr>
      <tr>
        <td class="content">
          <div class="greeting">Hello ${staffName},</div>
          <div class="message">
            Welcome to the team! Your staff account for <strong>${organizationName}</strong> has been successfully created. You can now log in to the portal to manage student leads, admissions follow-ups, and student profiles.
          </div>

          <div class="credentials-box">
            <div class="cred-row">
              <span class="cred-label">Portal Login URL</span>
              <div style="font-size: 13px; font-weight: 600; color: #2563eb;">
                <a href="${resolvedLoginUrl}" style="color: #2563eb; text-decoration: underline;">${resolvedLoginUrl}</a>
              </div>
            </div>
            <div class="cred-row" style="margin-top: 14px;">
              <span class="cred-label">Registered Username / Email</span>
              <span class="cred-value">${resolvedUsername}</span>
            </div>
            <div class="cred-row" style="margin-top: 14px;">
              <span class="cred-label">Temporary Password</span>
              <span class="cred-value">${password || '••••••••'}</span>
            </div>
            <div class="cred-row" style="margin-top: 14px;">
              <span class="cred-label">Assigned Role</span>
              <span style="font-size: 13px; font-weight: 600; color: #334155;">${roleName}</span>
            </div>
          </div>

          <div class="security-note">
            <strong>Security Reminder:</strong> Please change your temporary password immediately upon your first sign-in under Account Settings to ensure account privacy.
          </div>

          <div class="cta-container">
            <a href="${resolvedLoginUrl}" class="cta-button">Log In to Your Workspace</a>
          </div>

          <div class="message" style="font-size: 12px; color: #64748b; margin-bottom: 0;">
            If you did not expect this invitation or encounter issues logging in, please get in touch with your organization administrator.
          </div>
        </td>
      </tr>
      <tr>
        <td class="footer">
          &copy; ${new Date().getFullYear()} TrackDeal CRM &bull; All rights reserved.<br>
          Automated system communication for ${organizationName}.
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
- Temporary Password: ${password || '••••••••'}
- Assigned Role: ${roleName}

Please log in and update your temporary password immediately.
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
  async sendDailyOverdueTaskDigestEmail({
    toAdmin,
    adminName = 'Administrator',
    organizationName = 'TrackDeal',
    date = new Date(),
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

    // Calculate aggregated metrics
    let totalOverdue = 0;
    let totalDueToday = 0;
    let totalPending = 0;

    staffMembersWithTasks.forEach((member) => {
      (member.tasks || []).forEach((t) => {
        if (t.status === 'overdue' || (t.delayLabel && t.delayLabel.toLowerCase().includes('overdue'))) {
          totalOverdue++;
        } else if (t.status === 'due_today' || (t.delayLabel && t.delayLabel.toLowerCase().includes('today'))) {
          totalDueToday++;
        } else {
          totalPending++;
        }
      });
    });

    const resolvedDashboardUrl = dashboardUrl || `${this.appUrl}/education/leads`;
    const subject = `Daily Task & Follow-up Digest: ${formattedDate} (${totalOverdue} Overdue Tasks)`;

    // Build staff sections HTML
    let staffSectionsHtml = '';

    if (staffMembersWithTasks.length === 0) {
      staffSectionsHtml = `
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 24px; text-align: center; color: #166534;">
          <h4 style="margin: 0 0 6px 0; font-size: 15px; font-weight: 700;">No Overdue or Pending Tasks</h4>
          <p style="margin: 0; font-size: 13px; color: #15803d;">All staff members are up to date on admissions tasks for today.</p>
        </div>
      `;
    } else {
      staffSectionsHtml = staffMembersWithTasks.map((member) => {
        const tasks = member.tasks || [];
        const memberOverdueCount = tasks.filter(t => t.status === 'overdue' || (t.delayLabel && t.delayLabel.toLowerCase().includes('overdue'))).length;

        const taskRows = tasks.map((task) => {
          const isOverdue = task.status === 'overdue' || (task.delayLabel && task.delayLabel.toLowerCase().includes('overdue'));
          const badgeBg = isOverdue ? '#fef2f2' : '#eff6ff';
          const badgeBorder = isOverdue ? '#fecaca' : '#bfdbfe';
          const badgeColor = isOverdue ? '#dc2626' : '#2563eb';
          const badgeText = isOverdue ? (task.delayLabel || 'Overdue') : 'Due Today';

          return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 12px 14px; font-size: 13px;">
                <strong style="color: #0f172a; display: block;">${task.leadName || 'Student Prospect'}</strong>
                <span style="color: #64748b; font-size: 11px;">${task.leadPhone || ''} ${task.schoolName ? `&bull; ${task.schoolName}` : ''}</span>
              </td>
              <td style="padding: 12px 14px; font-size: 13px; color: #334155;">
                ${task.taskTitle || 'Follow-up Call'}
              </td>
              <td style="padding: 12px 14px; font-size: 12px; color: #475569; font-family: monospace;">
                ${task.dueTime ? `${task.dueTime}` : (task.dueDate || 'Today')}
              </td>
              <td style="padding: 12px 14px; text-align: right;">
                <span style="display: inline-block; background-color: ${badgeBg}; border: 1px solid ${badgeBorder}; color: ${badgeColor}; font-weight: 700; font-size: 11px; padding: 4px 8px; border-radius: 9999px;">
                  ${badgeText}
                </span>
              </td>
            </tr>
          `;
        }).join('');

        return `
          <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 20px; overflow: hidden;">
            <div style="background-color: #f8fafc; padding: 14px 18px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="font-size: 14px; color: #0f172a;">${member.staffName}</strong>
                <span style="font-size: 12px; color: #64748b; margin-left: 6px;">(${member.role || 'Staff'})</span>
              </div>
              <div>
                ${memberOverdueCount > 0
                  ? `<span style="background-color: #fee2e2; color: #b91c1c; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px;">${memberOverdueCount} Overdue</span>`
                  : `<span style="background-color: #ecfdf5; color: #047857; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px;">On Track</span>`}
              </div>
            </div>
            <table style="width: 100%; text-align: left; border-collapse: collapse;">
              <thead>
                <tr style="background-color: #fcfcfc; border-bottom: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">
                  <th style="padding: 8px 14px;">Lead / Student</th>
                  <th style="padding: 8px 14px;">Task</th>
                  <th style="padding: 8px 14px;">Scheduled</th>
                  <th style="padding: 8px 14px; text-align: right;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${taskRows}
              </tbody>
            </table>
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
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #f8fafc; padding: 40px 0; }
    .main { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 660px; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 36px; text-align: left; }
    .header h1 { margin: 0; font-size: 20px; color: #ffffff; font-weight: 700; }
    .header p { margin: 6px 0 0 0; font-size: 13px; color: #94a3b8; }
    .content { padding: 32px 36px; }
    .metric-grid { display: table; width: 100%; margin-bottom: 28px; }
    .metric-cell { display: table-cell; width: 33.33%; padding: 0 8px; vertical-align: top; }
    .metric-cell:first-child { padding-left: 0; }
    .metric-cell:last-child { padding-right: 0; }
    .metric-card { border-radius: 12px; padding: 14px 16px; text-align: center; }
    .metric-number { font-size: 22px; font-weight: 800; margin: 4px 0 0 0; }
    .metric-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .cta-container { text-align: center; margin: 32px 0 20px 0; }
    .cta-button { display: inline-block; background-color: #2563eb; color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 13px 28px; border-radius: 10px; box-shadow: 0 2px 6px rgba(37,99,235,0.25); }
    .footer { background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 36px; text-align: center; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main" align="center" cellpadding="0" cellspacing="0">
      <tr>
        <td class="header">
          <h1>Daily Operations Digest</h1>
          <p>${organizationName} &bull; ${formattedDate}</p>
        </td>
      </tr>
      <tr>
        <td class="content">
          <div style="font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 8px;">
            Good Morning, ${adminName}
          </div>
          <div style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 24px;">
            Here is your daily morning summary of all pending and overdue follow-up tasks across your team members.
          </div>

          <!-- KPI Metric Highlights -->
          <div class="metric-grid">
            <div class="metric-cell">
              <div class="metric-card" style="background-color: #fef2f2; border: 1px solid #fee2e2;">
                <div class="metric-label" style="color: #dc2626;">Overdue Tasks</div>
                <div class="metric-number" style="color: #b91c1c;">${totalOverdue}</div>
              </div>
            </div>
            <div class="metric-cell">
              <div class="metric-card" style="background-color: #eff6ff; border: 1px solid #dbeafe;">
                <div class="metric-label" style="color: #2563eb;">Due Today</div>
                <div class="metric-number" style="color: #1d4ed8;">${totalDueToday}</div>
              </div>
            </div>
            <div class="metric-cell">
              <div class="metric-cell">
                <div class="metric-card" style="background-color: #f8fafc; border: 1px solid #e2e8f0;">
                  <div class="metric-label" style="color: #64748b;">Staff with Tasks</div>
                  <div class="metric-number" style="color: #0f172a;">${staffMembersWithTasks.length}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Staff Breakdown Lists -->
          <div style="margin-top: 24px;">
            <h3 style="font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.03em;">
              Staff Member Task Allocations
            </h3>
            ${staffSectionsHtml}
          </div>

          <div class="cta-container">
            <a href="${resolvedDashboardUrl}" class="cta-button">Open CRM Follow-ups Dashboard</a>
          </div>
        </td>
      </tr>
      <tr>
        <td class="footer">
          &copy; ${new Date().getFullYear()} TrackDeal CRM &bull; Automated Daily Task Digest for ${organizationName}
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
    `;

    const text = `
Daily Task & Follow-up Digest: ${formattedDate}
Organization: ${organizationName}

Summary:
- Total Overdue Tasks: ${totalOverdue}
- Total Due Today: ${totalDueToday}
- Staff Members with Open Tasks: ${staffMembersWithTasks.length}

Review follow-ups in CRM: ${resolvedDashboardUrl}

TrackDeal CRM Operations
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

