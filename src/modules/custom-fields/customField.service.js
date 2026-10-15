'use strict';

const { CustomField } = require('./customField.model');
const { getStandardFields, isStandardField } = require('./standardFieldsCatalog');
const { BusinessRuleError } = require('../../shared/errors');

class CustomFieldService {
  async listFields({ module, includeInactive = false, includeStandard = true }, actor) {
    const orgId = actor.organizationId;
    const filter = { organizationId: orgId };
    if (module && module !== 'all') {
      filter.module = module;
    }
    if (!includeInactive) {
      filter.isActive = true;
    }
    const customFields = await CustomField.find(filter).sort({ order: 1, createdAt: 1 }).lean();
    const formattedCustom = customFields.map(f => ({ ...f, isStandard: false }));

    if (includeStandard !== false && includeStandard !== 'false') {
      if (module && module !== 'all') {
        const standardFields = getStandardFields(module);
        return [...standardFields, ...formattedCustom];
      }
      const standardLeads = getStandardFields('leads');
      const standardStudents = getStandardFields('students');
      return [...standardLeads, ...standardStudents, ...formattedCustom];
    }

    return formattedCustom;
  }

  async createField(data, actor) {
    const orgId = actor.organizationId;
    const label = String(data.label || '').trim();
    if (!label) {
      throw new BusinessRuleError('Field label is required');
    }

    let key = String(data.key || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '');
    
    if (!key) {
      key = label.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
    }

    const module = data.module || 'leads';
    if (isStandardField(module, key)) {
      throw new BusinessRuleError(`"${key}" is already a built-in standard field for ${module}. Custom fields must use unique keys.`);
    }

    const existing = await CustomField.findOne({
      organizationId: orgId,
      module,
      key,
    });

    if (existing) {
      throw new BusinessRuleError(`A custom field with API key "${key}" already exists for this object`);
    }

    const type = data.type || 'text';
    let options = [];
    if (type === 'select') {
      if (Array.isArray(data.options)) {
        options = data.options.map((o) => String(o).trim()).filter(Boolean);
      } else if (typeof data.options === 'string') {
        options = data.options.split(',').map((o) => o.trim()).filter(Boolean);
      }
      if (options.length === 0) {
        throw new BusinessRuleError('Dropdown options are required when field type is options (dropdown)');
      }
    }

    const field = await CustomField.create({
      organizationId: orgId,
      tenantId: actor.tenantId || null,
      module,
      label,
      key,
      type,
      options,
      required: Boolean(data.required),
      placeholder: data.placeholder || '',
      helpText: data.helpText || '',
      order: Number(data.order) || 0,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    return field;
  }

  async updateField(id, data, actor) {
    if (String(id).startsWith('std_')) {
      throw new BusinessRuleError('Standard system fields cannot be modified.');
    }
    const orgId = actor.organizationId;
    const field = await CustomField.findOne({ _id: id, organizationId: orgId });
    if (!field) {
      throw new BusinessRuleError('Custom field not found');
    }

    if (data.label !== undefined) field.label = String(data.label).trim();
    if (data.required !== undefined) field.required = Boolean(data.required);
    if (data.placeholder !== undefined) field.placeholder = String(data.placeholder).trim();
    if (data.helpText !== undefined) field.helpText = String(data.helpText).trim();
    if (data.order !== undefined) field.order = Number(data.order);
    if (data.isActive !== undefined) field.isActive = Boolean(data.isActive);

    if (data.type !== undefined) {
      field.type = data.type;
    }

    if (field.type === 'select' && data.options !== undefined) {
      if (Array.isArray(data.options)) {
        field.options = data.options.map((o) => String(o).trim()).filter(Boolean);
      } else if (typeof data.options === 'string') {
        field.options = data.options.split(',').map((o) => o.trim()).filter(Boolean);
      }
    }

    field.updatedBy = actor.id;
    await field.save();
    return field;
  }

  async deleteField(id, actor) {
    if (String(id).startsWith('std_')) {
      throw new BusinessRuleError('Standard system fields cannot be deleted.');
    }
    const orgId = actor.organizationId;
    const field = await CustomField.findOne({ _id: id, organizationId: orgId });
    if (!field) {
      throw new BusinessRuleError('Custom field not found');
    }
    await CustomField.deleteOne({ _id: id });
    return { success: true, message: 'Custom field deleted successfully' };
  }
}

module.exports = { CustomFieldService };

