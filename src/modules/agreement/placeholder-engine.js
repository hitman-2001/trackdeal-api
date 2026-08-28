'use strict';

/**
 * Utility functions for Agreement Placeholder Interpolation,
 * Indian Currency Numbers-to-Words formatting, and dynamic legal sections compilation.
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

function convertLessThanOneThousand(num) {
  let current;
  if (num % 100 < 20) {
    current = ONES[num % 100];
    num = Math.floor(num / 100);
  } else {
    current = ONES[num % 10];
    num = Math.floor(num / 10);
    current = TENS[num % 10] + (current ? ' ' + current : '');
    num = Math.floor(num / 10);
  }
  if (num === 0) return current;
  return ONES[num] + ' Hundred' + (current ? ' and ' + current : '');
}

/**
 * Converts a numeric amount to Indian Rupee Words format (Crores, Lakhs, Thousands, Hundreds).
 * e.g., 3275000 -> "Rupees Thirty Two Lakhs Seventy Five Thousand Only"
 */
function numberToIndianWords(amount) {
  const num = Math.round(Number(amount) || 0);
  if (num === 0) return 'Rupees Zero Only';

  let remaining = num;
  let words = '';

  // Crores
  const crores = Math.floor(remaining / 10000000);
  if (crores > 0) {
    words += convertLessThanOneThousand(crores) + ' Crore ';
    remaining %= 10000000;
  }

  // Lakhs
  const lakhs = Math.floor(remaining / 100000);
  if (lakhs > 0) {
    words += convertLessThanOneThousand(lakhs) + ' Lakh' + (lakhs > 1 ? 's ' : ' ');
    remaining %= 100000;
  }

  // Thousands
  const thousands = Math.floor(remaining / 1000);
  if (thousands > 0) {
    words += convertLessThanOneThousand(thousands) + ' Thousand ';
    remaining %= 1000;
  }

  // Hundreds & Below
  if (remaining > 0) {
    words += convertLessThanOneThousand(remaining);
  }

  return 'Rupees ' + words.trim() + ' Only';
}

/**
 * Format Date in Indian Legal style (e.g. "23rd day of August, 2026")
 */
function formatLegalDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const day = d.getDate();
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = day % 100;
  const suffix = suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0];
  const monthName = d.toLocaleString('en-US', { month: 'long' });
  const year = d.getFullYear();

  return `${day}${suffix} day of ${monthName}, ${year}`;
}

/**
 * Builds the Transferor(s) party description block
 */
function buildTransferorsBlock(transferors = []) {
  if (!transferors || transferors.length === 0) {
    return '<b>[TRANSFEROR NAME / DETAILS]</b>';
  }

  const isPlural = transferors.length > 1;
  const listText = transferors.map((t, idx) => {
    const ageText = t.age ? `, aged about ${t.age} years` : '';
    const panText = t.pan ? `, holding PAN <b>${t.pan}</b>` : '';
    const occText = t.occupation ? `, Occ: ${t.occupation}` : '';
    const addr = t.address ? `, residing at ${t.address}${t.city ? ', ' + t.city : ''}${t.pin ? ' - ' + t.pin : ''}` : '';
    const numPrefix = isPlural ? `(${idx + 1}) ` : '';
    return `${numPrefix}<b>${(t.name || 'Transferor Name').toUpperCase()}</b>${ageText}${occText}${panText}${addr}`;
  }).join(';<br/><br/>and<br/><br/>');

  const designation = isPlural
    ? '(hereinafter collectively referred to as the <b>"TRANSFERORS"</b>, which expression shall unless it be repugnant to the context or meaning thereof be deemed to mean and include their respective legal heirs, executors, administrators, and assigns)'
    : '(hereinafter referred to as the <b>"TRANSFEROR"</b>, which expression shall unless it be repugnant to the context or meaning thereof be deemed to mean and include his/her legal heirs, executors, administrators, and assigns)';

  return `${listText}<br/><br/>${designation} of the <b>ONE PART</b>;`;
}

/**
 * Builds the Transferee(s) party description block
 */
