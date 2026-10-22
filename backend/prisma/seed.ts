// Idempotent seed for the Operations Reporting Portal RBAC catalog.
//
// Roles and permissions are upserted by their unique key; role<->permission
// mappings are inserted with `skipDuplicates` (composite primary key), so this
// script is safe to re-run: `npx prisma db seed`.
//
// NOTE: no users are seeded — users are auto-provisioned on first OIDC login.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ALL_PERMISSIONS = [
  'report:read',
  'report:create',
  'report:update',
  'report:delete',
  'report:export',
  'user:read',
  'user:manage',
  'role:manage',
] as const;

const ROLES = [
  { name: 'ADMIN', description: 'Full access to reports, users, and roles' },
  {
    name: 'OPERATIONS_MANAGER',
    description: 'Manages reports and can view users',
  },
  {
    name: 'OPERATIONS_ANALYST',
    description: 'Creates, updates, and exports reports',
  },
  { name: 'VIEWER', description: 'Read-only access to reports' },
] as const;

const PERMISSIONS: { name: string; description: string }[] = [
  { name: 'report:read', description: 'Read reports' },
  { name: 'report:create', description: 'Create reports' },
  { name: 'report:update', description: 'Update reports' },
  { name: 'report:delete', description: 'Delete reports' },
  { name: 'report:export', description: 'Export reports' },
  { name: 'user:read', description: 'Read users' },
  { name: 'user:manage', description: 'Manage users' },
  { name: 'role:manage', description: 'Manage roles and role assignments' },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: [...ALL_PERMISSIONS],
  OPERATIONS_MANAGER: [
    'report:read',
    'report:create',
    'report:update',
    'report:delete',
    'report:export',
    'user:read',
  ],
  OPERATIONS_ANALYST: ['report:read', 'report:create', 'report:update', 'report:export'],
  VIEWER: ['report:read'],
};

async function main(): Promise<void> {
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: { name: role.name, description: role.description },
    });
  }

  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: { description: permission.description },
      create: permission,
    });
  }

  const [roles, permissions] = await Promise.all([
    prisma.role.findMany(),
    prisma.permission.findMany(),
  ]);

  const roleByName = new Map(roles.map((role) => [role.name, role.id]));
  const permissionByName = new Map(permissions.map((permission) => [permission.name, permission.id]));

  for (const [roleName, permissionNames] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleByName.get(roleName);
    if (roleId === undefined) {
      throw new Error(`Seed invariant violated: role "${roleName}" not found`);
    }

    const rows = permissionNames.map((permissionName) => {
      const permissionId = permissionByName.get(permissionName);
      if (permissionId === undefined) {
        throw new Error(`Seed invariant violated: permission "${permissionName}" not found`);
      }
      return { roleId, permissionId };
    });

    await prisma.rolePermission.createMany({ data: rows, skipDuplicates: true });
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete: roles, permissions, and role->permission mappings are up to date.');
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
