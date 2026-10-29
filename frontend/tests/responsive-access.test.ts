/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adminGrid, adminPageSpacing } from '../src/ui/adminResponsive';
import { canOpenAdminPath } from '../src/core/admin/access';
import type { AuthSession } from '../src/core/api/client';
import { screenClass } from '../src/ui/responsiveBreakpoints';

test('module dashboard cards retain standard columns and reflow for enlarged text', () => {
  for (const viewport of [280, 320, 360, 390, 600, 767, 768, 1024, 1199, 1200, 1440]) {
    const screen = screenClass(viewport);
    const content = viewport - adminPageSpacing(viewport) * 2;
    for (const fontScale of [1, 1.3, 1.8, 2.5]) {
      for (const kind of ['overview', 'workspace'] as const) {
        const grid = adminGrid(content, fontScale, kind, 12, screen);
        const standardColumns = screen === 'desktop' ? 3 : 2;
        if (fontScale === 1) assert.equal(grid.columns, standardColumns);
        else {
          assert.ok(grid.columns <= standardColumns);
          if (grid.columns > 1) assert.ok(grid.cardWidth >= (kind === 'workspace' ? 140 : 120) * fontScale);
        }
        assert.ok(grid.cardWidth > 0);
        assert.ok(Math.abs(grid.cardWidth * grid.columns + 12 * (grid.columns - 1) - content) < 0.01);
      }
    }
    if (screen === 'mobile') assert.equal(adminGrid(content, 1, 'records', 12, screen).columns, 1);
  }
});

test('admin grids fit phone, tablet, desktop and enlarged text sizes', () => {
  for (const viewport of [280, 320, 360, 390, 600, 768, 900, 1024, 1440, 1920, 2560]) {
    for (const fontScale of [1, 1.3, 1.8, 2.5]) for (const kind of ['overview', 'workspace', 'records'] as const) {
      const width = viewport - adminPageSpacing(viewport) * 2;
      const grid = adminGrid(width, fontScale, kind);
      assert.ok(grid.cardWidth > 0);
      assert.ok(grid.cardWidth * grid.columns + 12 * (grid.columns - 1) <= width + 0.01);
      if (kind === 'records' && grid.columns > 1) assert.ok(grid.cardWidth >= 280 * fontScale);
    }
  }
});

test('record grids respect the space remaining beside an expanded laptop sidebar', () => {
  for (const viewport of [1200, 1280, 1366, 1440, 1920]) {
    const page = Math.min(viewport - 248, 1280);
    const content = page - adminPageSpacing(page) * 2;
    const grid = adminGrid(content, 1, 'records', 12, screenClass(viewport));
    assert.ok(grid.cardWidth >= 280, `${viewport}px viewport leaves readable record cards`);
    assert.ok(grid.cardWidth * grid.columns + 12 * (grid.columns - 1) <= content);
  }
  assert.equal(adminGrid(832, 1, 'records', 12, 'desktop').columns, 2);
});

function session(role: string): AuthSession {
  return { user: { id: 'user', name: 'Test', email: 'test@example.invalid' }, memberships: [{ id: 'membership', tenantId: 'tenant', companyId: 'company', companyName: 'Test', role, permissions: [], branches: [{ id: 'branch', name: 'Branch' }] }] };
}
test('navigation reflects company-scoped roles and keeps employee accounts out of admin modules', () => {
  assert.equal(canOpenAdminPath(session('BUSINESS_OWNER'), 'company', '/admin/payroll'), true);
  assert.equal(canOpenAdminPath(session('BUSINESS_OWNER'), 'company', '/admin/departments'), true);
  assert.equal(canOpenAdminPath(session('BUSINESS_ADMIN'), 'company', '/admin/departments'), true);
  assert.equal(canOpenAdminPath(session('HR_MANAGER'), 'company', '/admin/departments'), false);
  assert.equal(canOpenAdminPath(session('BRANCH_MANAGER'), 'company', '/admin/departments'), false);
  assert.equal(canOpenAdminPath(session('BUSINESS_OWNER'), 'other-company', '/admin/payroll'), false);
  assert.equal(canOpenAdminPath(session('EMPLOYEE'), 'company', '/admin/dashboard'), false);
  assert.equal(canOpenAdminPath(session('BRANCH_MANAGER'), 'company', '/admin/crm'), true);
  assert.equal(canOpenAdminPath(session('BRANCH_MANAGER'), 'company', '/admin/payroll'), true);
  assert.equal(canOpenAdminPath(session('HR_MANAGER'), 'company', '/admin/leave-management'), true);
  assert.equal(canOpenAdminPath(session('HR_MANAGER'), 'company', '/admin/crm'), false);
  assert.equal(canOpenAdminPath(session('PAYROLL_MANAGER'), 'company', '/admin/payroll'), true);
  assert.equal(canOpenAdminPath(session('PAYROLL_MANAGER'), 'company', '/admin/employees/create'), false);
  assert.equal(canOpenAdminPath(session('SALES_MANAGER'), 'company', '/admin/crm'), true);
  assert.equal(canOpenAdminPath(session('SALES_MANAGER'), 'company', '/admin/attendance'), true);
  assert.equal(canOpenAdminPath(session('SALES_MANAGER'), 'company', '/admin/payroll'), false);
  for (const role of ['HR_MANAGER', 'PAYROLL_MANAGER', 'BRANCH_MANAGER']) {
    assert.equal(canOpenAdminPath(session(role), 'company', '/admin/roles-permissions'), false);
    assert.equal(canOpenAdminPath(session(role), 'company', '/admin/tasks/follow-ups'), role === 'BRANCH_MANAGER');
    assert.equal(canOpenAdminPath(session(role), 'company', '/admin/tasks'), role === 'BRANCH_MANAGER');
  }
});