function buildTransfereesBlock(transferees = []) {
  if (!transferees || transferees.length === 0) {
    return '<b>[TRANSFEREE NAME / DETAILS]</b>';
  }

  const isPlural = transferees.length > 1;
  const listText = transferees.map((t, idx) => {
    const ageText = t.age ? `, aged about ${t.age} years` : '';
    const panText = t.pan ? `, holding PAN <b>${t.pan}</b>` : '';
    const occText = t.occupation ? `, Occ: ${t.occupation}` : '';
    const addr = t.address ? `, residing at ${t.address}${t.city ? ', ' + t.city : ''}${t.pin ? ' - ' + t.pin : ''}` : '';
    const numPrefix = isPlural ? `(${idx + 1}) ` : '';
    return `${numPrefix}<b>${(t.name || 'Transferee Name').toUpperCase()}</b>${ageText}${occText}${panText}${addr}`;
  }).join(';<br/><br/>and<br/><br/>');

  const designation = isPlural
    ? '(hereinafter collectively referred to as the <b>"TRANSFEREES"</b>, which expression shall unless it be repugnant to the context or meaning thereof be deemed to mean and include their respective legal heirs, executors, administrators, and assigns)'
    : '(hereinafter referred to as the <b>"TRANSFEREE"</b>, which expression shall unless it be repugnant to the context or meaning thereof be deemed to mean and include his/her legal heirs, executors, administrators, and assigns)';

  return `${listText}<br/><br/>${designation} of the <b>OTHER PART</b>;`;
}

/**
 * Builds dynamic payment schedule HTML table
 */
function buildPaymentScheduleTable(payments = [], totalConsideration = 0) {
  if (!payments || payments.length === 0) {
    return `<div class="payment-table-empty text-slate-400 italic py-2">No payment tranche entries recorded.</div>`;
  }

  let totalPaid = 0;
  const rows = payments.map((p, idx) => {
    const amt = Number(p.amount) || 0;
    totalPaid += amt;
    const dateStr = p.date ? new Date(p.date).toLocaleDateString('en-IN') : '—';
    return `<tr>
      <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center;">${idx + 1}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">${dateStr}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: bold; font-family: monospace;">₹${amt.toLocaleString('en-IN')}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">${p.mode || 'Bank Transfer'}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">${p.bankName || '—'}${p.branch ? ' (' + p.branch + ')' : ''}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-family: monospace;">${p.referenceNumber || '—'}</td>
    </tr>`;
  }).join('');

  const balance = Math.max(0, (Number(totalConsideration) || 0) - totalPaid);

  return `
  <table style="width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11pt; border: 1px solid #cbd5e1;">
    <thead>
      <tr style="background-color: #f1f5f9; font-weight: bold; text-align: left;">
        <th style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; width: 40px;">#</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 100px;">Date</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 130px;">Amount</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 110px;">Mode</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px 10px;">Bank & Branch</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 140px;">Ref / Chq / UTR No.</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr style="background-color: #f8fafc; font-weight: bold;">
        <td colspan="2" style="border: 1px solid #cbd5e1; padding: 8px 10px; text-align: right;">TOTAL PAID:</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px 10px; font-family: monospace; color: #059669;">₹${totalPaid.toLocaleString('en-IN')}</td>
        <td colspan="3" style="border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 10pt; color: #475569;">(${numberToIndianWords(totalPaid)})</td>
      </tr>
      ${balance > 0 ? `
      <tr style="background-color: #fffbeb; font-weight: bold;">
        <td colspan="2" style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; color: #b45309;">BALANCE DUE:</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-family: monospace; color: #b45309;">₹${balance.toLocaleString('en-IN')}</td>
        <td colspan="3" style="border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 10pt; color: #92400e;">(Payable upon registration & handover of vacant physical possession)</td>
      </tr>` : ''}
    </tbody>
  </table>`;
}

/**
 * Builds the Signatures Block
 */
