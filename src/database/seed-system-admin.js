const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seedSystemAdminAndFixRoles() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB_NAME });

  const { Role } = require('../modules/authorization/role.model');
  const { User } = require('../modules/user/user.model');
  const { Organization } = require('../modules/organization/organization.model');

  // 1. Ensure system_admin role exists
  let systemAdminRole = await Role.findOne({ code: 'system_admin' });
  if (!systemAdminRole) {
    systemAdminRole = await Role.create({
      name: 'System Administrator',
      code: 'system_admin',
      description: 'TrackDeal Platform Root Administrator with global platform management access.',
      permissions: ['*'],
      isSystem: true,
      organizationId: null,
    });
    console.log('✅ Created system_admin Role:', systemAdminRole._id);
  }

  // 2. Ensure org_admin role exists
  let orgAdminRole = await Role.findOne({ code: 'org_admin' });
  if (!orgAdminRole) {
    orgAdminRole = await Role.create({
      name: 'Organization Admin',
      code: 'org_admin',
      description: 'Organization Administrator with full tenant-scoped management access.',
      permissions: ['*'],
      isSystem: true,
      organizationId: null,
    });
    console.log('✅ Created org_admin Role:', orgAdminRole._id);
  }

  // 3. Upsert system.administrator@trackdeal.com
  const hashedPassword = await bcrypt.hash('sameer123', 12);
  let systemAdminUser = await User.findOne({ email: 'system.administrator@trackdeal.com' });
  if (!systemAdminUser) {
    systemAdminUser = await User.create({
      firstName: 'TrackDeal',
      lastName: 'Platform Admin',
      email: 'system.administrator@trackdeal.com',
      password: hashedPassword,
      roleId: systemAdminRole._id,
      status: 'active',
      isActive: true,
      organizationId: null,
    });
    console.log('✅ Created System Administrator User: system.administrator@trackdeal.com');
  } else {
    systemAdminUser.password = hashedPassword;
    systemAdminUser.roleId = systemAdminRole._id;
    systemAdminUser.status = 'active';
    systemAdminUser.isActive = true;
    systemAdminUser.organizationId = null;
    await systemAdminUser.save();
    console.log('✅ Updated System Administrator User: system.administrator@trackdeal.com');
  }

  // 4. Update tenant users to org_admin
  const sameer = await User.findOne({ email: 'sameermish2202@gmail.com' });
  if (sameer) {
    sameer.roleId = orgAdminRole._id;
    await sameer.save();
    console.log('✅ Updated sameermish2202@gmail.com to org_admin');
  }

  const sam = await User.findOne({ email: 'sammishra8796@gmail.com' });
  if (sam) {
    sam.roleId = orgAdminRole._id;
    await sam.save();
    console.log('✅ Updated sammishra8796@gmail.com to org_admin');
  }

  const mayank = await User.findOne({ email: 'mayankrai627@gmail.com' });
  if (mayank) {
    mayank.roleId = orgAdminRole._id;
    await mayank.save();
    console.log('✅ Updated mayankrai627@gmail.com to org_admin');
  }

  console.log('\n🎉 System Admin and Tenant User Roles updated successfully!');
  await mongoose.disconnect();
}

seedSystemAdminAndFixRoles().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
