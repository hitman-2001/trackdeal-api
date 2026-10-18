'use strict';

const field = (key, label, type = 'text', options = {}) => ({
  key,
  label,
  type,
  required: Boolean(options.required),
  options: options.values ? options.values.map(v => typeof v === 'string' ? { label: v, value: v } : v) : [],
  placeholder: options.placeholder || '',
  helpText: options.helpText || '',
  isStandard: true,
  isActive: true,
});

const STANDARD_FIELD_CATALOG = {
  leads: [
    field('firstName', 'First Name', 'text', { required: true, placeholder: 'e.g. Aarav' }),
    field('lastName', 'Last Name', 'text', { required: false, placeholder: 'e.g. Sharma' }),
    field('mobile', 'Primary Mobile', 'text', { required: true, placeholder: 'e.g. 9876543210' }),
    field('alternativeMobile', 'Alternate Phone', 'text', { required: false, placeholder: 'e.g. 9876543299' }),
    field('email', 'Email Address', 'text', { required: false, placeholder: 'student@example.com' }),
    field('schoolName', 'School / College Name', 'text', { required: true, placeholder: 'e.g. Delhi Public School / St. Xavier\'s' }),
    field('institutionType', 'Institution Type', 'select', { values: ['School', 'Private Classes'], placeholder: 'Select Institution Type' }),
    field('educationBoard', 'Education Board', 'select', { values: ['CBSE', 'ICSE', 'State Board'], placeholder: 'Select Board' }),
    field('standard', 'Standard / Grade', 'select', { values: ['8', '9', '10', '11', '12'], placeholder: 'Select Standard / Grade' }),
    field('academicStream', 'Academic Stream', 'select', { values: ['Science', 'Commerce'], placeholder: 'Select Stream' }),
    field('currentCoaching', 'Current Coaching / Private Classes', 'text', { placeholder: 'e.g. Allen, Aakash, Mahesh Tutorials' }),
    field('source', 'Inquiry Source', 'select', { values: ['walk_in', 'website', 'referral', 'whatsapp', 'campus', 'manual_entry'], placeholder: 'Select Source' }),
    field('parentName', 'Parent / Guardian Name', 'text', { required: false, placeholder: 'e.g. Rajesh Sharma' }),
    field('parentMobile', 'Parent Mobile', 'text', { required: false, placeholder: '+91 9876543210' }),
    field('status', 'Lead Stage / Status', 'select', {
      required: true,
      values: ['new', 'contacted', 'interested', 'demo_scheduled', 'demo_completed', 'negotiation', 'enrolled', 'lost'],
      placeholder: 'Select Status'
    }),
    field('subStatus', 'Sub-Status', 'text', { placeholder: 'Stage specific sub-status' }),
    field('assignedTo', 'Assigned Staff', 'text', { placeholder: 'Staff member handling lead' }),
  ],

  students: [
    field('firstName', 'First Name', 'text', { required: true, placeholder: 'e.g. Rahul' }),
    field('lastName', 'Last Name', 'text', { required: false, placeholder: 'e.g. Sharma' }),
    field('mobile', 'Primary Mobile', 'text', { required: true, placeholder: '10-digit mobile' }),
    field('alternativeMobile', 'Alternate Phone', 'text', { required: false, placeholder: 'Alternate phone' }),
    field('email', 'Email Address', 'text', { required: false, placeholder: 'student@example.com' }),
    field('schoolName', 'School / College Name', 'text', { required: true, placeholder: 'e.g. Delhi Public School / St. Xavier\'s College' }),
    field('institutionType', 'Institution Type', 'select', { values: ['School', 'Private Classes'], placeholder: 'Select Institution Type' }),
    field('educationBoard', 'Education Board', 'select', { values: ['CBSE', 'ICSE', 'State Board'], placeholder: 'Select Board' }),
    field('standard', 'Standard / Grade', 'select', { values: ['8', '9', '10', '11', '12'], placeholder: 'Select Standard / Grade' }),
    field('academicStream', 'Academic Stream', 'select', { values: ['Science', 'Commerce'], placeholder: 'Select Stream' }),
    field('currentCoaching', 'Current Coaching / Private Classes', 'text', { placeholder: 'e.g. Allen, Aakash, Mahesh Tutorials' }),
    field('source', 'Inquiry Source', 'select', { values: ['walk_in', 'website', 'referral', 'whatsapp', 'campus', 'manual_entry'], placeholder: 'Select Source' }),
    field('status', 'Student Status', 'select', { required: true, values: ['active', 'inactive', 'graduated', 'dropped'], placeholder: 'Select Status' }),
    field('parentName', 'Parent / Guardian Name', 'text', { required: false, placeholder: 'Parent or guardian name' }),
    field('parentMobile', 'Parent Mobile', 'text', { required: false, placeholder: 'Parent mobile number' }),
    field('notes', 'Academic Notes', 'text', { placeholder: 'Background, goals, or fees schedule' }),
    field('enrollmentDate', 'Enrollment Date', 'text', { required: true, placeholder: 'Date of enrollment' }),
    field('classId', 'Assigned Batch', 'text', { placeholder: 'Academic batch or cohort' }),
  ],
};

function getStandardFields(module) {
  const fields = STANDARD_FIELD_CATALOG[module] || [];
  return fields.map((f, index) => ({
    ...f,
    _id: `std_${module}_${f.key}`,
    module,
    order: index,
  }));
}

function isStandardField(module, key) {
  const fields = STANDARD_FIELD_CATALOG[module] || [];
  return fields.some((f) => f.key === key);
}

module.exports = {
  STANDARD_FIELD_CATALOG,
  getStandardFields,
  isStandardField,
};

