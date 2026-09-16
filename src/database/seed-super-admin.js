'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const EMAIL = 'integration@swarajyaconsultancy.in';
const PASSWORD = '$tech!2026SC';

async function seedSuperAdmin() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB_NAME });

  const { Role } = require('../modules/authorization/role.model');
  const { User } = require('../modules/user/user.model');
  const { PERMISSIONS } = require('../shared/constants/roles-permissions.constants');

  let role = await Role.findOne({ code: 'super_admin', organizationId: null });
  if (!role) {
    role = await Role.create({
      name: 'Super Admin',
      code: 'super_admin',
      description: 'Platform Super Administrator with access to all tenants, modules, and rights.',
      permissions: ['*', ...Object.values(PERMISSIONS)],
      isSystemRole: true,
      isActive: true,
      organizationId: null,
      availableForTiers: [],
    });
    console.log('Created super_admin role:', role._id.toString());
  } else {
    role.permissions = ['*', ...Object.values(PERMISSIONS)];
    role.isSystemRole = true;
    role.isActive = true;
    await role.save();
    console.log('Updated super_admin role:', role._id.toString());
  }

  const hashedPassword = await bcrypt.hash(PASSWORD, 12);
  let user = await User.findOne({ email: EMAIL });
  if (!user) {
    user = await User.create({
      firstName: 'Platform',
      lastName: 'Super Admin',
      email: EMAIL,
      password: hashedPassword,
      roleId: role._id,
      status: 'active',
      isActive: true,
      organizationId: null,
      tenantId: null,
      forcePasswordChange: false,
    });
    console.log('Created super_admin user:', EMAIL);
  } else {
    user.password = hashedPassword;
    user.roleId = role._id;
    user.status = 'active';
    user.isActive = true;
    user.organizationId = null;
    user.tenantId = null;
    user.forcePasswordChange = false;
    await user.save();
    console.log('Updated super_admin user:', EMAIL);
  }

  console.log('\nSuper admin is ready. Login with this email and leave Tenant blank.');
  await mongoose.disconnect();
}

seedSuperAdmin().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
