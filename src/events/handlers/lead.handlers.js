'use strict';

const { EVENTS } = require('../../shared/constants/app.constants');
const { CustomerService } = require('../../modules/customer/customer.service');

/**
 * Register lead event handlers on the event bus.
 * @param {import('eventemitter2').EventEmitter2} eventBus
 */
function registerLeadHandlers(eventBus) {
  const customerService = new CustomerService();

  eventBus.on(EVENTS.LEAD_CONVERTED, async (payload) => {
    try {
      console.log(`[Event:lead.converted] Processing conversion for lead '${payload.leadId}'`);
      
      const Lead = require('mongoose').model('Lead');
      const lead = await Lead.findById(payload.leadId);
      if (!lead) {
        console.error(`[Event:lead.converted] Lead not found: ${payload.leadId}`);
        return;
      }

      // Actor defaults to the system user or creator
      const actor = { id: lead.createdBy || lead.assignedTo };
      await customerService.createFromLead(lead.toObject(), actor);
      
      console.log(`[Event:lead.converted] Customer successfully created from lead '${payload.leadId}'`);
    } catch (err) {
      console.error('[Event:lead.converted] Error processing conversion:', err.message);
    }
  });
}

module.exports = { registerLeadHandlers };
