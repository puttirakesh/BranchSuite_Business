import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

function files(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(root, entry.name)) : entry.name.endsWith('.tsx') ? [path.join(root, entry.name)] : []);
}

test('all manual React Native inputs use the shared floating-label control', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const unstyled: string[] = [];
  for (const file of [...files(path.join(root, 'app')), ...files(path.join(root, 'src'))]) {
    if (file.endsWith(`${path.sep}FloatingTextInput.tsx`)) continue;
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    for (const node of source.statements) {
      if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier) || node.moduleSpecifier.text !== 'react-native') continue;
      if (node.importClause?.isTypeOnly) continue;
      const bindings = node.importClause?.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) continue;
      const input = bindings.elements.find(item => (item.propertyName ?? item.name).text === 'TextInput' && !item.isTypeOnly);
      if (!input) continue;
      // A plain web-only sidebar search is intentional. Check every actual native
      // field, while allowing TextInput imports used for refs or focus APIs.
      const visit = (element: ts.Node) => {
        if ((ts.isJsxOpeningElement(element) || ts.isJsxSelfClosingElement(element)) && element.tagName.getText(source) === input.name.text) {
          let webOnly = false;
          for (let child: ts.Node = element, parent = child.parent; parent; child = parent, parent = parent.parent) {
            if (ts.isConditionalExpression(parent) && parent.whenTrue === child && /^Platform\.OS\s*===\s*['"]web['"]$/.test(parent.condition.getText(source))) webOnly = true;
          }
          if (!webOnly) unstyled.push(path.relative(root, file));
        }
        ts.forEachChild(element, visit);
      };
      visit(source);
    }
  }
  assert.deepEqual(unstyled, [], 'Import FloatingTextInput for manual fields so labels and focus styles stay consistent.');
});

test('Android forms let the window resize without a second keyboard height adjustment', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const config = JSON.parse(readFileSync(path.join(root, 'app.json'), 'utf8'));
  assert.equal(config.expo.android.softwareKeyboardLayoutMode, 'resize');
  let checked = 0;
  for (const file of [...files(path.join(root, 'app')), ...files(path.join(root, 'src'))]) {
    // react-native-keyboard-controller's view is native-driven, so it cannot double-adjust the Android window.
    if (readFileSync(file, 'utf8').includes("from 'react-native-keyboard-controller'")) continue;
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node) => {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(source) === 'KeyboardAvoidingView') {
        const enabled = node.attributes.properties.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === 'enabled');
        assert.ok(enabled && ts.isJsxAttribute(enabled) && enabled.initializer && ts.isJsxExpression(enabled.initializer) && enabled.initializer.expression, `${path.relative(root, file)} must explicitly disable JS keyboard adjustment on Android.`);
        if (enabled && ts.isJsxAttribute(enabled) && enabled.initializer && ts.isJsxExpression(enabled.initializer) && enabled.initializer.expression) {
          const readEnabled = new Function('Platform', `return (${enabled.initializer.expression.getText(source)});`);
          assert.equal(readEnabled({ OS: 'android' }), false);
          assert.equal(readEnabled({ OS: 'ios' }), true);
        }
        const behavior = node.attributes.properties.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === 'behavior');
        if (behavior && ts.isJsxAttribute(behavior) && behavior.initializer && ts.isJsxExpression(behavior.initializer) && behavior.initializer.expression) {
          const readBehavior = new Function('Platform', `return (${behavior.initializer.expression.getText(source)});`);
          assert.equal(readBehavior({ OS: 'android' }), undefined, `${path.relative(root, file)} must rely on Android resize.`);
          assert.equal(readBehavior({ OS: 'ios' }), 'padding');
          checked++;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.ok(checked >= 1, 'Remaining keyboard padding containers were checked; workspace forms use native scroll insets.');
});
