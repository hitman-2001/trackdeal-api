---
trigger: always_on
---

# REAL ESTATE CRM — MASTER DEVELOPMENT RULES

## 1. PROJECT PURPOSE

This application is a **Real Estate CRM and Sales Management Platform**.

The primary purpose is to manage the complete real-estate sales lifecycle:

**Lead Generation → Lead Qualification → Buyer Requirements → Property Matching → Follow-up → Property Visits → Meetings → Negotiation → Booking → Loan → Registration → Commission → Closing → Reporting**

The application must help real-estate companies manage customers, leads, properties, sales teams, channel partners, activities, transactions, and business performance from one centralized system.

The system should be designed as a **production-grade CRM**, not as a simple CRUD application.

---

# 2. CORE DEVELOPMENT PRINCIPLE

Before implementing any new feature, understand the existing architecture and reuse existing:

* Components
* Database entities
* Services
* APIs
* Hooks
* Utilities
* Validation
* Permissions
* UI patterns
* Design system
* Existing business logic

Do NOT create duplicate implementations when an existing reusable implementation is available.

Always prefer:

**Reuse → Extend → Refactor → Create New**

rather than immediately creating new files or duplicate logic.

---

# 3. SINGLE SOURCE OF TRUTH

Every major business entity must have one authoritative master record.

Examples:

* Customer → Customer Master
* Lead → Lead Master
* Property → Property Master
* Project → Project Master
* Agent/Channel Partner → Agent Master
* Sales User → User Master
* Transaction → Transaction Master

Do not maintain separate copies of the same entity in different modules.

For example:

If a new Agent/Channel Partner is created, it must automatically become available everywhere the system allows:

* Lead assignment
* Lead transfer
* Property assignment
* Reports
* Filters
* Activity records
* Transaction records
* Commission records

Never create hard-coded agent lists.

---

# 4. RELATIONSHIP-FIRST ARCHITECTURE

The application is relationship driven.

Important relationships include:

**Customer**
→ has many Leads

**Lead**
→ belongs to Customer
→ may be assigned to Sales User
→ may be assigned/transferred to Agent/Channel Partner
→ has many Activities
→ has many Property Interests
→ has many Visits
→ has many Quotations
→ may have Transactions

**Project**
→ has many Properties/Units

**Property**
→ belongs to Project
→ may be shown to many Leads
→ may have many quotations
→ may eventually be booked/sold

**Transaction**
→ belongs to Lead
→ belongs to Customer
→ belongs to Property
→ may contain Loan
→ may contain Commission
→ may contain Registration

Always preserve these relationships.

---

# 5. DO NOT OVERLOAD THE LEAD TABLE

The Lead entity should contain lead/opportunity information.

Do not put every possible business field directly into the Lead table.

Prefer separate related entities where appropriate.

Recommended conceptual entities:

* customers
* leads
* lead_financial_details
* lead_property_interests
* lead_activities
* lead_visits
* lead_followups
* lead_notes
* lead_documents
* projects
* properties
* property_quotations
* agents
* transactions
* transaction_loans
* transaction_commissions
* transaction_registration
* notifications
* audit_logs

Use the existing project architecture if equivalent entities already exist.

Do not blindly create these tables if equivalent structures already exist.

---

# 6. LEAD IS THE CENTRAL SALES OBJECT

The Lead is the central object for the sales process.

A lead should be able to move through stages such as:

* New
* Contacted
* Qualified
* Interested
* Site Visit Scheduled
* Site Visit Completed
* Negotiation
* Booking
* Loan Processing
* Registration
* Closed Won
* Closed Lost
* Nurture / Follow-up Later

Use the existing status/stage architecture if available.

Do not create multiple competing status systems.

---

# 7. LEAD CREATION

Lead creation should capture enough information to qualify a real-estate buyer.

Important categories include:

### Customer

* Name
* Phone
* Email
* Alternate Phone
* Location
* Occupation

### Property Requirement

