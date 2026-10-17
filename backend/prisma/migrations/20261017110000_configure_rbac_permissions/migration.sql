-- Install the application RBAC configuration on fresh and existing databases.
-- This creates permissions and role grants only; no users or business records.
BEGIN;

INSERT INTO "Permission" ("id", "key", "name", "updatedAt")
SELECT md5('branchsuite:permission:' || p.key)::uuid::text, p.key, p.name, CURRENT_TIMESTAMP
FROM (VALUES
  ('companies.read', 'View companies'),
  ('companies.manage', 'Manage companies'),
  ('branches.read', 'View branches'),
  ('branches.manage', 'Manage branches'),
  ('users.read', 'View users'),
  ('users.manage', 'Manage users'),
  ('crm.read', 'View CRM records'),
  ('crm.manage', 'Manage CRM records'),
  ('attendance.read', 'View attendance'),
  ('attendance.manage', 'Manage attendance'),
  ('payroll.read', 'View payroll'),
  ('payroll.manage', 'Manage payroll')
) AS p(key, name)
ON CONFLICT ("key") DO UPDATE SET "name" = EXCLUDED."name", "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Role" ("id", "name", "description", "updatedAt")
SELECT md5('branchsuite:role:' || r.name)::uuid::text, r.name, r.description, CURRENT_TIMESTAMP
FROM (VALUES
  ('BUSINESS_OWNER', 'Business owner with full permissions'),
  ('BUSINESS_ADMIN', 'Business administrator'),
  ('HR_MANAGER', 'Human resources manager'),
  ('PAYROLL_MANAGER', 'Payroll manager'),
  ('BRANCH_MANAGER', 'Branch operations manager'),
  ('EMPLOYEE', 'Standard employee')
) AS r(name, description)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM (VALUES
  ('BUSINESS_OWNER', 'companies.read'),
  ('BUSINESS_OWNER', 'companies.manage'),
  ('BUSINESS_OWNER', 'branches.read'),
  ('BUSINESS_OWNER', 'branches.manage'),
  ('BUSINESS_OWNER', 'users.read'),
  ('BUSINESS_OWNER', 'users.manage'),
  ('BUSINESS_OWNER', 'crm.read'),
  ('BUSINESS_OWNER', 'crm.manage'),
  ('BUSINESS_OWNER', 'attendance.read'),
  ('BUSINESS_OWNER', 'attendance.manage'),
  ('BUSINESS_OWNER', 'payroll.read'),
  ('BUSINESS_OWNER', 'payroll.manage'),
  ('BUSINESS_ADMIN', 'companies.read'),
  ('BUSINESS_ADMIN', 'companies.manage'),
  ('BUSINESS_ADMIN', 'branches.read'),
  ('BUSINESS_ADMIN', 'branches.manage'),
  ('BUSINESS_ADMIN', 'users.read'),
  ('BUSINESS_ADMIN', 'users.manage'),
  ('BUSINESS_ADMIN', 'crm.read'),
  ('BUSINESS_ADMIN', 'crm.manage'),
  ('BUSINESS_ADMIN', 'attendance.read'),
  ('BUSINESS_ADMIN', 'attendance.manage'),
  ('BUSINESS_ADMIN', 'payroll.read'),
  ('BUSINESS_ADMIN', 'payroll.manage'),
  ('HR_MANAGER', 'users.read'),
  ('HR_MANAGER', 'attendance.read'),
  ('HR_MANAGER', 'attendance.manage'),
  ('PAYROLL_MANAGER', 'users.read'),
  ('PAYROLL_MANAGER', 'attendance.read'),
  ('PAYROLL_MANAGER', 'payroll.read'),
  ('PAYROLL_MANAGER', 'payroll.manage'),
  ('BRANCH_MANAGER', 'branches.read'),
  ('BRANCH_MANAGER', 'users.read'),
  ('BRANCH_MANAGER', 'crm.read'),
  ('BRANCH_MANAGER', 'crm.manage'),
  ('BRANCH_MANAGER', 'attendance.read')
) AS grant_config(role_name, permission_key)
JOIN "Role" r ON r."name" = grant_config.role_name
JOIN "Permission" p ON p."key" = grant_config.permission_key
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

COMMIT;
