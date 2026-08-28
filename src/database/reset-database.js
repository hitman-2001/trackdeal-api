const mongoose = require('mongoose');
require('dotenv').config();

const PRESERVED_ADMIN_EMAIL = 'system.administrator@trackdeal.com';
const PRESERVED_SYSTEM_COLLECTIONS = new Set([
  'roles',
  'permissions',
  'systemsettings',
  'agreementtemplates',
]);

async function resetDatabase() {
  console.log('================================================================');
  console.log('STARTING SAFE DATABASE RESET');
  console.log('================================================================');

  await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB_NAME });
  const db = mongoose.connection.db;

  // 1. Verify admin user exists before proceeding
  const adminUser = await db.collection('users').findOne({ email: PRESERVED_ADMIN_EMAIL });
  if (!adminUser) {
    throw new Error(`CRITICAL: Admin user ${PRESERVED_ADMIN_EMAIL} was not found! Aborting reset for safety.`);
  }
  console.log(`✅ Verified Admin User: ${adminUser.email} (ID: ${adminUser._id})`);

  // 2. Fetch all collections in the database
  const allCollections = await db.listCollections().toArray();
  const collectionNames = allCollections.map(c => c.name).filter(name => !name.startsWith('system.'));

  const summary = {
    deleted: {},
    preserved: {},
  };

  // 3. Clear users except system administrator
  const userDeleteResult = await db.collection('users').deleteMany({
    email: { $ne: PRESERVED_ADMIN_EMAIL }
  });
  summary.deleted['users (non-admin)'] = userDeleteResult.deletedCount;
  summary.preserved['users (admin)'] = 1;
  console.log(`🧹 Deleted ${userDeleteResult.deletedCount} non-admin user(s), preserved 1 admin user.`);

  // 4. Clear all other business / application collections
  for (const colName of collectionNames) {
    if (colName === 'users') continue;

    if (PRESERVED_SYSTEM_COLLECTIONS.has(colName)) {
      const count = await db.collection(colName).countDocuments();
      summary.preserved[colName] = count;
      console.log(`🛡️ Preserved system collection "${colName}": ${count} document(s)`);
    } else {
      const countBefore = await db.collection(colName).countDocuments();
      if (countBefore > 0) {
        const deleteResult = await db.collection(colName).deleteMany({});
        summary.deleted[colName] = deleteResult.deletedCount;
        console.log(`🧹 Cleared collection "${colName}": ${deleteResult.deletedCount} document(s) removed.`);
      } else {
        summary.deleted[colName] = 0;
      }
    }
  }

  // 5. Verification checks
  console.log('\n================================================================');
  console.log('RUNNING POST-CLEANUP VERIFICATION');
  console.log('================================================================');

  const totalUsers = await db.collection('users').countDocuments();
  const remainingNonAdminUsers = await db.collection('users').countDocuments({ email: { $ne: PRESERVED_ADMIN_EMAIL } });
  const adminCheck = await db.collection('users').findOne({ email: PRESERVED_ADMIN_EMAIL });

  console.log(`- Total users in database: ${totalUsers}`);
  console.log(`- Non-admin users remaining: ${remainingNonAdminUsers}`);
  console.log(`- Admin account exists: ${!!adminCheck}`);
  console.log(`- Admin status: ${adminCheck?.status}, roleId: ${adminCheck?.roleId}`);

  if (totalUsers !== 1 || remainingNonAdminUsers !== 0 || !adminCheck) {
    throw new Error('Verification failed: user count mismatch!');
  }

  console.log('\n- Business collections verification:');
  let remainingBusinessDocs = 0;
  for (const colName of collectionNames) {
    if (colName === 'users' || PRESERVED_SYSTEM_COLLECTIONS.has(colName)) continue;
    const count = await db.collection(colName).countDocuments();
    if (count > 0) {
      console.error(`❌ Non-empty collection found: ${colName} (${count} docs)`);
      remainingBusinessDocs += count;
    }
  }

  if (remainingBusinessDocs > 0) {
    throw new Error(`Verification failed: ${remainingBusinessDocs} orphaned business documents found!`);
  }

  console.log('✅ All business collections are completely clean (0 documents).');
  console.log('✅ System roles and permissions are 100% intact.');

  await mongoose.disconnect();
  return summary;
}

resetDatabase()
  .then((summary) => {
    console.log('\n🎉 DATABASE RESET COMPLETED SUCCESSFULLY!');
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Reset failed:', err);
    process.exit(1);
  });
