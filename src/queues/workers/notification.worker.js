'use strict';

const mongoose = require('mongoose');

/**
 * BullMQ Job Processor for Notification Delivery.
 * Handles channel-specific routing (email, whatsapp, SMS) and simulates delivery.
 */
async function processNotificationJob(job) {
  const { notificationId, channel, recipientId, title, message } = job.data;
  console.log(`[Queue:notification] Processing job ${job.id} for notification ${notificationId} (${channel})`);

  const Notification = mongoose.model('Notification');
  const notification = await Notification.findById(notificationId);
  if (!notification) {
    throw new Error(`Notification with ID '${notificationId}' not found`);
  }

  // Update status to 'sent'
  notification.status = 'sent';
  notification.sentAt = new Date();
  await notification.save();

  try {
    // Simulate channel-specific delivery
    switch (channel) {
      case 'email':
        console.log(`[Email Service] Simulating email to User '${recipientId}': "${title}" - ${message}`);
        break;
      case 'whatsapp':
        console.log(`[WhatsApp Service] Simulating WhatsApp to User '${recipientId}': "${message}"`);
        break;
      case 'sms':
        console.log(`[SMS Service] Simulating SMS to User '${recipientId}': "${message}"`);
        break;
      default:
        console.log(`[In-App Service] Local delivery already handled`);
    }

    // Mark as delivered
    notification.status = 'delivered';
    notification.deliveredAt = new Date();
    await notification.save();
    console.log(`[Queue:notification] Job ${job.id} successfully delivered notification ${notificationId}`);
  } catch (err) {
    console.error(`[Queue:notification] Delivery failed for job ${job.id}:`, err.message);
    
    notification.status = 'failed';
    notification.failureReason = err.message;
    notification.retryCount += 1;
    await notification.save();
    
    throw err; // Re-throw to let BullMQ trigger built-in retries
  }
}

module.exports = { processNotificationJob };
