import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

function fixture(failWrite = false) {
  const saved: { name?: string; mime?: string; bytes?: Buffer; deleted?: boolean } = {};
  const source = readFileSync(new URL('../src/core/admin/android-report-export.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const dependencies: Record<string, unknown> = {
    'expo-file-system': { Directory: { pickDirectoryAsync: async () => ({
      createFile(name: string, mime: string) {
        Object.assign(saved, { name, mime });
        return {
          write(data: string, options: { encoding: BufferEncoding }) {
            if (failWrite) throw new Error('Provider write failed');
            saved.bytes = Buffer.from(data, options.encoding);
          },
          delete() { saved.deleted = true; },
        };
      },
    }) } },
    'expo-print': { printToFileAsync: async (options: { base64: boolean }) => {
      assert.equal(options.base64, true);
      return {
        base64: Buffer.from('%PDF-1.7\nreport').toString('base64'),
        get uri() { throw new Error('Temporary file must never be accessed'); },
      };
    } },
  };
  const exports: any = {};
  new Function('require', 'exports', output)((name: string) => {
    assert.ok(name in dependencies, `Unexpected dependency ${name}`);
    return dependencies[name];
  }, exports);
  return { save: exports.saveAndroidReport, saved };
}

test('Android PDF writes decoded PDF data without accessing a temporary file or legacy API', async () => {
  const { save, saved } = fixture();
  await save('pdf', 'report', '', '<h1>Report</h1>');
  assert.equal(saved.name, 'report.pdf');
  assert.equal(saved.mime, 'application/pdf');
  assert.equal(saved.bytes?.toString(), '%PDF-1.7\nreport');
});

test('Android CSV preserves Unicode and removes an empty document on write failure', async () => {
  const { save, saved } = fixture();
  await save('csv', 'report', '\uFEFFName,Amount\nZoë,₹100', '');
  assert.equal(saved.bytes?.toString(), '\uFEFFName,Amount\nZoë,₹100');
  const failed = fixture(true);
  await assert.rejects(failed.save('csv', 'report', 'data', ''), /Could not save/);
  assert.equal(failed.saved.deleted, true);
});
