import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

function fixture(actorRole = "BUSINESS_OWNER") {
  const calls: { action: string; args: unknown[] }[] = [];
  const row = {
    id: "staff",
    name: "Staff",
    email: "staff@example.invalid",
    status: "ACTIVE",
    roles: [{ role: { name: "EMPLOYEE" } }],
    companyAccess: [{ company: { id: "company" } }],
    branchAccess: [{ branch: { id: "north", name: "Office" } }],
  };
  const api = Object.fromEntries(
    [
      "create",
      "update",
      "setRole",
      "replaceAccess",
      "activate",
      "deactivate",
    ].map((action) => [
      action,
      async (...args: unknown[]) => {
        calls.push({ action, args });
        return { id: "persisted-user" };
      },
    ]),
  );
  const dependencies: Record<string, unknown> = {
    "./api": { usersApi: { ...api, list: async () => [row] } },
    "./scope": {
      getAdminScope: async () => ({
        user: { id: "actor" },
        companyId: "company",
        role: actorRole,
      }),
      getCompanyBranches: async () => [
        { id: "north", name: "Office" },
        { id: "south", name: "Office" },
      ],
    },
    "./local": {},
  };
  const source = readFileSync(
    new URL("../src/core/admin/organisation.ts", import.meta.url),
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const repository: any = {};
  new Function("require", "exports", output)((name: string) => {
    if (!(name in dependencies))
      throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, repository);
  return { repository, calls };
}

test("roles and access saves replace branches by ID before changing the role", async () => {
  const { repository, calls } = fixture();
  const users = await repository.readAccessUsers();
  assert.deepEqual(users[0].branches, ["north"]);
  await repository.saveAccessUsers([
    { ...users[0], branches: ["south"], role: "HR Manager" },
  ]);
  assert.deepEqual(calls, [
    { action: "replaceAccess", args: ["staff", "company", ["south"]] },
    { action: "setRole", args: ["staff", "HR_MANAGER"] },
  ]);
});

test("new staff receive selected branches and role using their persisted user ID", async () => {
  const { repository, calls } = fixture();
  await repository.readAccessUsers();
  await repository.saveAccessUsers([
    {
      id: "draft",
      name: "New staff",
      email: "new@example.invalid",
      active: true,
      branches: ["south"],
      role: "Payroll Officer",
    },
  ]);
  assert.equal(calls[0].action, "create");
  assert.deepEqual(calls.slice(1), [
    { action: "replaceAccess", args: ["persisted-user", "company", ["south"]] },
    { action: "setRole", args: ["persisted-user", "PAYROLL_MANAGER"] },
  ]);
});

test("admins cannot promote staff to business admin; all branch access can be removed", async () => {
  const { repository, calls } = fixture("BUSINESS_ADMIN");
  const users = await repository.readAccessUsers();
  await assert.rejects(
    repository.saveAccessUsers([{ ...users[0], role: "Business Admin" }]),
    /Only a business owner/,
  );
  assert.deepEqual(calls, []);
  await repository.saveAccessUsers([{ ...users[0], branches: [] }]);
  assert.deepEqual(calls, [
    { action: "replaceAccess", args: ["staff", "company", []] },
  ]);
});
