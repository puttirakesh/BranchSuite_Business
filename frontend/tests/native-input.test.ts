import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import React from 'react';
import ts from 'typescript';

const load = createRequire(import.meta.url);
const { renderToStaticMarkup } = load('react-dom/server') as { renderToStaticMarkup: (node: React.ReactNode) => string };

function renderInput(platform: string, props: Record<string, unknown> = {}, fontScale = 1) {
  const rendered: Record<string, any[]> = { View: [], Text: [], TextInput: [] };
  const flatten = (style: any): any => Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style || {};
  const element = (kind: string) => (attributes: any) => {
    rendered[kind].push({ ...attributes, style: flatten(attributes.style) });
    return React.createElement(React.Fragment, null, attributes.children);
  };
  const native = {
    Platform: { OS: platform },
    Dimensions: { get: () => ({ width: 390, height: 844, fontScale }), addEventListener: () => ({ remove() {} }) },
    StyleSheet: { create: (value: unknown) => value, flatten, absoluteFill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 } },
    View: element('View'), Text: element('Text'), TextInput: element('TextInput'),
    Animated: {
      Text: element('Text'),
      Value: class {
        constructor(public value: number) {}
        interpolate({ outputRange }: { outputRange: number[] }) { return outputRange[this.value ? 1 : 0]; }
      },
    },
  };
  const source = readFileSync(new URL('../src/ui/FloatingTextInput.tsx', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const component: any = {};
  new Function('require', 'exports', output)((name: string) => {
    if (name === 'react-native') return native;
    if (name === 'react') return React;
    if (name === 'react/jsx-runtime') return load('react/jsx-runtime');
    if (name === '../shared/validation/input') return load('../src/shared/validation/input');
    if (name === '../shared/theme/colors') return { colors: { primary: '#3157D5', danger: '#B94D61', input: '#FCFDFF', border: '#D6E0EF', text: '#1B2D4A', muted: '#586D8B' } };
    throw new Error(`Unexpected dependency: ${name}`);
  }, component);
  renderToStaticMarkup(React.createElement(component.FloatingTextInput, { label: 'Email', ...props }));
  return { field: rendered.View[0], label: rendered.Text[0], input: rendered.TextInput[0] };
}

for (const platform of ['android', 'ios']) {
  test(`${platform} fields reserve space for large text and keep filled labels above the border`, () => {
    const { field, label, input } = renderInput(platform, { value: 'person@example.com' }, 2);
    assert.equal(input.value, 'person@example.com');
    assert.equal(input.underlineColorAndroid, 'transparent');
    assert.equal(input.style.includeFontPadding, false);
    assert.equal(input.style.fontSize, 14);
    assert.ok(field.style.minHeight >= input.style.lineHeight * 2 + 20);
    assert.equal(field.style.overflow, 'visible');
    assert.equal(field.style.borderWidth, 1);
    assert.equal(input.style.flexGrow, 0, 'Editing must not make the field consume the resized viewport.');
    assert.ok(label.style.top + label.style.transform[0].translateY < 0);
    assert.equal(label.pointerEvents, 'none');
    assert.equal(label.style.backgroundColor, 'transparent');
    assert.equal(field.style.borderTopColor, 'transparent');
    assert.equal(label.style.fontSize, 14, 'Native labels animate transforms without relaying out their font.');
    assert.equal(label.style.transform[1].scale, 0.75);
    assert.equal(label.importantForAccessibility, 'no-hide-descendants');
  });
}

test('native multiline fields align text at the top and preserve input behavior', () => {
  const onChangeText = () => {};
  const { input, field } = renderInput('android', { multiline: true, value: 'A longer reason', onChangeText, keyboardType: 'default', maxLength: 1000 });
  assert.equal(input.multiline, true);
  assert.equal(input.style.textAlignVertical, 'top');
  assert.ok(field.style.minHeight >= 88);
  assert.equal(input.maxLength, 1000);
  assert.equal(input.keyboardType, 'default');
  assert.equal(typeof input.onChangeText, 'function');
});

test('web fields use compact text and keep floating labels above the border', () => {
  const { input, label } = renderInput('web', { value: 'person@example.com' });
  assert.equal(input.style.fontSize, 13);
  assert.equal(input.style.outlineWidth, 0);
  assert.equal(label.style.top, 13);
  assert.equal(label.style.transform[0].translateY, -22);
  assert.equal(label.style.backgroundColor, 'transparent');
});

for (const platform of ['android', 'ios', 'web']) {
  test(`${platform} disabled fields do not change form values`, () => {
    const changes: string[] = [];
    const { input } = renderInput(platform, { editable: false, value: 'Saved value', onChangeText: (value: string) => changes.push(value) });
    input.onChangeText('Changed value');
    assert.equal(changes.length, 0);
  });
  test(`${platform} manual date inputs reserve space for their calendar button`, () => {
    const { input } = renderInput(platform, { style: { paddingRight: 52 } });
    assert.equal(input.style.paddingRight, 52);
  });
  test(`${platform} input handlers reject invalid pasted numbers before updating form state`, () => {
    const changes: string[] = [];
    const { input } = renderInput(platform, { keyboardType: 'phone-pad', value: '987', onChangeText: (value: string) => changes.push(value) });
    input.onChangeText('987abc');
    assert.equal(changes.length, 0);
    input.onChangeText('9876543210');
    assert.deepEqual(changes, ['9876543210']);
    assert.equal(input.maxLength, 10);
    const { input: amount } = renderInput(platform, { keyboardType: 'decimal-pad', onChangeText: (value: string) => changes.push(value) });
    amount.onChangeText('1e3');
    amount.onChangeText('1.234');
    assert.deepEqual(changes, ['9876543210']);
    amount.onChangeText('1.25');
    assert.equal(changes.at(-1), '1.25');
  });
}
