'use strict';

const { CustomField } = require('./customField.model');
const { STANDARD_FIELD_CATALOG } = require('./standardFieldsCatalog');
const { BusinessRuleError } = require('../../shared/errors');

function extractOptionString(o) {
  if (o === null || o === undefined) return '';
  if (typeof o === 'object') {
    return String(o.value || o.label || o.name || o.text || '').trim();
  }
  return String(o).trim();
}

function sanitizeOptions(options) {
  if (!Array.isArray(options)) return [];
  return options
    .map(extractOptionString)
    .filter((o) => o && o !== '[object Object]');
}

class CustomFieldService {
  async ensureStandardFieldsSeeded(orgId, actor) {
    if (!orgId) return;
    for (const mod of ['leads', 'students']) {
      const catalog = STANDARD_FIELD_CATALOG[mod] || [];
      for (let i = 0; i < catalog.length; i++) {
        const item = catalog[i];
        const existing = await CustomField.findOne({
          organizationId: orgId,
          module: mod,
          key: item.key,
        });

        if (!existing) {
          const rawOptions = (item.options || []).map((o) =>
            typeof o === 'object' ? o.value || o.label : o
          );

          await CustomField.create({
            organizationId: orgId,
            tenantId: actor.tenantId || null,
            module: mod,
            label: item.label,
            key: item.key,
            type: item.type,
            options: sanitizeOptions(rawOptions),
            required: Boolean(item.required),
            placeholder: item.placeholder || '',
            helpText: item.helpText || '',
            order: i,
            isActive: true,
            isStandard: true,
            isSystemLocked: ['firstName', 'mobile'].includes(item.key),
            createdBy: actor.id || null,
            updatedBy: actor.id || null,
          });
        }
      }
    }
  }

  async listFields({ module, includeInactive = false, includeStandard = true }, actor) {
    const orgId = actor.organizationId;
    if (includeStandard !== false && includeStandard !== 'false') {
      await this.ensureStandardFieldsSeeded(orgId, actor);
    }

    const filter = { organizationId: orgId };
    if (module && module !== 'all') {
      filter.module = module;
    }
    if (!includeInactive) {
      filter.isActive = true;
    }

    const fields = await CustomField.find(filter).sort({ order: 1, createdAt: 1 }).lean();
    return fields.map((f) => ({
      ...f,
      options: sanitizeOptions(f.options),
    }));
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
    const existing = await CustomField.findOne({
      organizationId: orgId,
      module,
      key,
    });

    if (existing) {
      throw new BusinessRuleError(`A field with key "${key}" already exists for ${module}`);
    }

    const type = data.type || 'text';
    let options = [];
    if (type === 'select') {
      if (Array.isArray(data.options)) {
        options = data.options.map(extractOptionString).filter((o) => o && o !== '[object Object]');
      } else if (typeof data.options === 'string') {
        options = data.options.split(',').map((o) => o.trim()).filter((o) => o && o !== '[object Object]');
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
      isStandard: false,
      isSystemLocked: false,
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    return field;
  }

  async updateField(id, data, actor) {
    const orgId = actor.organizationId;
    let field = null;

    if (String(id).startsWith('std_')) {
      const parts = String(id).split('_');
      const mod = parts[1];
      const key = parts.slice(2).join('_');
      field = await CustomField.findOne({ organizationId: orgId, module: mod, key });
    } else {
      field = await CustomField.findOne({ _id: id, organizationId: orgId });
    }

    if (!field) {
      throw new BusinessRuleError('Field not found');
    }

    if (data.label !== undefined) field.label = String(data.label).trim();
    if (!field.isSystemLocked && data.required !== undefined) {
      field.required = Boolean(data.required);
    }
    if (data.placeholder !== undefined) field.placeholder = String(data.placeholder).trim();
    if (data.helpText !== undefined) field.helpText = String(data.helpText).trim();
    if (data.order !== undefined) field.order = Number(data.order);
    if (!field.isSystemLocked && data.isActive !== undefined) {
      field.isActive = Boolean(data.isActive);
    }

    if (data.type !== undefined && !field.isSystemLocked) {
      field.type = data.type;
    }

    if (field.type === 'select' && data.options !== undefined) {
      if (Array.isArray(data.options)) {
        field.options = data.options.map(extractOptionString).filter((o) => o && o !== '[object Object]');
      } else if (typeof data.options === 'string') {
        field.options = data.options.split(',').map((o) => o.trim()).filter((o) => o && o !== '[object Object]');
      }
    }

    field.updatedBy = actor.id;
    await field.save();
    return field;
  }

  async deleteField(id, actor) {
    const orgId = actor.organizationId;
    let field = null;

    if (String(id).startsWith('std_')) {
      const parts = String(id).split('_');
      const mod = parts[1];
      const key = parts.slice(2).join('_');
      field = await CustomField.findOne({ organizationId: orgId, module: mod, key });
    } else {
      field = await CustomField.findOne({ _id: id, organizationId: orgId });
    }

    if (!field) {
      throw new BusinessRuleError('Field not found');
    }

    if (field.isSystemLocked) {
      throw new BusinessRuleError('Core identity fields (Name, Mobile) cannot be deleted, but you can customize their labels and placeholders.');
    }

    await CustomField.deleteOne({ _id: field._id });
    return { success: true, message: 'Field deleted successfully' };
  }
}

module.exports = { CustomFieldService };

