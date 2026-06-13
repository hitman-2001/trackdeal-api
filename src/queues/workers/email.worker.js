'use strict';

/**
 * BullMQ Job Processor for high-volume Transactional Emails.
 */
async function processEmailJob(job) {
  const { to, subject, html } = job.data;
  console.log(`[Queue:email] Processing job ${job.id} - sending email to <${to}>...`);

  // Simulate latency
  await new Promise((resolve) => setTimeout(resolve, 500));

  console.log(`[Queue:email] Email successfully sent to <${to}>: Subject: "${subject}"`);
  return { success: true };
}

module.exports = { processEmailJob };
