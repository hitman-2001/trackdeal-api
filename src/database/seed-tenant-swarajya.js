'use strict';

const mongoose = require('mongoose');
require('dotenv').config();

const { moduleKeysForVertical } = require('../modules/tenant/tenant.constants');
const { ensureVerticalTenant } = require('../modules/tenant/tenant.utils');

async function seedVerticalTenants() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB_NAME });

  const { Tenant } = require('../modules/tenant/tenant.model');
  const { Organization } = require('../modules/organization/organization.model');
  const { User } = require('../modules/user/user.model');
  const { UserInvitation } = require('../modules/user/user-invitation.model');

  const realEstate = await ensureVerticalTenant('realEstate');
  const education = await ensureVerticalTenant('education');

  console.log(`✅ Vertical tenant: ${realEstate.name} (${realEstate.slug})`);
  console.log(`✅ Vertical tenant: ${education.name} (${education.slug})`);

  const legacy = await Tenant.findOne({ slug: 'swarajya', isDeleted: { $ne: true } });
  if (legacy && String(legacy._id) !== String(realEstate._id)) {
    await Organization.updateMany(
      { tenantId: legacy._id },
      { $set: { tenantId: realEstate._id, vertical: 'realEstate' } }
    );
    await User.updateMany(
      { tenantId: legacy._id },
      { $set: { tenantId: realEstate._id } }
    );
    await UserInvitation.updateMany(
      { tenantId: legacy._id },
      { $set: { tenantId: realEstate._id } }
    );
    legacy.status = 'inactive';
    legacy.isDeleted = true;
    legacy.deletedAt = new Date();
    await legacy.save();
    console.log('✅ Migrated Swarajya tenant records onto Real Estate');
  }

  const orgResult = await Organization.updateMany(
    { $or: [{ tenantId: { $exists: false } }, { tenantId: null }, { vertical: { $exists: false } }, { vertical: null }] },
    { $set: { tenantId: realEstate._id, vertical: 'realEstate' } }
  );
  console.log(`✅ Organizations linked to Real Estate: ${orgResult.modifiedCount}`);

  const userResult = await User.updateMany(
    {
      organizationId: { $ne: null },
      $or: [{ tenantId: { $exists: false } }, { tenantId: null }],
    },
    { $set: { tenantId: realEstate._id } }
  );
  console.log(`✅ Org users linked to Real Estate: ${userResult.modifiedCount}`);

  console.log('\nLogin with organization name (e.g. Swarajya). Super Admin leaves organization blank.');
  console.log(`Education modules: ${moduleKeysForVertical('education').join(', ')}`);
  await mongoose.disconnect();
}

seedVerticalTenants().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
