'use strict';

const { BaseService } = require('../../shared/base/BaseService');
const {
  DealRepository,
  DealStageHistoryRepository,
  DealReservationRepository,
  DealDocumentRepository,
  DealPaymentRepository,
  DealCancellationRepository,
} = require('./deal.repository');
const { PropertyService } = require('../property/property.service');
const { ProjectService } = require('../project/project.service');
const { NotFoundError, BusinessRuleError, ForbiddenError } = require('../../shared/errors');
const { AUDIT_ACTIONS, EVENTS } = require('../../shared/constants/app.constants');

class DealService extends BaseService {
  constructor(deps = {}) {
    super(deps);
    this.dealRepository = deps.dealRepository || new DealRepository();
    this.dealStageHistoryRepository = deps.dealStageHistoryRepository || new DealStageHistoryRepository();
    this.dealReservationRepository = deps.dealReservationRepository || new DealReservationRepository();
    this.dealDocumentRepository = deps.dealDocumentRepository || new DealDocumentRepository();
    this.dealPaymentRepository = deps.dealPaymentRepository || new DealPaymentRepository();
    this.dealCancellationRepository = deps.dealCancellationRepository || new DealCancellationRepository();
    this.propertyService = deps.propertyService || new PropertyService();
    this.projectService = deps.projectService || new ProjectService();
  }

  async listDeals(query, actor) {
    const filter = { isDeleted: false, organizationId: actor.organizationId };

    if (query.status) filter.status = query.status;
    if (query.broker) filter.broker = query.broker;
    if (query.customer) filter.customer = query.customer;

    const { PERMISSIONS } = require('../../shared/constants/roles-permissions.constants');

    if (!actor.permissions?.includes(PERMISSIONS.DEALS_VIEW_ALL)) {
      if (actor.permissions?.includes(PERMISSIONS.DEALS_VIEW_BRANCH) && actor.branchId) {
        // BRANCH_MANAGER in ENTERPRISE_AGENCY: restrict to their branch only
        filter.branchId = actor.branchId;
      } else if (actor.permissions?.includes(PERMISSIONS.DEALS_VIEW_TEAM)) {
        // MANAGER in AGENCY/ENTERPRISE_AGENCY: org-wide visibility, no branch filter
        // (branchId filter intentionally omitted)
        if (query.branchId) filter.branchId = query.branchId; // allow explicit branch drill-down
      } else {
        // AGENT / READ_ONLY: own deals only
        filter.assignedTo = actor.id;
      }
    } else if (query.branchId) {
      // ORG_ADMIN with explicit branchId query filter (enterprise drill-down)
      filter.branchId = query.branchId;
    }

    return this.dealRepository.paginate(filter, {
      page: query.page,
      limit: query.limit,
      sort: { createdAt: -1 },
      populate: [
        { path: 'customer', select: 'firstName lastName mobile' },
        { path: 'broker', select: 'firstName lastName' },
        { path: 'assignedTo', select: 'firstName lastName' },
        { path: 'project', select: 'name code' },
        { path: 'unit', select: 'unitNumber price configuration' },
        { path: 'property', select: 'title location.city price' },
      ],
    });
  }

  async getDealById(id, actor) {
    const deal = await this.dealRepository.findByIdOrFail(id, 'Deal');
    if (deal.organizationId.toString() !== actor.organizationId.toString()) {
      throw new ForbiddenError('Access to this deal is prohibited.');
    }
    return deal;
  }

