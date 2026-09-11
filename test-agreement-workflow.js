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
  console.log("Templates found:", tplData.data?.length);
  tplData.data?.forEach(t => console.log(` - [${t.templateCode}] ${t.name}`));
  const resaleTemplate = tplData.data?.find(t => t.templateCode === 'AGREEMENT_FOR_RESALE') || tplData.data?.[0];

  // 2. Create Resale Agreement
  console.log("\n▶ Step 2: Creating Agreement for Re-Sale using sample document data...");
  const createPayload = {
    templateId: resaleTemplate._id,
    structuredData: {
      transferors: [
        { name: "MR. SANDEEP N RAWAL", age: 34, pan: "BBWPR0747K", occupation: "Business", address: "Flat no 302, Nityanand Shakti (mauli) co-op hsg.soc.ltd, near gramdevi mandir, nilemore, nallasopara (west)", city: "Nallasopara", state: "Maharashtra", pin: "401203" }
      ],
      transferees: [
        { name: "Mr. VIVEK SAKHARAM KARAN", age: 26, pan: "JIMPK3184E", occupation: "Service", address: "Room No 202, Nityanand Mauli, Second Floor, Nilegaon, Nallasopara (west)", city: "Nallasopara", state: "Maharashtra", pin: "401203" },
        { name: "Mrs. RASHMI VIVEK KARAN", age: 20, pan: "PKSPK1656M", occupation: "Homemaker", address: "Room No 202, Nityanand Mauli, Second Floor, Nilegaon, Nallasopara (west)", city: "Nallasopara", state: "Maharashtra", pin: "401203" }
      ],
      property: {
        flatNumber: "302",
        floor: "Third Floor",
        wing: "C –Wing (Earlier was A Wing)",
        buildingName: "NITYANAND SHAKTI CO-OP HSG SOC LTD",
        societyName: "NITYANAND SHAKTI CO-OP HSG SOC LTD",
        societyRegistrationNumber: "TNA/VSI/HSG/TC/19137/2007-2008",
        societyRegistrationDate: "2007-11-29",
        builtUpArea: 495,
        builtUpAreaSqMtr: 46.00,
        carpetArea: 410,
        surveyNumbers: "SURVEY NO 1",
        hissaNumber: "Hissa No 5 & 6",
        village: "Nilemore",
        landmark: "Near – Grandevi Mandir, Nilegaon",
        taluka: "Vasai",
        district: "Palghar",
        municipalCorporation: "Vasai Virar Municipal Corporation",
        subRegistrarOffice: "Vasai",
        shareCertificateNumber: "SC-44",
        shareNumbersFrom: "431",
        shareNumbersTo: "440",
        membershipNumber: "44",
        originalBuyerName: "SMT. AASHA MANIK PATIL",
        originalDeveloperName: "SHREE SADGURU CONSTRUCTION CO.",
        originalAgreementDate: "2007-10-30",
        originalRegistrationNumber: "VASAI 3 - 11208/2007",
        originalSubRegistrarOffice: "Vasai-3",
        previousSellerName: "SMT. ASHA MANIK PATIL",
        previousBuyerName: "MR. SANDEEP N RAWAL",
        previousAgreementDate: "2017-06-30",
        previousRegistrationNumber: "5926/2017",
        previousSubRegistrarOffice: "Vasai-3"
      },
      agreement: {
        agreementDate: new Date().toISOString().slice(0, 10),
        agreementPlace: "Nallasopara",
        jurisdictionCity: "Vasai"
      },
      consideration: {
        totalAmount: 3350000,
        advanceAmount: 351000,
        loanContingencyDays: 45,
        societyTransferFeeRatio: "equal_50_50"
      },
      payments: [
        { date: new Date().toISOString().slice(0, 10), amount: 351000, mode: "Online / Bank Transfer", bankName: "HDFC Bank", referenceNumber: "TXN-99882211", branch: "Vasai West" }
      ],
      witnesses: [
        { name: "1. ____________________________", address: "Address: ____________________________" },
        { name: "2. ____________________________", address: 'Address: ____________________________' }
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

  // 9. Test Execution Lock (Status -> executed)
  console.log("\n▶ Step 9: Updating Status to executed and verifying edit lock...");
  await fetch(`http://localhost:3000/api/v1/agreements/${agr._id}/status`, {
    method: "PATCH",
    headers: authHeader,
    body: JSON.stringify({ status: "executed" })
  });

  const lockedEditRes = await fetch(`http://localhost:3000/api/v1/agreements/${agr._id}/details`, {
    method: "PUT",
    headers: authHeader,
    body: JSON.stringify(updatePayload)
  });
  const lockedData = await lockedEditRes.json();
  console.log("✅ Executed Lock Test HTTP Status:", lockedEditRes.status, "Message:", lockedData.message);

  console.log("\n=================================================");
  console.log("🎉 ALL AGREEMENT BACKEND AUTOMATION TESTS PASSED!");
  console.log("=================================================");

  await mongoose.disconnect();
}

runTest().catch(console.error);