function buildSignaturesBlock(transferors = [], transferees = [], witnesses = []) {
  const transferorLines = (transferors.length > 0 ? transferors : [{ name: 'Transferor' }]).map((t, idx) => {
    return `
    <div style="margin-top: 28px; width: 45%; display: inline-block; vertical-align: top;">
      <div style="border-bottom: 1px solid #000; width: 80%; height: 35px; margin-bottom: 6px;"></div>
      <div style="font-weight: bold; font-size: 11pt;">${t.name ? t.name.toUpperCase() : `Transferor ${idx + 1}`}</div>
      <div style="font-size: 9pt; color: #475569;">(${t.pan ? 'PAN: ' + t.pan : 'TRANSFEROR'})</div>
    </div>`;
  }).join('');

  const transfereeLines = (transferees.length > 0 ? transferees : [{ name: 'Transferee' }]).map((t, idx) => {
    return `
    <div style="margin-top: 28px; width: 45%; display: inline-block; vertical-align: top;">
      <div style="border-bottom: 1px solid #000; width: 80%; height: 35px; margin-bottom: 6px;"></div>
      <div style="font-weight: bold; font-size: 11pt;">${t.name ? t.name.toUpperCase() : `Transferee ${idx + 1}`}</div>
      <div style="font-size: 9pt; color: #475569;">(${t.pan ? 'PAN: ' + t.pan : 'TRANSFEREE'})</div>
    </div>`;
  }).join('');

  const witnessLines = (witnesses && witnesses.length > 0 ? witnesses : [
    { name: '1. ____________________________', address: 'Address: ____________________________' },
    { name: '2. ____________________________', address: 'Address: ____________________________' }
  ]).map((w, idx) => {
    return `
    <div style="margin-top: 20px; font-size: 10.5pt; line-height: 1.6;">
      <div><b>${w.name || (idx + 1) + '. ____________________________'}</b></div>
      <div style="color: #475569; font-size: 9.5pt;">${w.address || 'Address: ____________________________'}</div>
    </div>`;
  }).join('');

  return `
  <div style="margin-top: 30px; page-break-inside: avoid;">
    <div style="font-size: 11pt; font-weight: bold; margin-bottom: 15px;">
      IN WITNESS WHEREOF the parties hereto have set and subscribed their respective hands to this writing the day and year first hereinabove written.
    </div>

    <div style="margin-top: 20px;">
      <div style="font-size: 11pt; font-weight: bold; text-decoration: underline;">SIGNED AND DELIVERED BY THE WITHIN NAMED TRANSFEROR(S):</div>
      <div>${transferorLines}</div>
    </div>

    <div style="margin-top: 30px;">
      <div style="font-size: 11pt; font-weight: bold; text-decoration: underline;">SIGNED AND DELIVERED BY THE WITHIN NAMED TRANSFEREE(S):</div>
      <div>${transfereeLines}</div>
    </div>

    <div style="margin-top: 35px; border-top: 1px solid #cbd5e1; pt: 15px;">
      <div style="font-size: 11pt; font-weight: bold; margin-top: 15px; text-decoration: underline;">IN THE PRESENCE OF WITNESSES:</div>
      <div>${witnessLines}</div>
    </div>
  </div>`;
}

/**
 * Builds the Receipt section
 */
function buildReceiptSection(data = {}) {
  const consideration = Number(data.consideration?.totalAmount) || 0;
  const considerationWords = numberToIndianWords(consideration);
  const transferorNames = (data.transferors || []).map(t => t.name).filter(Boolean).join(' and ') || 'the Transferor(s)';
  const transfereeNames = (data.transferees || []).map(t => t.name).filter(Boolean).join(' and ') || 'the Transferee(s)';
  const flatNo = data.property?.flatNumber || '____';
  const societyName = data.property?.societyName || data.property?.buildingName || '________________';

  const paymentsTable = buildPaymentScheduleTable(data.payments || [], consideration);

  return `
  <div style="margin-top: 35px; padding-top: 20px; border-top: 2px dashed #94a3b8; page-break-inside: avoid;">
    <div style="text-align: center; font-size: 14pt; font-weight: bold; text-decoration: underline; margin-bottom: 12px;">
      MEMORANDUM OF RECEIPT
    </div>

    <p style="text-align: justify; line-height: 1.6; font-size: 11pt;">
      RECEIVED of and from the within named Transferee(s), <b>${transfereeNames.toUpperCase()}</b>, the sum of <b>₹${consideration.toLocaleString('en-IN')}</b> (${considerationWords}), being the full and final agreed consideration amount for the transfer and sale of Flat No. <b>${flatNo}</b> in <b>${societyName}</b>, as per the payment schedule set out below:
    </p>

    ${paymentsTable}

    <div style="margin-top: 30px; text-align: right;">
      <div style="border-bottom: 1px solid #000; width: 220px; display: inline-block; height: 35px; margin-bottom: 6px;"></div>
      <div style="font-weight: bold; font-size: 11pt;">(${transferorNames.toUpperCase()})</div>
      <div style="font-size: 9.5pt; color: #475569;">TRANSFEROR(S) / RECIPIENT(S)</div>
    </div>

    <div style="margin-top: 25px;">
      <div style="font-size: 10.5pt; font-weight: bold;">WITNESSES:</div>
      <div style="margin-top: 10px; line-height: 1.8; font-size: 10pt;">
        1. __________________________________________<br/>
        2. __________________________________________
      </div>
    </div>
  </div>`;
}

