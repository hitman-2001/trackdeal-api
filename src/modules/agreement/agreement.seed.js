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

const AGREEMENT_FOR_RESALE_TEMPLATE = {
  templateCode: 'AGREEMENT_FOR_RESALE',
  name: 'Agreement for Re-Sale (Resale Flat / CHS)',
  category: 'resale',
  version: '1.0',
  description: 'Standard legal agreement for transfer and resale of a resale flat in a Co-operative Housing Society with loan terms, society NOC, and equal (50:50) fee sharing.',
  isSystemDefault: true,
  clauses: [
    {
      clauseId: 'title_and_intro',
      title: 'Title & Articles of Agreement',
      order: 1,
      isMandatory: true,
      content: `<div style="text-align: center; font-weight: bold; font-size: 16pt; text-decoration: underline; margin-bottom: 20px; letter-spacing: 0.5px;">
  AGREEMENT FOR RE-SALE
</div>

<p style="text-align: justify; line-height: 1.8; font-size: 11pt;">
  <b>ARTICLES OF AGREEMENT</b> made and entered into at <b>{{agreement_place}}</b> on this <b>{{agreement_date}}</b>;
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
  WHEREAS:-
</div>

<ol style="margin-left: 20px; line-height: 1.8; font-size: 11pt; text-align: justify;" type="a">
  <li style="margin-bottom: 12px;">
    The Transferor(s) are seized and possessed of or otherwise well and sufficiently entitled to Flat No- <b>{{flat_number}}</b>, <b>{{wing}}</b> Wing on <b>{{floor}}</b> Floor in the Building Known as <b>"{{society_name}}"</b>, Admeasuring area about <b>{{built_up_area}} Sq.Ft</b> Built-up Area i.e equivalent <b>{{built_up_area_sq_m}} Sq. Mtr (Built-up Area)</b> (Carpet Area <b>{{carpet_area}} Sq.Ft</b>) Constructed on land bearing SURVEY NO <b>{{survey_numbers}}</b>, Hissa No <b>{{hissa_number}}</b> lying being and situated at Village <b>{{village}}</b> situated at, Near – <b>{{landmark}}</b>, <b>{{village}}</b>, <b>{{taluka}}</b> Tal. <b>{{taluka}}</b>, Dist. <b>{{district}}</b>, within the area of <b>{{municipal_corporation}}</b>, Sub-Registrar office of <b>{{sub_registrar_office}}</b>, Tal. <b>{{taluka}}</b> Dist: <b>{{district}}</b>, (hereinafter referred to as <b>"The Said Flat"</b>).
  </li>
  <li style="margin-bottom: 12px;">
    The Transferor(s) are also the registered member and shareholder of <b>"{{society_name}}"</b> Registered under the Maharashtra Co-op Society Act 1960 Under Registration no <b>{{society_registration_number}}</b> dated <b>{{society_registration_date}}</b> (hereinafter referred to as "The Said Society") and as such, is the registered holder of shares bearing distinctive No- <b>{{share_numbers_from}} to {{share_numbers_to}}</b> (both inclusive) issued by the said Society and Transfer of date is (Hereinafter referred to as "The Said Shares") and bearing Membership No is <b>{{membership_number}}</b> in respect of the ownership of the said flat. The said Flat and the said shares are more particularly described in the Schedule hereunder written and are hereinafter collectively referred to as <b>"The Said Premises"</b>.
  </li>
  <li style="margin-bottom: 12px;">
    By an Agreement the said flat was originally purchased by <b>{{original_buyer_name}}</b> from <b>{{original_developer_name}}</b> (hereinafter referred as "The said Developers") A Partnership firm / Developer, the said Agreement for Sale dated <b>{{original_agreement_date}}</b> is duly registered before Sub-Registrar, <b>{{original_sub_registrar_office}}</b> vide its Document Registration No. <b>{{original_registration_number}}</b>.
  </li>
  <li style="margin-bottom: 12px;">
    Later By an agreement the said Flat sold/transferred to <b>{{previous_buyer_name}}</b> by <b>{{previous_seller_name}}</b> the sale agreement for sale dated <b>{{previous_agreement_date}}</b>, is duly Registered before Sub-Registrar, <b>{{previous_sub_registrar_office}}</b> vide its Document Registration No. <b>{{previous_registration_number}}</b>.
  </li>
  <li style="margin-bottom: 12px;">
    The Transferor(s) are entitled to sell, transfer, convey and assign all their right, title and beneficial interest in the said Flat No- <b>{{flat_number}}</b>, <b>{{wing}}</b> Wing on <b>{{floor}}</b> Floor in Building Known as <b>"{{society_name}}"</b>, Admeasuring area about <b>{{built_up_area}} Sq.Ft</b> Built-up Area i.e equivalent <b>{{built_up_area_sq_m}} Sq. Mtr (Built-up Area)</b> of the said Building in favour of the Transferee(s).
  </li>
  <li style="margin-bottom: 12px;">
    The Transferee(s) has agreed to purchase and acquire from the Transferor(s) all the right, title and interest of the Transferor(s) in the said Flat No- <b>{{flat_number}}</b>, <b>{{wing}}</b> Wing on <b>{{floor}}</b> Floor in Building Known as <b>"{{society_name}}"</b>, Admeasuring area about <b>{{built_up_area}} Sq.Ft</b> Built-up Area i.e equivalent <b>{{built_up_area_sq_m}} Sq. Mtr (Built-up Area)</b> of the said above Society which the Transferor(s) has agreed to do upon the terms and conditions recorded hereinafter.
  </li>
</ol>`
    },
    {
      clauseId: 'clause_1_sale_consideration',
      title: 'Clause 1 — Sale, Consideration & Loan Contingency',
      order: 3,
      isMandatory: true,
      content: `<div style="font-weight: bold; font-size: 11pt; margin: 16px 0 6px 0; text-decoration: underline;">
  NOW THIS RE - SALE WITNESSETH AND IT IS HEREBY AGREED BY AND BETWEEN THE PARTIES HERETO AS FOLLOWS:-
</div>

<p style="text-align: justify; line-height: 1.8; font-size: 11pt;">
  <b>1.</b> That the Transferor(s) hereby agrees to sell, transfer, convey and assign their right, title and interest in the said Flat No- <b>{{flat_number}}</b>, <b>{{wing}}</b> Wing on <b>{{floor}}</b> Floor in the Building Known as <b>"{{society_name}}"</b>, Admeasuring area about <b>{{built_up_area}} Sq.Ft</b> Built-up Area i.e equivalent <b>{{built_up_area_sq_m}} Sq. Mtr (Built-up Area)</b> Constructed on land bearing SURVEY NO <b>{{survey_numbers}}</b>, Hissa No <b>{{hissa_number}}</b> lying being and situated at Village <b>{{village}}</b> situated at, Near – <b>{{landmark}}</b>, <b>{{village}}</b>, <b>{{taluka}}</b> to Taluka: <b>{{taluka}}</b>, District: <b>{{district}}</b>, within the area of <b>{{municipal_corporation}}</b>, Sub-Registrar office of <b>{{sub_registrar_office}}</b>, (hereinafter referred to as <b>"The Said Flat"</b>). Together with all their right, title and interest to the TRANSFEREES in the said Flat for the total consideration of <b>{{consideration_amount}}</b> (<b>{{consideration_amount_words}}</b>) to be paid in the following manner:
</p>

<p style="text-align: justify; line-height: 1.8; font-size: 11pt; margin-left: 20px;">
  (a) The TRANSFEREES has paid the sum of <b>{{advance_amount}}</b> to the Transferor(s) as and by way of part payment of the said flat herein above mentioned (the payment and receipt whereof the Transferor hereby admits and acknowledges);
</p>

<p style="text-align: justify; line-height: 1.8; font-size: 11pt; margin-left: 20px;">
  (b) It has been mutually agreed upon by and between the parties hereto that the TRANSFEREES shall pay to the TRANSFERORS the balance amount of <b>{{balance_amount}}</b> by way of obtaining Loan from Bank or Other Financial institution within a period of <b>{{loan_contingency_days}}</b> from the date of the execution of the said Agreement. If TRANSFEREE failed to do so the said Re-Sale Agreement would be cancelled and on completion of the sale, the Transferors shall deliver vacant and peaceful possession of the said Flat to the Transferee.
</p>`
    },
    {
      clauseId: 'clause_2_society_noc',
      title: 'Clause 2 — Society No Objection Letter (NOC)',
      order: 4,
      isMandatory: true,
      content: `<p style="text-align: justify; line-height: 1.8; font-size: 11pt;">
  <b>2.</b> The Transferor shall obtain No Objection Letter from the said Society inter alia to the effect that the Society has no objection to the Transferee being admitted as member of the said Society. It shall be the sole obligation of the Transferor to obtain such no objection. Upon obtaining such letter from the said society, the Transferor at the time of completion of the sale as provided under this Agreement apply to the said society for transfer of the said Flat and the said shares along with the required documents to the name of the Transferee.
</p>`
    },
    {
      clauseId: 'clause_3_resignation_deed',
      title: 'Clause 3 — Resignation & Deed of Transfer',
      order: 5,
      isMandatory: true,
      content: `<p style="text-align: justify; line-height: 1.8; font-size: 11pt;">
  <b>3.</b> At the time of completion of the sale (a) the Transferor shall by an appropriate writing resign as the member of the said society and request the society to admit the Transferee as member of the society in place of the Transferors (b) the Transferee shall apply to the said society to become member of the said society (c) the Transferor shall also execute a proper Deed of Transfer recording completion of sale in the format approved by the Transferee.
</p>`
    },
    {
      clauseId: 'clause_4_covenants',
      title: 'Clause 4 — Transferor Covenants & Title Indemnity',
      order: 6,
      isMandatory: true,
      content: `<p style="text-align: justify; line-height: 1.8; font-size: 11pt;">
  <b>4.</b> The Transferor To the hereby covenant with the Transferee as follows:
</p>

<p style="text-align: justify; line-height: 1.8; font-size: 11pt; margin-left: 20px;">
  a) That the Transferor has duly paid and discharged in full all the dues and liabilities in respect of the said premises including the Municipal outgoings, taxes, rates, maintenance charges etc. payable to the said society up to the date hereof and shall pay all the dues till the completion of sale.
</p>
<p style="text-align: justify; line-height: 1.8; font-size: 11pt; margin-left: 20px;">
  b) That the Transferor are the sole and absolute owner and beneficiary of the said premises duly standing in the name of the Transferor in the books and all other records of the said society and is absolutely entitled to the same and to all incidental rights thereto and to exclusive rights to the use, enjoyment and occupation of the said Flat and except the Transferor no other person or persons have any right, title, interest, claim or demand of any nature whatsoever unto or upon the said premises;
</p>
<p style="text-align: justify; line-height: 1.8; font-size: 11pt; margin-left: 20px;">
  c) That notwithstanding any act, deed, matter or thing whatsoever done, omitted by the Transferor or any person or persons lawfully and equitably claiming by, from, through, or in trust for the Transferor, the Transferor has full power and absolute authority in their own right to transfer the said premises and to relinquish and transfer all their rights, title and interest therein in favour of the Transferee;
</p>
<p style="text-align: justify; line-height: 1.8; font-size: 11pt; margin-left: 20px;">
  d) That neither the Transferor nor any one on their behalf has committed or omitted any act, deed, matter or thing whereby their holding of the said shares and incidental rights thereto including the right to peaceful use, occupation, ownership and enjoyment of the said Flat and other rights and benefits in respect thereof may become or may be prejudicially affected or encumbered in any manner or whereby the said shares and their other right, title and interest therein may become liable to attachment and/or sale whether by a decree or order of the Competent Court or otherwise;
</p>
<p style="text-align: justify; line-height: 1.8; font-size: 11pt; margin-left: 20px;">
  e) That the Transferor has not created or purported to create any gift, trust, inheritance or otherwise and that the same are free from all encumbrances and there is no pending litigation of any kind whatsoever and further that the Transferors shall so long as this Sale Deed is valid, not enter into any agreement/writing with any third party for creating any rights of whatsoever nature in respect of the said premises;
</p>
<p style="text-align: justify; line-height: 1.8; font-size: 11pt; margin-left: 20px;">
  f) That the Transferee shall on completion of the transfer peaceably and quietly be entitled to hold and own the said Flat and the said shares and all incidental thereto including the right to enter upon and remain in sole occupation and enjoyment of the said Flat and/or any part thereof in the Transferee’s own right without any interference disturbance, interruption, claim or demand whatsoever and/or any person or persons lawfully and equitably claiming by from, through, under or in trust for the Transferor;
</p>
<p style="text-align: justify; line-height: 1.8; font-size: 11pt; margin-left: 20px;">
  g) That the Transferor has duly complied with observed performed with all the Rules, Regulations and Bye-Laws of the said Society and that the Transferor has neither received any notice from the said Society for or in relation to any breach of any of the Rules, Regulations and Bye-laws of the said Society nor are there any actions or proceedings pending against the Transferor instituted by the said Society or any member of the said society in respect of the said premises including any notice or action for expulsion or termination of the Transferor as the member of the said society;
</p>
<p style="text-align: justify; line-height: 1.8; font-size: 11pt; margin-left: 20px;">
  h) That the Transferor has not received any notice for acquisition or requisition of the said Flat and/or the said shares; and That the Transferor herein doth hereby indemnify and keep indemnified the Transferee against any defect in title, omission, or mischief of any person wrongfully claiming any right, title or beneficial interest in the said Flat and/or the said shares or compensation, claim, demand, fines, penalties, costs, charges and expenses or any other liabilities whatsoever made or bought, against or incurred, suffered, levied or imposed pursuant to the transfer thereof under the terms of this Sale Deed and/or by reason or by virtue of the non-performance and non-observance of any of the terms and conditions of the Agreement /Sale Deed, covenants and provisions.
</p>`
    },
    {
      clauseId: 'clause_5_outgoings',
      title: 'Clause 5 — Allocation of Outgoings & Dues',
      order: 7,
      isMandatory: true,
      content: `<p style="text-align: justify; line-height: 1.8; font-size: 11pt;">
  <b>5.</b> The Transferor shall bear and pay all outgoings in respect of the said Flat including all rates, taxes and charges for consumption of electricity, water etc. and all dues and charges payable to the said society till the date of completion and the Transferee shall bear and pay all such outgoings, dues and charges to the said society from the date of completion of sale and receiving possession of the said Flat.
</p>`
    },
    {
      clauseId: 'clause_6_deposits_sinking_fund',
      title: 'Clause 6 — Sinking Fund & Credit Deposits Transfer',
      order: 8,
      isMandatory: true,
      content: `<p style="text-align: justify; line-height: 1.8; font-size: 11pt;">
  <b>6.</b> The Transferor shall also transfer in favour of the Transferee the amounts standing to their credit in the deposits, if any, or the sinking fund maintained by the said society and for that purpose, the Transferor shall sign and execute all necessary applications and other assurances as may be necessary or as may be determined or required by the said society.
</p>`
    },
    {
      clauseId: 'clause_7_society_rules',
      title: 'Clause 7 — Society Membership & Bye-laws Covenant',
      order: 9,
      isMandatory: true,
      content: `<p style="text-align: justify; line-height: 1.8; font-size: 11pt;">
  <b>7.</b> The Transferee doth hereby agree and covenant to become member of the said society and to abide by and observe and perform all the rules and regulations and byelaws of the said Society from time to time in force.
</p>`
    },
    {
      clauseId: 'clause_8_further_assurance',
      title: 'Clause 8 — Execution of Necessary Applications & Forms',
      order: 10,
      isMandatory: true,
      content: `<p style="text-align: justify; line-height: 1.8; font-size: 11pt;">
  <b>8.</b> The Transferor shall sign and execute in favour of the Transferee necessary applications, forms, deeds and other documents or writings as may be reasonably required by the society for transfer of the said shares and the said Flat and right to possess, use, occupy and enjoy the said Flat in favour of the Transferee and for implementing the terms of this Sale Deed.
</p>`
    },
    {
      clauseId: 'clause_9_specific_performance',
      title: 'Clause 9 — Specific Performance',
      order: 11,
      isMandatory: true,
      content: `<p style="text-align: justify; line-height: 1.8; font-size: 11pt;">
  <b>9.</b> It is hereby expressly provided and agreed by the parties hereto that both parties are entitled to enforce specific performance of the Agreement against each other in case of breach of any conditions mentioned in this Agreement.
</p>`
    },
    {
      clauseId: 'clause_10_dispute_court',
      title: 'Clause 10 — Dispute Resolution & Civil Court Jurisdiction',
      order: 12,
      isMandatory: true,
      content: `<p style="text-align: justify; line-height: 1.8; font-size: 11pt;">
  <b>10.</b> All disputes and differences between the parties hereto arising out of this agreement or in relation to the interpretation or effect of any of the terms and conditions contained in the agreement or in relation to the rights and obligations of the parties hereto shall be referred the Hon’ble civil Court at <b>{{jurisdiction_city}}</b>.
</p>`
    },
    {
      clauseId: 'clause_11_stamp_registration_fees',
      title: 'Clause 11 — Stamp Duty, Registration & Equal Society Transfer Fees',
      order: 13,
      isMandatory: true,
      content: `<p style="text-align: justify; line-height: 1.8; font-size: 11pt;">
  <b>11.</b> The stamp duty, if payable, and registration charges, if applicable, shall be borne and paid by the Transferee only. The parties have also agreed to pay and bear equally the transfer fees/donations/other charges etc. of the said Society for the transfer of the said premises in favour of the Transferee. The Transferor hereby also authorizes the Transferee to pay their share of transfer fees etc. as aforesaid directly to the Society out of the consideration payable to them by the Transferee as provided under this Agreement.
</p>`
    },
    {
      clauseId: 'schedule_property',
      title: 'The Schedule of Property',
      order: 14,
      isMandatory: true,
      content: `<div style="margin-top: 25px; page-break-inside: avoid;">
  <div style="text-align: center; font-weight: bold; font-size: 13pt; text-decoration: underline; margin-bottom: 10px;">
    SCHEDULE ABOVE REFERRED TO:
  </div>
  {{schedule_of_property}}
</div>`
    },
    {
      clauseId: 'signatures',
      title: 'Signatures & Witness Block',
      order: 15,
      isMandatory: true,
      content: `{{signatures_block}}`
    },
    {
      clauseId: 'receipt',
      title: 'Memorandum of Receipt',
      order: 16,
      isMandatory: true,
      content: `{{receipt_section}}`
    }
  ]
};

module.exports = {
  DEFAULT_SALE_DEED_TEMPLATE,
  AGREEMENT_FOR_RESALE_TEMPLATE,
  SYSTEM_DOCUMENT_TEMPLATES: [DEFAULT_SALE_DEED_TEMPLATE, AGREEMENT_FOR_RESALE_TEMPLATE]
};
