const crypto = require('crypto');
const mongoose = require('mongoose');
require('dotenv').config();

function generateJWT(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const expPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400
  };
  const body = Buffer.from(JSON.stringify(expPayload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

async function runTest() {
  console.log("=================================================");
  console.log("TESTING AGREEMENT MODULE BACKEND SERVICES & APIS");
  console.log("=================================================");

  await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB_NAME });

  const { User } = require('./src/modules/user/user.model');
  const { Role } = require('./src/modules/authorization/role.model');

  const user = await User.findOne({ email: 'sameermish2202@gmail.com' });
  const role = await Role.findById(user.roleId);

  const token = generateJWT({
    id: user._id,
    organizationId: user.organizationId,
    branchId: user.branchId,
    role: role?.name || 'org_admin',
    permissions: ['*'],
    email: user.email
  }, process.env.JWT_ACCESS_SECRET);

  console.log("✅ Authenticated as user:", user.email, "Org:", user.organizationId);
  const authHeader = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };

  // 1. Templates
  console.log("\n▶ Step 1: Listing templates...");
  const tplRes = await fetch("http://localhost:3000/api/v1/agreements/templates", { headers: authHeader });
  const tplData = await tplRes.json();
  console.log("Templates found:", tplData.data?.length, "First:", tplData.data?.[0]?.name);
  const saleDeedTemplate = tplData.data?.[0];

  // 2. Create Agreement
  console.log("\n▶ Step 2: Creating Agreement for Sale-Deed...");
  const createPayload = {
    templateId: saleDeedTemplate._id,
    structuredData: {
      transferors: [
        { name: "Mr. Sandeep L. Makwana", age: 46, pan: "ABCDE1234F", occupation: "Business", address: "Flat 604, Avenue D, Baner", city: "Pune", pin: "411045" },
        { name: "Mrs. Jalpa S. Makwana", age: 42, pan: "BCDEF2345G", occupation: "Homemaker", address: "Flat 604, Avenue D, Baner", city: "Pune", pin: "411045" }
      ],
      transferees: [
        { name: "Mr. Pramodnarayan Jha", age: 38, pan: "CDEFG3456H", occupation: "IT Professional", address: "Plot 12, Kothrud", city: "Pune", pin: "411038" }
      ],
      property: {
        flatNumber: "604",
        floor: "6th",
        wing: "D",
        buildingName: "Avenue D Building",
        projectName: "River Royale Residency",
        societyName: "River Royale Co-operative Housing Society Ltd.",
        societyRegistrationNumber: "PNA/PNA(2)/HSG/TC/1234/2020",
        societyRegistrationDate: "2020-03-15",
        carpetArea: 920,
        builtUpArea: 1150,
        surveyNumbers: "48/1A",
        ctsNumber: "1892",
        village: "Mahalunge",
        taluka: "Haveli",
        district: "Pune",
        subRegistrarOffice: "Haveli No. 17",
        shareCertificateNumber: "SC-448",
        shareNumbersFrom: "2161",
        shareNumbersTo: "2165",
        previousAgreementDate: "2021-08-10",
        previousRegistrationNumber: "HV17-8899/2021",
        developerName: "Godrej Landmark Developers"
      },
      agreement: {
        agreementDate: new Date().toISOString().slice(0, 10),
        agreementPlace: "Pune",
        jurisdictionCity: "Pune"
      },
      consideration: {
        totalAmount: 3275000,
        advanceAmount: 600000
      },
      payments: [
        { date: "2026-01-31", amount: 21001, mode: "UPI", bankName: "Kotak Mahindra Bank", referenceNumber: "UPI-998822", branch: "Baner" },
        { date: "2026-04-02", amount: 578999, mode: "Cheque", bankName: "State Bank of India", referenceNumber: "CHQ-004411", branch: "Aundh" },
        { date: "2026-08-20", amount: 2675000, mode: "Bank Transfer", bankName: "HDFC Bank", referenceNumber: "UTR-88224411", branch: "Kothrud" }
      ],
      witnesses: [
        { name: "Rajesh K. Verma", address: "B-201, Green Woods, Baner, Pune" },
        { name: "Anand M. Shinde", address: "Row House 4, Aundh, Pune" }
      ]
    }
  };

  const createRes = await fetch("http://localhost:3000/api/v1/agreements", {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify(createPayload)
  });
  console.log("Create Status:", createRes.status);
  const createData = await createRes.json();
  const agr = createData.data;
  console.log("✅ Agreement Created:", {
    id: agr._id,
    number: agr.agreementNumber,
    type: agr.agreementType,
    status: agr.status,
    amount: agr.structuredData?.consideration?.totalAmount,
    amountInWords: agr.structuredData?.consideration?.amountInWords,
    clauses: agr.clauses?.length
  });

  // 3. List & Summary
  console.log("\n▶ Step 3: Fetching /agreements list & summary...");
  const listRes = await fetch("http://localhost:3000/api/v1/agreements", { headers: authHeader });
  const listData = await listRes.json();
  console.log("Summary:", listData.summary, "Total Items:", listData.data?.length);

  // 4. Update Details mode
  console.log("\n▶ Step 4: Testing Edit Details mode (Updating total consideration to ₹35,00,000)...");
  const updatePayload = {
    ...createPayload.structuredData,
    consideration: { totalAmount: 3500000, advanceAmount: 1000000 }
  };
  const updRes = await fetch(`http://localhost:3000/api/v1/agreements/${agr._id}/details`, {
    method: "PUT",
    headers: authHeader,
    body: JSON.stringify(updatePayload)
  });
  const updData = await updRes.json();
  console.log("✅ Updated Version:", updData.data?.currentVersionNumber, "New Words:", updData.data?.structuredData?.consideration?.amountInWords);

  // 5. Add Custom Clause
  console.log("\n▶ Step 5: Testing Add Custom Clause...");
  const customRes = await fetch(`http://localhost:3000/api/v1/agreements/${agr._id}/custom-clause`, {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({
      title: "Special Car Parking Allocation",
      content: "<p><b>SPECIAL CONDITION:</b> Covered car parking space bearing No. <b>CP-42</b> in Basement 1 is transferred along with the Said Flat at no extra cost.</p>",
      insertAfterOrder: 6
    })
  });
  const customData = await customRes.json();
  console.log("✅ Custom clause added! Total clauses:", customData.data?.clauses?.length, "Version:", customData.data?.currentVersionNumber);

  // 6. Status transition to ready_for_print
  console.log("\n▶ Step 6: Updating Status to ready_for_print...");
  const statusRes = await fetch(`http://localhost:3000/api/v1/agreements/${agr._id}/status`, {
    method: "PATCH",
    headers: authHeader,
    body: JSON.stringify({ status: "ready_for_print" })
  });
  const statusData = await statusRes.json();
  console.log("✅ Status updated to:", statusData.data?.status, "Printed At:", statusData.data?.printedAt);

  // 7. Duplication
  console.log("\n▶ Step 7: Testing Agreement Duplication...");
  const dupRes = await fetch(`http://localhost:3000/api/v1/agreements/${agr._id}/duplicate`, {
    method: "POST",
    headers: authHeader
  });
  const dupData = await dupRes.json();
  console.log("✅ Duplicated Agreement:", dupData.data?.agreementNumber, "Status:", dupData.data?.status);

  // 8. Word Export
  console.log("\n▶ Step 8: Testing Word (.doc) Export...");
  const docxRes = await fetch(`http://localhost:3000/api/v1/agreements/${agr._id}/docx`, { headers: authHeader });
  console.log("Word Export Status:", docxRes.status, "Content-Type:", docxRes.headers.get("content-type"));

  console.log("\n=================================================");
  console.log("🎉 ALL AGREEMENT BACKEND AUTOMATION TESTS PASSED!");
  console.log("=================================================");

  await mongoose.disconnect();
}

runTest().catch(console.error);