/**
 * Builds the Schedule of Property section
 */
function buildPropertySchedule(prop = {}) {
  return `
  <div style="border: 1px solid #cbd5e1; background-color: #f8fafc; padding: 16px; border-radius: 6px; font-size: 11pt; line-height: 1.7; margin-top: 10px;">
    <b>ALL THAT PIECE AND PARCEL</b> of Residential Unit / Flat bearing No. <b>${prop.flatNumber || '____'}</b>, situated on the <b>${prop.floor || '____'}</b> Floor, Wing <b>${prop.wing || '____'}</b>, in the building known as <b>"${prop.buildingName || prop.societyName || '________________'}"</b>,
    admeasuring RERA Carpet Area of <b>${prop.carpetArea || '____'} sq. ft.</b> (equivalent to <b>${prop.builtUpArea || '____'} sq. ft.</b> Built-up Area),
    constructed on the land bearing Survey No(s). <b>${prop.surveyNumbers || '____'}</b>, Hissa No. <b>${prop.hissaNumber || '____'}</b>, CTS No. <b>${prop.ctsNumber || '____'}</b>,
    of Village <b>${prop.village || '____'}</b>, Taluka <b>${prop.taluka || '____'}</b>, District <b>${prop.district || 'Pune'}</b>,
    under the jurisdiction of <b>${prop.municipalCorporation || 'Municipal Corporation'}</b> and within the registration district and sub-district of Sub-Registrar <b>${prop.subRegistrarOffice || 'Haveli'}</b>,
    together with 5 (five) fully paid-up Shares of <b>${prop.societyName || 'The Co-operative Housing Society'}</b> bearing Share Certificate No. <b>${prop.shareCertificateNumber || '____'}</b> and Distinctive Numbers from <b>${prop.shareNumbersFrom || '____'}</b> to <b>${prop.shareNumbersTo || '____'}</b> (both inclusive).
  </div>`;
}

/**
 * Main Placeholder Interpolator
 * Replaces all registered placeholder keys across clauses
 */
