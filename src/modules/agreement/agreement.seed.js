'use strict';

/**
 * Standard Legal Template Definition for Agreement for Sale-Deed (Resale Flat)
 * Follows standard Maharashtra / Indian Real Estate Transfer provisions.
 */

const DEFAULT_SALE_DEED_TEMPLATE = {
  templateCode: 'SALE_DEED_RESALE',
  name: 'Agreement for Sale-Deed (Resale Flat)',
  category: 'sale_deed',
  version: '1.0',
  description: 'Standard legal agreement for transfer and sale of a resale apartment / flat in a Co-operative Housing Society.',
  isSystemDefault: true,
  clauses: [
    {
      clauseId: 'title_and_intro',
      title: 'Title & Articles of Agreement',
      order: 1,
      isMandatory: true,
      content: `<div style="text-align: center; font-weight: bold; font-size: 16pt; text-decoration: underline; margin-bottom: 20px; letter-spacing: 0.5px;">
  AGREEMENT FOR SALE-DEED
</div>

<p style="text-align: justify; line-height: 1.8; font-size: 11pt;">
  THIS ARTICLES OF AGREEMENT made and entered into at <b>{{agreement_place}}</b> on this <b>{{agreement_date}}</b>;
</p>

<p style="text-align: center; font-weight: bold; margin: 15px 0;">
  BETWEEN
</p>

<p style="text-align: justify; line-height: 1.8; font-size: 11pt;">
  {{transferors_block}}
</p>

<p style="text-align: center; font-weight: bold; margin: 15px 0;">
  AND
</p>

<p style="text-align: justify; line-height: 1.8; font-size: 11pt;">
  {{transferees_block}}
</p>`
    },
    {
      clauseId: 'recitals',
      title: 'Recitals & Chain of Title (WHEREAS)',
      order: 2,
      isMandatory: true,
      content: `<div style="font-weight: bold; font-size: 12pt; text-decoration: underline; margin: 16px 0 8px 0;">
  WHEREAS:
</div>

<ol style="margin-left: 20px; line-height: 1.8; font-size: 11pt; text-align: justify;" type="A">
  <li style="margin-bottom: 12px;">
    The Transferor(s) is/are the sole, absolute, and exclusive owner(s) and in peaceful possession of Residential Flat bearing No. <b>{{flat_number}}</b> on the <b>{{floor}}</b> Floor, Wing <b>{{wing}}</b>, in the building known as <b>"{{building_name}}"</b> (hereinafter referred to as the <b>"Said Flat"</b>), situated at <b>{{village}}</b>, Taluka <b>{{taluka}}</b>, District <b>{{district}}</b>, having RERA Carpet Area of <b>{{carpet_area}} sq. ft.</b>, more particularly described in the Schedule hereunder written.
  </li>
  <li style="margin-bottom: 12px;">
    The Transferor(s) had originally acquired the Said Flat from the developer <b>{{developer_name}}</b> under a registered Agreement for Sale dated <b>{{previous_agreement_date}}</b> registered at the office of Sub-Registrar <b>{{sub_registrar_office}}</b> under Registration No. <b>{{previous_registration_number}}</b>.
  </li>
  <li style="margin-bottom: 12px;">
    The building is governed by the Co-operative Housing Society known as <b>"{{society_name}}"</b> duly registered under Registration No. <b>{{society_registration_number}}</b> dated <b>{{society_registration_date}}</b>, and the Transferor(s) is/are the registered member(s) holding Share Certificate No. <b>{{share_certificate_number}}</b> comprising distinctive share numbers from <b>{{share_numbers_from}}</b> to <b>{{share_numbers_to}}</b>.
  </li>
  <li style="margin-bottom: 12px;">
    The Transferor(s) has/have agreed to sell, transfer, convey, and assign all his/her/their right, title, interest, and ownership in the Said Flat together with the said shares to the Transferee(s), and the Transferee(s) has/have agreed to purchase the same for the total agreed consideration and on the terms and conditions hereinafter appearing.
  </li>
</ol>`
    },
    {
      clauseId: 'clause_1_consideration',
      title: 'Clause 1 — Sale & Total Consideration',
      order: 3,
      isMandatory: true,
      content: `<div style="font-weight: bold; font-size: 11.5pt; margin: 16px 0 6px 0;">
  NOW THIS AGREEMENT WITNESSETH AND IT IS HEREBY MUTUALLY AGREED BY AND BETWEEN THE PARTIES HERETO AS FOLLOWS:
</div>

<p style="text-align: justify; line-height: 1.8; font-size: 11pt;">
  <b>1. SALE AND CONSIDERATION:</b> The Transferor(s) hereby agrees to sell, transfer, convey, and assign unto the Transferee(s), and the Transferee(s) hereby agrees to purchase and acquire from the Transferor(s), all the right, title, interest, and ownership in the Said Flat No. <b>{{flat_number}}</b> on the <b>{{floor}}</b> Floor, Wing <b>{{wing}}</b> in the building <b>"{{building_name}}"</b> together with the 5 fully paid-up shares of <b>{{society_name}}</b> for the total lump-sum consideration of <b>{{consideration_amount}}</b> (<b>{{consideration_amount_words}}</b>), free from all encumbrances, charges, liens, mortgages, claims, or demands whatsoever.
</p>`
    },
    {
      clauseId: 'clause_2_payments',
      title: 'Clause 2 — Payment Schedule',
      order: 4,
      isMandatory: true,
      content: `<p style="text-align: justify; line-height: 1.8; font-size: 11pt;">
  <b>2. PAYMENT OF CONSIDERATION:</b> The Transferee(s) has paid and agreed to pay the aforesaid total consideration amount of <b>{{consideration_amount}}</b> to the Transferor(s) in the manner and on the dates as set out in the following Payment Schedule:
</p>

{{payment_schedule_table}}`
    },
    {
      clauseId: 'clause_3_society_noc',
      title: 'Clause 3 — Society NOC & Transfer Formalities',
      order: 5,
      isMandatory: true,
      content: `<p style="text-align: justify; line-height: 1.8; font-size: 11pt;">
  <b>3. SOCIETY NOC AND MEMBERSHIP TRANSFER:</b> The Transferor(s) shall execute all necessary application forms, resignation letters, transfer forms, indemnity bonds, and affidavits as prescribed by the Bye-laws of <b>{{society_name}}</b> for transferring the Said Flat and the 5 fully paid-up shares in the name of the Transferee(s). The Transferor(s) shall obtain the No Objection Certificate (NOC) / clearance letter from the Society prior to or simultaneously with registration.
</p>`
    },
    {
      clauseId: 'clause_4_covenants_and_title',
      title: 'Clause 4 — Title Clearance & Transferor Covenants',
      order: 6,
      isMandatory: true,
      content: `<p style="text-align: justify; line-height: 1.8; font-size: 11pt;">
  <b>4. COVENANTS AND TITLE INDEMNITY:</b> The Transferor(s) covenants and warrants that:
</p>
<ul style="margin-left: 20px; line-height: 1.8; font-size: 11pt; text-align: justify;">
  <li>The Transferor(s) is/are the sole and absolute owner(s) of the Said Flat and has/have full power and absolute right to sell and convey the same.</li>
  <li>The Said Flat is not subject to any litigation, attachment, court injunction, tax lien, bank mortgage, or encumbrance of any nature.</li>
  <li>If any defect in title or third-party claim arises against the Said Flat, the Transferor(s) shall at their own cost indemnify and keep harmless the Transferee(s) from any loss, cost, damages, or expenses arising therefrom.</li>
</ul>`
    },
    {
      clauseId: 'clause_5_outgoings',
      title: 'Clause 5 — Outgoings, Taxes & Maintenance Dues',
      order: 7,
      isMandatory: true,
      content: `<p style="text-align: justify; line-height: 1.8; font-size: 11pt;">
  <b>5. OUTGOINGS AND TAXES:</b> The Transferor(s) shall pay all municipal taxes, society maintenance charges, electricity bills, water dues, property taxes, and other outgoings relating to the Said Flat up to the date of handing over of peaceful physical possession. Thereafter, all such outgoings and statutory taxes shall be borne and paid exclusively by the Transferee(s).
</p>`
    },
    {
      clauseId: 'clause_6_possession',
      title: 'Clause 6 — Vacant Possession & Handover',
      order: 8,
      isMandatory: true,
      content: `<p style="text-align: justify; line-height: 1.8; font-size: 11pt;">
  <b>6. VACANT POSSESSION:</b> The Transferor(s) shall hand over quiet, peaceful, vacant, and physical possession of the Said Flat to the Transferee(s) simultaneously upon receipt of the full consideration amount and execution/registration of this document, together with original possession letter, chain of title deeds, and keys.
</p>`
    },
    {
      clauseId: 'clause_7_stamp_duty',
      title: 'Clause 7 — Stamp Duty & Registration Expenses',
      order: 9,
      isMandatory: true,
      content: `<p style="text-align: justify; line-height: 1.8; font-size: 11pt;">
  <b>7. STAMP DUTY AND REGISTRATION:</b> The Stamp Duty, Registration Fees, scanning charges, and legal documentation costs incidental to the execution and registration of this Agreement shall be borne and paid by the <b>Transferee(s)</b>, while the Transferor(s) shall cooperate fully in appearing before the Sub-Registrar of Assurances for biometric identification and registration.
</p>`
    },
    {
      clauseId: 'clause_8_jurisdiction',
      title: 'Clause 8 — Dispute Resolution & Jurisdiction',
      order: 10,
      isMandatory: true,
      content: `<p style="text-align: justify; line-height: 1.8; font-size: 11pt;">
  <b>8. JURISDICTION:</b> This Agreement shall be governed by and construed in accordance with the laws of India, and the competent Civil Courts at <b>{{jurisdiction_city}}</b> alone shall have exclusive jurisdiction to entertain and decide any dispute or claim arising out of or in connection with this Agreement.
</p>`
    },
    {
      clauseId: 'schedule_property',
      title: 'The Schedule of Property',
      order: 11,
      isMandatory: true,
      content: `<div style="margin-top: 25px; page-break-inside: avoid;">
  <div style="text-align: center; font-weight: bold; font-size: 13pt; text-decoration: underline; margin-bottom: 10px;">
    THE SCHEDULE OF PROPERTY REFERRED TO HEREINABOVE
  </div>
  {{schedule_of_property}}
</div>`
    },
    {
      clauseId: 'signatures',
      title: 'Signatures & Witness Block',
      order: 12,
      isMandatory: true,
      content: `{{signatures_block}}`
    },
    {
      clauseId: 'receipt',
      title: 'Memorandum of Receipt',
      order: 13,
      isMandatory: true,
      content: `{{receipt_section}}`
    }
  ]
};

module.exports = {
  DEFAULT_SALE_DEED_TEMPLATE
};