* Property Type
* Configuration
* Preferred Location
* Preferred Project
* Area Requirement
* Possession Preference
* Purpose

### Budget

* Minimum Budget
* Maximum Budget
* Budget Flexibility

### Financial Requirement

* Loan Required
* Own Contribution
* Loan Required Amount
* Preferred Bank
* Loan Status
* Sanction Letter Availability
* Income
* Employment Type

### Buying Intent

* Purchase Timeline
* Lead Temperature
* Decision Maker
* Purpose
* Requirements
* Objections
* Notes

Conditional fields must be displayed based on user selections.

Example:

Loan Required = No

→ Do not show unnecessary loan fields.

Loan Required = Yes

→ Show relevant financial and loan fields.

---

# 8. LEAD ACTIVITY CENTER

Every Lead Card must provide a **Visits** option.

IMPORTANT:

The "Visits" option is NOT only for site visits.

It is the **complete Lead Activity Center**.

It must track:

* Site Visits
* Property Visits
* Meetings
* Phone Calls
* WhatsApp
* Emails
* Follow-ups
* Reminders
* Notes
* Properties Shown
* Projects Shown
* Quotations
* Rates Given
* Negotiations
* Booking Discussions
* Loan Discussions
* Registration Discussions
* Documents Shared

Everything must appear in a chronological activity timeline.

---

# 9. ACTIVITY HISTORY MUST NEVER BE LOST

Important customer interactions must be historical records.

Do not overwrite history.

Example:

Customer was quoted:

10 Aug → ₹85 lakh
15 Aug → ₹82 lakh
18 Aug → ₹80 lakh

The system must preserve all three records.

Do NOT update the old quotation to ₹80 lakh.

Create a new quotation/activity record.

This principle applies to:

* Prices
* Discounts
* Quotations
* Follow-ups
* Visits
* Customer feedback
* Important notes
* Lead transfers
* Status changes
* Commission changes
* Financial information

---

# 10. PROPERTY MASTER

Properties/projects must have a centralized property master.

A property may contain:

* Project
* Unit Number
* Property Type
* Configuration
* Floor
* Area
* Price
* Availability
* Status
* Location
* Amenities
* Documents
* Photos

Do not create duplicate property records when a property is selected in a Lead, Visit, Quotation, or Transaction.

Always reference the existing Property ID.

---

# 11. PROPERTY STATUS

Property inventory must have controlled statuses.

Example:

* Available
* On Hold
* Booked
* Sold
* Blocked
* Unavailable

Before creating a booking or closing a transaction:

**Always verify current property availability.**

Never allow two customers to accidentally purchase the same unit.

---

# 12. PROPERTY VISITS

A Lead can have multiple visits.

Each visit must store:

* Lead
* Customer
* Date
* Time
* Project
* Properties Shown
* Salesperson
* Agent/Channel Partner
* Visit Status
* Customer Feedback
* Interest Level
* Objections
* Next Action
* Next Follow-up

One visit may include multiple properties.

Do not assume:

**1 Visit = 1 Property**

---

# 13. PROPERTY INTEREST

A Lead may be interested in multiple properties/projects.

Do not store only one property ID on the Lead if the business requires multiple property interests.

Track:

* Project
* Property
* Date Added
* Interest Level
* Customer Feedback
* Quoted Price
* Current Status

Example:

Lead A:

* Project A — Interested
* Project B — Negotiating
* Project C — Not Interested

---

# 14. QUOTATION AND RATE HISTORY

Every rate/price communicated to the customer should be traceable.

Store:

* Property
* Project
* Date
* List Price
* Quoted Price
* Discount
* Other Charges
* Total Estimated Price
* Price Per Sq Ft
* Valid Until
* Created By

Never overwrite historical quotations.

Management must be able to determine:

**Who gave what price to which customer and when?**

---

# 15. AGENT / CHANNEL PARTNER MANAGEMENT

Agents/Channel Partners must be managed through a centralized master.

Information may include:

