import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import * as payslips from '../src/features/employee/payslips';
import * as pdfContent from '../src/features/employee/payslip-pdf-content';

const entry = payslips.normalizePayslip({
  id: 'entry', currency: 'INR', basicAmount: '1000', grossAmount: '1000', deductionsAmount: '0', netAmount: '1000',
  components: [], run: { status: 'APPROVED', period: { year: 2026, month: 10 } }, payment: null,
});
const identity = { name: 'Employee', employeeId: 'EMP-1', company: 'Example' };

function fixture(platform: 'android' | 'ios', options: { cancel?: boolean; failWrite?: boolean; failShare?: boolean; noData?: boolean } = {}) {
  const saved: { name?: string; mime?: string; bytes?: Buffer; deleted?: boolean; shared?: boolean } = {};
  let prints = 0;
  const destination = {
    get exists() { return !!saved.bytes && !saved.deleted; },
    get size() { return saved.bytes?.length ?? 0; },
    uri: 'file:///cache/Payslip_2026_10.pdf',
    create() {},
    write(data: string, encoding: { encoding: BufferEncoding }) {
      if (options.failWrite) throw new Error('Provider write failed');
      saved.bytes = Buffer.from(data, encoding.encoding);
    },
    delete() { saved.deleted = true; },
  };
  const dependencies: Record<string, unknown> = {
    'react-native': { Platform: { OS: platform } },
    './payslips': payslips,
    './payslip-pdf-content': pdfContent,
    'expo-print': { printToFileAsync: async ({ base64 }: { base64: boolean }) => {
      prints++;
      assert.equal(base64, true);
      return {
        base64: options.noData ? undefined : Buffer.from('%PDF-1.7\npayslip').toString('base64'),
        get uri() { throw new Error('Print temporary URI must not be used'); },
      };
    } },
    'expo-file-system': {
      Directory: { pickDirectoryAsync: async () => {
        if (options.cancel) throw Object.assign(new Error('The file picker was cancelled by the user'), { code: 'ERR_PICKER_CANCELLED' });
        return { createFile(name: string, mime: string) { Object.assign(saved, { name, mime }); return destination; } };
      } },
      Paths: { cache: 'file:///cache' },
      File: class { constructor(folder: string, name: string) {
        assert.equal(folder, 'file:///cache'); saved.name = name; return destination;
      } },
    },
    'expo-sharing': {
      isAvailableAsync: async () => { assert.equal(platform, 'ios', 'Android download must not use sharing'); return true; },
      shareAsync: async (uri: string) => {
        assert.equal(uri, destination.uri);
        assert.ok(saved.bytes?.toString().startsWith('%PDF-'));
        if (options.failShare) throw new Error("ExpoSharing.shareAsync has been rejected");
        saved.shared = true;
      },
    },
  };
  function load(relative: string) {
    const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const exports: any = {};
    new Function('require', 'exports', output)((name: string) => {
      assert.ok(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    }, exports);
    return exports;
  }
  dependencies['../../core/admin/android-report-export'] = load('../src/core/admin/android-report-export.ts');
  return { save: () => load('../src/features/employee/payslip-pdf.native.ts').savePayslipPdf(entry, identity), saved, prints: () => prints };
}

test('Android payslip saves PDF bytes to a selected folder without using Expo Sharing or Print URI', async () => {
  const { save, saved } = fixture('android');
  assert.equal(await save(), 'saved');
  assert.equal(saved.name, 'Payslip_2026_10.pdf');
  assert.equal(saved.mime, 'application/pdf');
  assert.equal(saved.bytes?.toString(), '%PDF-1.7\npayslip');
});

test('Android cancellation does not print or show a native rejection; failed writes remove partial files', async () => {
  const cancelled = fixture('android', { cancel: true });
  assert.equal(await cancelled.save(), 'cancelled');
  assert.equal(cancelled.prints(), 0);
  const failed = fixture('android', { failWrite: true });
  await assert.rejects(failed.save(), /select another writable folder/);
  assert.equal(failed.saved.deleted, true);
  await assert.rejects(fixture('android', { noData: true }).save(), /PDF generation returned no data/);
});

test('iOS shares an app-owned named PDF and cleans it up after the share sheet closes', async () => {
  const { save, saved } = fixture('ios');
  assert.equal(await save(), 'shared');
  assert.equal(saved.name, 'Payslip_2026_10.pdf');
  assert.equal(saved.shared, true);
  assert.equal(saved.deleted, true);
});

test('iOS sharing rejection gives actionable feedback and removes the cache file', async () => {
  const failed = fixture('ios', { failShare: true });
  await assert.rejects(failed.save(), /Could not open the share sheet/);
  assert.equal(failed.saved.deleted, true);
  const writeFailed = fixture('ios', { failWrite: true });
  await assert.rejects(writeFailed.save(), /Could not prepare your payslip PDF/);
  assert.equal(writeFailed.saved.deleted, true);
});
