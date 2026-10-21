-- Separate CRM-only staff access from branch operations management.
BEGIN;

INSERT INTO "Role" ("id", "name", "description", "updatedAt")
VALUES (
  md5('branchsuite:role:SALES_MANAGER')::uuid::text,
  'SALES_MANAGER',
  'Sales workspace access for assigned branches',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO UPDATE
SET "description" = EXCLUDED."description", "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", permission."id"
FROM "Role" r
JOIN "Permission" permission ON permission."key" IN ('crm.read', 'crm.manage')
WHERE r."name" = 'SALES_MANAGER'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

COMMIT;
