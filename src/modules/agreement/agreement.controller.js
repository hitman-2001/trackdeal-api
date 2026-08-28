'use strict';

const { BaseController } = require('../../shared/base/BaseController');
const { AgreementService } = require('./agreement.service');

class AgreementController extends BaseController {
  constructor(deps = {}) {
    const service = deps.agreementService || new AgreementService();
    super({ service, logger: deps.logger || console });
    this.agreementService = service;
  }

  listTemplates = async (req, reply) => {
    const templates = await this.agreementService.listTemplates(this.getUser(req));
    return this.ok(reply, templates, 'Templates retrieved successfully');
  };

  getTemplateById = async (req, reply) => {
    const template = await this.agreementService.getTemplateById(req.params.id);
    return this.ok(reply, template, 'Template details retrieved');
  };

  createTemplate = async (req, reply) => {
    const template = await this.agreementService.createTemplate(req.body, this.getUser(req));
    return this.created(reply, template, 'Template created successfully');
  };

  list = async (req, reply) => {
    const result = await this.agreementService.listAgreements(req.query, this.getUser(req));
    return reply.send({
      success: true,
      data: result.data,
      pagination: result.pagination,
      summary: result.summary,
      message: 'Agreements retrieved successfully',
    });
  };

  getById = async (req, reply) => {
    const agreement = await this.agreementService.getAgreementById(req.params.id, this.getUser(req));
    return this.ok(reply, agreement, 'Agreement retrieved successfully');
  };

  create = async (req, reply) => {
    const agreement = await this.agreementService.createAgreement(req.body, this.getUser(req));
    return this.created(reply, agreement, 'Agreement generated successfully');
  };

  updateStructuredDetails = async (req, reply) => {
    const agreement = await this.agreementService.updateStructuredDetails(req.params.id, req.body, this.getUser(req));
    return this.ok(reply, agreement, 'Agreement details updated and recompiled successfully');
  };

  updateClauses = async (req, reply) => {
    const agreement = await this.agreementService.updateClauses(req.params.id, req.body, this.getUser(req));
    return this.ok(reply, agreement, 'Agreement clauses updated successfully');
  };

  addCustomClause = async (req, reply) => {
    const agreement = await this.agreementService.addCustomClause(req.params.id, req.body, this.getUser(req));
    return this.ok(reply, agreement, 'Custom clause inserted successfully');
  };

  resetClause = async (req, reply) => {
    const agreement = await this.agreementService.resetClause(req.params.id, req.params.clauseId, this.getUser(req));
    return this.ok(reply, agreement, 'Clause reset to master template successfully');
  };

  resetFullAgreement = async (req, reply) => {
    const agreement = await this.agreementService.resetFullAgreement(req.params.id, this.getUser(req));
    return this.ok(reply, agreement, 'Full agreement reset to master template successfully');
  };

  duplicate = async (req, reply) => {
    const duplicate = await this.agreementService.duplicateAgreement(req.params.id, this.getUser(req));
    return this.created(reply, duplicate, 'Agreement duplicated successfully');
  };

  updateStatus = async (req, reply) => {
    const agreement = await this.agreementService.updateStatus(req.params.id, req.body.status, this.getUser(req));
    return this.ok(reply, agreement, 'Agreement status updated');
  };

  exportDocx = async (req, reply) => {
    const agreement = await this.agreementService.getAgreementById(req.params.id, this.getUser(req));
    const filename = `${agreement.agreementNumber || 'Agreement'}-${(agreement.structuredData?.transferees?.[0]?.name || 'Buyer').replace(/[^a-zA-Z0-9]/g, '_')}.doc`;

    const pageSettings = agreement.pageSettings || { pageSize: 'a4', orientation: 'portrait', margins: 'normal' };
    let sizeCss = '8.27in 11.69in'; // A4
    if (pageSettings.pageSize === 'legal') sizeCss = '8.5in 14.0in';
    else if (pageSettings.pageSize === 'letter') sizeCss = '8.5in 11.0in';

    let mTop = '1.0in', mBottom = '1.0in', mLeft = '1.0in', mRight = '1.0in';
    if (pageSettings.margins === 'narrow') {
      mTop = mBottom = mLeft = mRight = '0.5in';
    } else if (pageSettings.margins === 'moderate') {
      mTop = mBottom = '1.0in'; mLeft = mRight = '0.75in';
    } else if (pageSettings.margins === 'custom') {
      mTop = `${(pageSettings.marginTop || 25.4) / 25.4}in`;
      mBottom = `${(pageSettings.marginBottom || 25.4) / 25.4}in`;
      mLeft = `${(pageSettings.marginLeft || 25.4) / 25.4}in`;
      mRight = `${(pageSettings.marginRight || 25.4) / 25.4}in`;
    }

    const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>${agreement.agreementNumber}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page Section1 {
          size: ${sizeCss};
          margin: ${mTop} ${mRight} ${mBottom} ${mLeft};
          mso-header-margin: 0.5in;
          mso-footer-margin: 0.5in;
          mso-paper-source: 0;
        }
        div.Section1 { page: Section1; }
        body { font-family: 'Book Antiqua', 'Times New Roman', serif; font-size: 11pt; line-height: 1.7; color: #000; }
        p { text-align: justify; margin: 0 0 12pt 0; text-justify: inter-ideograph; line-height: 1.7; }
        table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
        th, td { border: 1px solid #777; padding: 6pt 8pt; font-size: 10pt; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        h1, h2, h3 { text-align: center; font-family: 'Arial', sans-serif; }
        .page-break { page-break-before: always; mso-break-type: section-break; }
      </style>
    </head>
    <body>
      <div class="Section1">
        ${agreement.compiledHtml}
      </div>
    </body>
    </html>`;

    reply
      .header('Content-Type', 'application/msword')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(htmlContent);
  };
}

module.exports = { AgreementController };