* Agent Name
* Office Name
* Phone
* Alternate Phone
* Email
* Address
* RERA Number
* Registration Number
* GST
* PAN
* Agent Type
* Contact Person
* Status
* Notes
* Documents

Agents must be dynamically available wherever lead transfer/assignment is supported.

Deactivating an agent must prevent new assignments but must NOT delete historical relationships.

---

# 16. LEAD TRANSFER

Lead transfers must maintain history.

Never simply replace:

Agent A → Agent B

without recording the previous assignment.

Store:

* Previous Owner
* New Owner
* Agent/Channel Partner
* Date/Time
* Transferred By
* Reason
* Remarks

The Lead Activity Timeline should display transfers.

---

# 17. LEAD CLOSING

Changing a Lead to Closed Won must trigger a **Closing Details workflow**.

Do not immediately close the lead without collecting required transaction information.

The closing process should capture:

### Property

* Purchased Property
* Project
* Unit
* Configuration
* Area

### Transaction

* Final Sale Price
* Agreement Value
* Booking Amount
* Own Contribution
* Actual Loan
* Discount
* Other Charges

### Loan

* Loan Taken Yes/No
* Loan Amount
* Bank
* Sanctioned Amount
* Sanction Date
* Disbursement
* Loan Status
* Documents

### Commission

* Commission Type
* Percentage
* Commission Amount
* GST
* Received Amount
* Pending Amount
* Due Date

### Registration

* Registration Required
* Registration Date
* Registration Number
* Registration Office
* Registration Amount
* Registration Status
* Documents

Only after validation should the Lead become Closed Won.

---

# 18. TRANSACTION MUST BE SEPARATE FROM LEAD

A successful lead should generate a Transaction record.

Conceptually:

Lead

↓

Transaction

↓

Property + Loan + Commission + Registration

Do not treat the Lead itself as the transaction.

This allows future support for:

* Repeat purchases
* Multiple transactions
* Resales
* Additional properties
* Multiple commissions
* Historical transaction reporting

---

# 19. FINANCIAL DATA

Financial information is important and must be treated carefully.

Always distinguish between:

### Estimated / Required

Example:

Loan Required = ₹50 lakh

and

### Actual

Example:

Actual Loan Taken = ₹47 lakh

Do not overwrite estimated requirements with actual transaction values.

Both should remain available.

---

# 20. COMMISSION

Commission should be independently trackable.

Support:

* Percentage commission
* Fixed commission
* Commission earned
* Commission received
* Commission pending
* Commission due date
* GST
* Payment reference

Commission calculation should be transparent and auditable.

---

# 21. REGISTRATION

Registration should be tracked independently from the Lead.

A transaction may be:

* Registration Pending
* Registration Scheduled
* Registration Completed
* Registration Delayed

Do not assume:

**Closed Won = Registration Completed**

These are separate business events.

---

# 22. REMINDERS AND FOLLOW-UPS

Every follow-up should have:

* Date
* Time
* Type
* Assigned User
* Description
* Status
* Reminder

Statuses:

* Upcoming
* Due
* Completed
* Missed
* Cancelled

The system should clearly highlight overdue follow-ups.

---

# 23. NOTIFICATIONS

Notifications should be generated for important events.

Examples:

* Follow-up due
* Follow-up overdue
* Site visit scheduled
* Meeting scheduled
* Reminder due
* Quotation expiring
* Lead transferred
* Property booked
* Loan sanctioned
* Registration scheduled
* Commission due

Use the application's existing notification infrastructure if available.

Do not create multiple notification systems.

---

# 24. PERMISSIONS

All business-critical actions must respect user permissions.

Examples:

* View Leads
* Create Leads
* Edit Leads
* Delete Leads
* Transfer Leads
* Create Agents
* Edit Agents
* View Transactions
* Edit Transactions
* View Commission
* Edit Commission
* Close Leads
* View Reports

Never rely only on frontend permission checks.

Backend/API authorization must also be enforced.

---

# 25. AUDI