  async createDeal(data, actor) {
    const organizationId = actor.organizationId;
    // branchId is only applicable for ENTERPRISE_AGENCY organizations.
    // INDIVIDUAL_AGENT and AGENCY deals are always branchless.
    const branchId = actor.organizationType === 'ENTERPRISE_AGENCY'
      ? (data.branchId || actor.branchId || null)
      : null;

    const isBuilderUnit = !!data.unit;
    const isResaleProp = !!data.property;

    if ((isBuilderUnit && isResaleProp) || (!isBuilderUnit && !isResaleProp)) {
      throw new BusinessRuleError('A deal must reference either a builder Unit/Project OR a resale Property.', 'INVALID_INVENTORY_LINK');
    }

    // 1. Entity existence and tenant boundary validations (Customer, Project, Property)
    const { Customer } = require('../customer/customer.model');
    const customer = await Customer.findById(data.customer);
    if (!customer || customer.isDeleted) {
      throw new NotFoundError('Customer', data.customer);
    }
    if (customer.organizationId.toString() !== organizationId.toString()) {
      throw new ForbiddenError('Customer belongs to a different organization.');
    }

    if (isBuilderUnit) {
      const project = await this.projectService.projectRepository.findByIdOrFail(data.project, 'Project');
      if (project.organizationId.toString() !== organizationId.toString()) {
        throw new ForbiddenError('Project belongs to a different organization.');
      }
    } else {
      const property = await this.propertyService.validateAvailability(data.property);
      if (property.organizationId.toString() !== organizationId.toString()) {
        throw new ForbiddenError('Property belongs to a different organization.');
      }
    }

    // 2. Create Master Deal record
    const deal = await this.dealRepository.create({
      ...data,
      organizationId,
      branchId,
      broker: actor.id,
      assignedTo: data.assignedTo || actor.id,
      sourcingAgent: data.sourcingAgent || actor.id,
      closingAgent: data.closingAgent || null,
      teamLeader: data.teamLeader || null,
      status: 'draft',
      timeline: [
        {
          event: 'deal_initiated',
          description: 'Deal initiated in draft status',
          performedBy: actor.id,
        },
      ],
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    // 3. Log initial stage history
    await this.dealStageHistoryRepository.create({
      organizationId,
      dealId: deal.id,
      newStage: 'draft',
      changedBy: actor.id,
      durationInMinutes: 0,
    });

    // 4. Seeding initial document gates
    const docTypes = ['kyc_pan', 'kyc_aadhaar', 'booking_form'];
    for (const docType of docTypes) {
      await this.dealDocumentRepository.create({
        organizationId,
        dealId: deal.id,
        docType,
        status: 'pending',
        fileId: new Object().id || '507f1f77bcf86cd799439000', // Mock fileId placeholder if not provided
        createdBy: actor.id,
        updatedBy: actor.id,
      });
    }

    // 5. Inventory locking & atomic reservations
    if (isBuilderUnit) {
      // Temp lock Unit atomically
      await this.projectService.blockUnit(data.unit, {
        lockedBy: actor.id,
        lockedDurationMinutes: 2880, // 48 Hours
      }, actor);

      // Create DealReservation record
      await this.dealReservationRepository.create({
        organizationId,
        branchId,
        dealId: deal.id,
        unit: data.unit,
        lockedBy: actor.id,
        lockedDurationMinutes: 2880,
        lockedUntil: new Date(Date.now() + 2880 * 60000),
        status: 'temp_locked',
        createdBy: actor.id,
        updatedBy: actor.id,
      });
    } else {
      await this.propertyService.markReserved(data.property, actor);
    }

    await this.publishEvent(EVENTS.DEAL_CREATED, { dealId: deal.id });
    await this.logAudit({
      action: AUDIT_ACTIONS.CREATE,
      entity: 'Deal',
      entityId: deal.id,
      userId: actor.id,
      newValues: { dealNumber: deal.dealNumber, status: 'draft' },
      description: `Deal '${deal.dealNumber}' created under organization '${organizationId}'`,
    });

    return deal;
  }

  async extendReservation(dealId, durationMinutes, actor) {
    const deal = await this.getDealById(dealId, actor);
    if (!deal.unit) {
      throw new BusinessRuleError('This deal is not linked to a builder Unit reservation.', 'INVALID_OPERATION');
    }

    const reservation = await this.dealReservationRepository.findOne({
      dealId,
      status: { $in: ['temp_locked', 'token_locked'] },
    });
    if (!reservation) {
      throw new NotFoundError('Active Deal Reservation', dealId);
    }

    const lockedUntil = new Date(Date.now() + durationMinutes * 60000);
    await this.dealReservationRepository.update(reservation.id, {
      lockedDurationMinutes: durationMinutes,
      lockedUntil,
      updatedBy: actor.id,
    });

    // Update Unit lock in ProjectService
    await this.projectService.unitRepository.findOneAndUpdate(
      { _id: deal.unit },
      { $set: { lockedUntil, updatedBy: actor.id } }
    );

    deal.timeline.push({
      event: 'reservation_extended',
      description: `Reservation extended by ${durationMinutes} minutes`,
      performedBy: actor.id,
    });
    await deal.save();

    return this.getDealById(dealId, actor);
  }

  async releaseReservation(dealId, actor) {
    const deal = await this.getDealById(dealId, actor);

    if (deal.unit) {
      const reservation = await this.dealReservationRepository.findOne({
        dealId,
        status: { $in: ['temp_locked', 'token_locked', 'booking_confirmed'] },
      });
      if (reservation) {
        await this.dealReservationRepository.update(reservation.id, {
          status: 'released',
          releasedAt: new Date(),
          releaseReason: 'Manual or automated escrow cancellation release',
          updatedBy: actor.id,
        });
      }
      await this.projectService.releaseUnit(deal.unit, actor);
    } else if (deal.property) {
      await this.propertyService.updateProperty(deal.property, { status: 'available' }, actor);
    }

    deal.timeline.push({
      event: 'reservation_released',
      description: 'Inventory reservation released back to public available status',
      performedBy: actor.id,
    });
    await deal.save();

    return this.getDealById(dealId, actor);
  }

  async convertReservationToBooking(dealId, actor) {
    const deal = await this.getDealById(dealId, actor);
    if (!deal.unit) {
      throw new BusinessRuleError('This deal is not linked to a builder Unit.', 'INVALID_OPERATION');
    }

    // Asserts EOI token payment is cleared
    const hasClearedToken = await this.dealPaymentRepository.exists({
      dealId,
      paymentType: 'token',
      status: 'cleared',
    });
    if (!hasClearedToken) {
      throw new BusinessRuleError('A cleared EOI Token payment is required to convert a reservation to booking.', 'TOKEN_PAYMENT_REQUIRED');
    }

    const reservation = await this.dealReservationRepository.findOne({
      dealId,
      status: 'token_locked',
    });
    if (!reservation) {
      throw new BusinessRuleError('Active token_locked reservation was not found.', 'RESERVATION_NOT_FOUND');
    }

    await this.dealReservationRepository.update(reservation.id, {
      status: 'booking_confirmed',
      updatedBy: actor.id,
    });

    await this.projectService.reserveUnit(deal.unit, { reservedByLeadId: deal.customer }, actor);

    deal.timeline.push({
      event: 'reservation_converted',
      description: 'EOI Reservation converted successfully to confirmed builder booking',
      performedBy: actor.id,
    });
    await deal.save();

    return this.getDealById(dealId, actor);
  }

  async addPayment(id, paymentData, actor) {
    const deal = await this.getDealById(id, actor);

    if (['deal_closed', 'cancelled', 'token_bounced'].includes(deal.status)) {
      throw new BusinessRuleError('Cannot add payment to a closed, cancelled, or EOI-bounced deal.', 'DEAL_IMMUTABLE');
    }

    if (paymentData.amount <= 0) {
      throw new BusinessRuleError('Payment amount must be greater than zero.', 'INVALID_PAYMENT_AMOUNT');
    }

    // Double entry B2B Indian Tax splits (18% GST CGST/SGST, 5% TDS under 194H)
    const grossAmount = paymentData.amount;
    const gstAmount = grossAmount * 0.18;
    const tdsAmount = grossAmount * 0.05;
    const netAmount = grossAmount + gstAmount - tdsAmount;

    const payment = await this.dealPaymentRepository.create({
      organizationId: actor.organizationId,
      branchId: deal.branchId,
      dealId: id,
      amount: grossAmount,
      paymentType: paymentData.paymentType,
      paymentMode: paymentData.paymentMode,
      transactionRef: paymentData.transactionRef,
      status: paymentData.status || 'pending',
      paidAt: paymentData.paidAt ? new Date(paymentData.paidAt) : new Date(),
      clearedAt: paymentData.status === 'cleared' ? new Date() : null,
      receiptUrl: paymentData.receiptUrl,
      gstAmount,
      tdsAmount,
      netAmount,
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    deal.timeline.push({
      event: 'payment_added',
      description: `Payment of ₹${grossAmount} (${paymentData.paymentType}) logged. Status: ${payment.status}`,
      performedBy: actor.id,
    });
    await deal.save();

    // If EOI token payment check bounces
    if (paymentData.paymentType === 'token' && payment.status === 'bounced') {
      await this.transitionStage(id, 'token_bounced', actor);
    } else if (paymentData.paymentType === 'token' && payment.status === 'cleared' && deal.unit) {
      // Settle Token EOI: Upgrade lock status to token_locked and extend unit lock to 7 days SLA
      const reservation = await this.dealReservationRepository.findOne({ dealId: id, status: 'temp_locked' });
      if (reservation) {
        const lockedUntil = new Date(Date.now() + 10080 * 60000); // 7 Days
        await this.dealReservationRepository.update(reservation.id, {
          status: 'token_locked',
          lockedDurationMinutes: 10080,
          lockedUntil,
          updatedBy: actor.id,
        });

        await this.projectService.unitRepository.findOneAndUpdate(
          { _id: deal.unit },
          { $set: { lockedUntil, updatedBy: actor.id } }
        );
      }
    }

    await this.logAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'Deal',
      entityId: id,
      userId: actor.id,
      description: `Logged payment of ₹${grossAmount} on Deal ${deal.dealNumber}`,
    });

    return this.getDealById(id, actor);
  }

  async addRefund(id, refundData, actor) {
    const deal = await this.getDealById(id, actor);

    if (!['cancelled', 'booking_defaulted'].includes(deal.status)) {
      throw new BusinessRuleError('Refunds can only be processed on cancelled or defaulted bookings.', 'INVALID_DEAL_STATE');
    }

    if (refundData.refundAmount <= 0) {
      throw new BusinessRuleError('Refund amount must be greater than zero.', 'INVALID_REFUND_AMOUNT');
    }

    // Assert refund + forfeiture does not exceed total cleared deposits
    const { data: clearedPayments } = await this.dealPaymentRepository.paginate({
      dealId: id,
      status: 'cleared',
    }, { limit: 1000 });
    
    const totalDeposited = (clearedPayments || []).reduce((sum, p) => sum + p.amount, 0);
    const proposedTotal = (refundData.refundAmount || 0) + (refundData.forfeitureAmount || 0);

    if (proposedTotal > totalDeposited) {
      throw new BusinessRuleError(
        `Refund + forfeiture amount (₹${proposedTotal}) cannot exceed total cleared payments received (₹${totalDeposited}).`,
        'REFUND_EXCEEDS_DEPOSITS'
      );
    }

    await this.dealCancellationRepository.create({
      organizationId: actor.organizationId,
      branchId: deal.branchId,
      dealId: id,
      cancelledBy: actor.id,
      reason: 'Partial/full cancellation refund settlement',
      cancellationType: 'default',
      forfeitureAmount: refundData.forfeitureAmount || 0,
      refundAmount: refundData.refundAmount,
      refundStatus: refundData.status || 'pending',
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    deal.timeline.push({
      event: 'refund_processed',
      description: `Refund of ₹${refundData.refundAmount} logged as ${refundData.status || 'pending'}`,
      performedBy: actor.id,
    });
    await deal.save();

    return this.getDealById(id, actor);
  }

  async uploadDocument(id, docData, actor) {
    const deal = await this.getDealById(id, actor);

    if (['deal_closed', 'cancelled'].includes(deal.status)) {
      throw new BusinessRuleError('Cannot upload documents to a closed or cancelled deal.', 'DEAL_IMMUTABLE');
    }

    const doc = await this.dealDocumentRepository.findOne({ dealId: id, docType: docData.docType });
    if (doc) {
      await this.dealDocumentRepository.update(doc.id, {
        fileId: docData.fileId,
        status: 'uploaded',
        updatedBy: actor.id,
      });
    } else {
      await this.dealDocumentRepository.create({
        organizationId: actor.organizationId,
        dealId: id,
        docType: docData.docType,
        fileId: docData.fileId,
        status: 'uploaded',
        createdBy: actor.id,
        updatedBy: actor.id,
      });
    }

    deal.timeline.push({
      event: 'document_uploaded',
      description: `Document of type '${docData.docType}' uploaded`,
      performedBy: actor.id,
    });
    await deal.save();

    return this.getDealById(id, actor);
  }

  async verifyDocument(id, docType, actor) {
    const deal = await this.getDealById(id, actor);

    if (['deal_closed', 'cancelled'].includes(deal.status)) {
      throw new BusinessRuleError('Cannot verify documents on a closed or cancelled deal.', 'DEAL_IMMUTABLE');
    }

    const doc = await this.dealDocumentRepository.findOne({ dealId: id, docType });
    if (!doc) {
      throw new NotFoundError(`Document checklist entry of type '${docType}'`, id);
    }

    if (doc.status === 'pending') {
      throw new BusinessRuleError(`Cannot verify document of type '${docType}' because it is not yet uploaded.`, 'DOCUMENT_NOT_UPLOADED');
    }

    await this.dealDocumentRepository.update(doc.id, {
      status: 'verified',
      verifiedBy: actor.id,
      verifiedAt: new Date(),
      updatedBy: actor.id,
    });

    deal.timeline.push({
      event: 'document_verified',
      description: `Document of type '${docType}' verified`,
      performedBy: actor.id,
    });
    await deal.save();

    return this.getDealById(id, actor);
  }

  async transitionStage(id, newStatus, actor, closingPayload = {}) {
    const deal = await this.getDealById(id, actor);

    if (['deal_closed', 'cancelled', 'token_bounced'].includes(deal.status)) {
      throw new BusinessRuleError('Closed, Bounced, and Cancelled deals are permanently locked.', 'DEAL_IMMUTABLE');
    }

    if (deal.status === newStatus) {
      throw new BusinessRuleError(`Deal is already in ${newStatus} state.`, 'DUPLICATE_TRANSITION');
    }

    // 1. Enforce gate validations
    if (newStatus === 'token_received') {
      const hasToken = await this.dealPaymentRepository.exists({
        dealId: id,
        paymentType: 'token',
        status: 'cleared',
      });
      if (!hasToken) {
        throw new BusinessRuleError('A cleared token/EOI payment is required to transition to token_received.', 'TOKEN_PAYMENT_REQUIRED');
      }
    }

    if (newStatus === 'booking_initiated') {
      const hasBookingDeposit = await this.dealPaymentRepository.exists({
        dealId: id,
        paymentType: 'booking_deposit',
        status: 'cleared',
      });
      if (!hasBookingDeposit) {
        throw new BusinessRuleError('A cleared 10% booking deposit payment is required.', 'BOOKING_DEPOSIT_REQUIRED');
      }
      const bookingForm = await this.dealDocumentRepository.findOne({ dealId: id, docType: 'booking_form' });
      if (!bookingForm || !['uploaded', 'verified'].includes(bookingForm.status)) {
        throw new BusinessRuleError('A signed booking application form is required.', 'BOOKING_FORM_REQUIRED');
      }

      // Convert unit reservation status atomically
      if (deal.unit) {
        await this.convertReservationToBooking(id, actor);
      }
    }

    if (newStatus === 'loan_disputed') {
      if (deal.unit) {
        const lockedUntil = new Date(Date.now() + 21600 * 60000); // 15 Days SLA lock
        await this.projectService.unitRepository.findOneAndUpdate(
          { _id: deal.unit },
          { $set: { lockedUntil, updatedBy: actor.id } }
        );
      }
    }

    if (newStatus === 'booking_confirmed') {
      const allotmentLetter = await this.dealDocumentRepository.findOne({ dealId: id, docType: 'allotment_letter' });
      if (!allotmentLetter || allotmentLetter.status !== 'verified') {
        throw new BusinessRuleError('A verified Allotment Letter from the developer is required.', 'ALLOTMENT_LETTER_REQUIRED');
      }
    }

    if (newStatus === 'agreement_executed') {
      const ats = await this.dealDocumentRepository.findOne({ dealId: id, docType: 'ats' });
      if (!ats || ats.status !== 'verified') {
        throw new BusinessRuleError('A verified Agreement to Sale (ATS) is required.', 'ATS_REQUIRED');
      }
    }

    if (newStatus === 'registration_completed') {
      const saleDeed = await this.dealDocumentRepository.findOne({ dealId: id, docType: 'sale_deed' });
      if (!saleDeed || saleDeed.status !== 'verified') {
        throw new BusinessRuleError('A verified Registered Sale Deed is required.', 'SALE_DEED_REQUIRED');
      }

      if (deal.unit) {
        await this.projectService.markUnitSold(deal.unit, {
          soldToCustomerId: deal.customer,
          soldPrice: deal.agreedPrice || deal.askingPrice,
          soldDate: new Date(),
        }, actor);
      } else if (deal.property) {
        await this.propertyService.markSold(deal.property, actor);
      }
    }

    if (['cancelled', 'token_bounced'].includes(newStatus)) {
      deal.cancelledAt = new Date();
      deal.cancellationReason = this.cancellationReason || 'Aborted transaction or client default';

      await this.releaseReservation(id, actor);

      await this.dealCancellationRepository.create({
        organizationId: actor.organizationId,
        branchId: deal.branchId,
        dealId: id,
        cancelledBy: actor.id,
        reason: deal.cancellationReason,
        cancellationType: 'default',
        createdBy: actor.id,
        updatedBy: actor.id,
      });
    }

    if (newStatus === 'deal_closed') {
      deal.closedAt = closingPayload?.closingDate ? new Date(closingPayload.closingDate) : new Date();
      if (closingPayload?.finalPropertyValue) {
        deal.dealValue = Number(closingPayload.finalPropertyValue);
        deal.agreedPrice = Number(closingPayload.finalPropertyValue);
      }
      try {
        const { CommissionService } = require('../commission/commission.service');
        const commissionService = new CommissionService();
        await commissionService.autoCreateFromDeal(deal.id, closingPayload?.commissionInfo || closingPayload || {}, actor);
      } catch (err) {
        console.warn('[DealService] Auto-commission creation notice:', err.message);
      }
    }

    // Compute stage transition history duration metrics
    const latestHistory = await this.dealStageHistoryRepository.findOne(
      { dealId: id },
      { sort: { changedAt: -1 } }
    );
    const durationInMinutes = latestHistory
      ? Math.round((Date.now() - latestHistory.changedAt.getTime()) / 60000)
      : 0;

    await this.dealStageHistoryRepository.create({
      organizationId: actor.organizationId,
      dealId: id,
      previousStage: deal.status,
      newStage: newStatus,
      changedBy: actor.id,
      durationInMinutes,
    });

    // Auto-calculate agent commission splits upon reaching eligibility milestones (splits calculated on Gross Base, with individual TDS applied)
    if (['commission_eligible', 'registration_completed', 'demand_milestones', 'invoice_raised'].includes(newStatus)) {
      const finalValue = deal.agreedPrice || deal.askingPrice;
      const pct = deal.commissionPercentage || 3;
      const totalBrokerage = finalValue * (pct / 100);

      deal.commissionPercentage = pct;
      deal.commissionAmount = totalBrokerage;

      const sourcingAgentAmount = totalBrokerage * 0.30;
      const sourcingAgentTds = sourcingAgentAmount * 0.05;
      const sourcingAgentNet = sourcingAgentAmount - sourcingAgentTds;

      const closingAgentAmount = totalBrokerage * 0.10;
      const closingAgentTds = closingAgentAmount * 0.05;
      const closingAgentNet = closingAgentAmount - closingAgentTds;

      const teamLeaderId = deal.teamLeader || null;
      const teamLeaderPercentage = teamLeaderId ? 2 : 0;
      const teamLeaderAmount = teamLeaderId ? totalBrokerage * 0.02 : 0;
      const teamLeaderTds = teamLeaderAmount * 0.05;
      const teamLeaderNet = teamLeaderAmount - teamLeaderTds;

      const companyShare = totalBrokerage - (sourcingAgentAmount + closingAgentAmount + teamLeaderAmount);

      deal.splits = {
        sourcingAgentId: deal.sourcingAgent,
        sourcingAgentPercentage: 30,
        sourcingAgentAmount,
        sourcingAgentTds,
        sourcingAgentNet,
        closingAgentId: deal.closingAgent || deal.broker,
        closingAgentPercentage: 10,
        closingAgentAmount,
        closingAgentTds,
        closingAgentNet,
        teamLeaderId,
        teamLeaderPercentage,
        teamLeaderAmount,
        teamLeaderTds,
        teamLeaderNet,
        companyShare,
      };
    }

    deal.status = newStatus;
    deal.timeline.push({
      event: 'stage_transitioned',
      description: `Deal stage transitioned to '${newStatus}'`,
      performedBy: actor.id,
    });
    deal.updatedBy = actor.id;

    await deal.save();

    await this.publishEvent(EVENTS.DEAL_UPDATED, { dealId: deal.id, status: newStatus });
    if (newStatus === 'deal_closed') {
      await this.publishEvent(EVENTS.DEAL_CLOSED, { dealId: deal.id });
    }
    await this.logAudit({
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      entity: 'Deal',
      entityId: id,
      userId: actor.id,
      newValues: { status: newStatus },
      description: `Deal ${deal.dealNumber} transitioned to stage ${newStatus}`,
    });

    return this.getDealById(id, actor);
  }
}

module.exports = { DealService };