function compileAgreementContent(templateClauses = [], structuredData = {}) {
  const p = structuredData.property || {};
  const c = structuredData.consideration || {};
  const a = structuredData.agreement || {};
  const transferors = structuredData.transferors || [];
  const transferees = structuredData.transferees || [];
  const payments = structuredData.payments || [];
  const witnesses = structuredData.witnesses || [];

  const totalConsideration = Number(c.totalAmount) || 0;
  const considerationWords = c.amountInWords || numberToIndianWords(totalConsideration);

  const transferor1 = transferors[0] || {};
  const transferee1 = transferees[0] || {};

  // Build dictionary of replacement tags
  const placeholderMap = {
    // Agreement metadata
    '{{agreement_date}}': a.agreementDate ? formatLegalDate(a.agreementDate) : formatLegalDate(new Date()),
    '{{agreement_place}}': a.agreementPlace || p.city || 'Pune',
    '{{jurisdiction_city}}': a.jurisdictionCity || p.city || 'Pune',

    // Parties
    '{{transferors_block}}': buildTransferorsBlock(transferors),
    '{{transferees_block}}': buildTransfereesBlock(transferees),
    '{{transferor_1_name}}': transferor1.name || '',
    '{{transferor_1_pan}}': transferor1.pan || '',
    '{{transferor_1_age}}': transferor1.age ? String(transferor1.age) : '',
    '{{transferor_1_address}}': transferor1.address || '',
    '{{transferee_1_name}}': transferee1.name || '',
    '{{transferee_1_pan}}': transferee1.pan || '',
    '{{transferee_1_age}}': transferee1.age ? String(transferee1.age) : '',
    '{{transferee_1_address}}': transferee1.address || '',
    '{{all_transferor_names}}': transferors.map(t => t.name).filter(Boolean).join(', '),
    '{{all_transferee_names}}': transferees.map(t => t.name).filter(Boolean).join(', '),

    // Property
    '{{flat_number}}': p.flatNumber || '',
    '{{floor}}': p.floor || '',
    '{{wing}}': p.wing || '',
    '{{building_name}}': p.buildingName || '',
    '{{project_name}}': p.projectName || p.buildingName || '',
    '{{society_name}}': p.societyName || p.buildingName || '',
    '{{society_registration_number}}': p.societyRegistrationNumber || '',
    '{{society_registration_date}}': p.societyRegistrationDate ? new Date(p.societyRegistrationDate).toLocaleDateString('en-IN') : '',
    '{{carpet_area}}': p.carpetArea ? String(p.carpetArea) : '',
    '{{built_up_area}}': p.builtUpArea ? String(p.builtUpArea) : '',
    '{{survey_numbers}}': p.surveyNumbers || '',
    '{{cts_number}}': p.ctsNumber || '',
    '{{village}}': p.village || '',
    '{{taluka}}': p.taluka || '',
    '{{district}}': p.district || 'Pune',
    '{{sub_registrar_office}}': p.subRegistrarOffice || '',
    '{{share_certificate_number}}': p.shareCertificateNumber || '',
    '{{share_numbers_from}}': p.shareNumbersFrom || '',
    '{{share_numbers_to}}': p.shareNumbersTo || '',
    '{{previous_agreement_date}}': p.previousAgreementDate ? new Date(p.previousAgreementDate).toLocaleDateString('en-IN') : '',
    '{{previous_registration_number}}': p.previousRegistrationNumber || '',
    '{{developer_name}}': p.developerName || '',

    // Financials
    '{{consideration_amount}}': `₹${totalConsideration.toLocaleString('en-IN')}`,
    '{{consideration_amount_numeric}}': String(totalConsideration),
    '{{consideration_amount_words}}': considerationWords,
    '{{advance_amount}}': `₹${(Number(c.advanceAmount) || 0).toLocaleString('en-IN')}`,
    '{{balance_amount}}': `₹${(Math.max(0, totalConsideration - (Number(c.advanceAmount) || 0))).toLocaleString('en-IN')}`,

    // Dynamic blocks
    '{{payment_schedule_table}}': buildPaymentScheduleTable(payments, totalConsideration),
    '{{schedule_of_property}}': buildPropertySchedule(p),
    '{{signatures_block}}': buildSignaturesBlock(transferors, transferees, witnesses),
    '{{receipt_section}}': buildReceiptSection({ ...structuredData, consideration: { totalAmount: totalConsideration, amountInWords: considerationWords } })
  };

  // Compile each clause
  const compiledClauses = (templateClauses || []).map(clause => {
    let text = clause.content || '';
    for (const [tag, val] of Object.entries(placeholderMap)) {
      text = text.split(tag).join(val || '');
    }
    return {
      clauseId: clause.clauseId || clause.key || `clause_${Date.now()}`,
      title: clause.title || 'Clause',
      order: clause.order || 1,
      content: text,
      isMandatory: !!clause.isMandatory,
      isCustom: !!clause.isCustom
    };
  });

  return {
    compiledClauses,
    placeholderMap
  };
}

module.exports = {
  numberToIndianWords,
  formatLegalDate,
  buildTransferorsBlock,
  buildTransfereesBlock,
  buildPaymentScheduleTable,
  buildSignaturesBlock,
  buildReceiptSection,
  buildPropertySchedule,
  compileAgreementContent
};
