import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import React from 'react';
import ts from 'typescript';

const load = createRequire(import.meta.url);
const { renderToStaticMarkup } = load('react-dom/server');

function compile(file: string, dependencies: Record<string, unknown>) {
  const output = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const component: any = {};
  new Function('require', 'exports', output)((name: string) => {
    if (name === 'react') return React;
    if (name === 'react/jsx-runtime') return load('react/jsx-runtime');
    assert.ok(name in dependencies, 'Unexpected module: ' + name);
    return dependencies[name];
  }, component);
  return component;
}

test('native forms delegate keyboard movement and preserve scrolling refs and callbacks', () => {
  let props: any;
  const handle = { scrollTo: () => {}, getNativeScrollRef: () => ({}) };
  const native = React.forwardRef((attributes: any, ref: any) => {
    props = attributes;
    ref(handle);
    return React.createElement(React.Fragment, null, attributes.children);
  });
  const component = compile('../src/ui/KeyboardAwareScrollView.native.tsx', {
    'react-native-keyboard-controller': { KeyboardAwareScrollView: native },
  });
  const ref = React.createRef();
  const onScroll = () => {}, onLayout = () => {}, onContentSizeChange = () => {};
  const contentContainerStyle = { paddingBottom: 36 };
  const result = renderToStaticMarkup(React.createElement(component.KeyboardAwareScrollView, {
    ref, onScroll, onLayout, onContentSizeChange, contentContainerStyle,
    automaticallyAdjustKeyboardInsets: true,
  }, 'Employee form'));
  assert.equal(result, 'Employee form');
  assert.equal(ref.current, handle, 'Existing wizard and validation scrollTo calls retain the native ref.');
  assert.equal(props.onScroll, onScroll);
  assert.equal(props.onLayout, onLayout);
  assert.equal(props.onContentSizeChange, onContentSizeChange);
  assert.equal(props.contentContainerStyle, contentContainerStyle, 'Do not add changing padding during keyboard animation.');
  assert.equal(props.automaticallyAdjustKeyboardInsets, false, 'Only the keyboard controller owns keyboard insets.');
  assert.equal(props.mode, 'insets');
  assert.equal(props.bottomOffset, 32);
  assert.equal(props.disableScrollOnKeyboardHide, true);
  assert.equal(props.keyboardShouldPersistTaps, 'handled');
});

test('web forms retain normal browser scrolling without importing native keyboard code', () => {
  let props: any;
  const component = compile('../src/ui/KeyboardAwareScrollView.tsx', {
    'react-native': { ScrollView: (attributes: any) => { props = attributes; return attributes.children; } },
  });
  const onScroll = () => {};
  assert.equal(renderToStaticMarkup(React.createElement(component.KeyboardAwareScrollView, { onScroll }, 'Web form')), 'Web form');
  assert.equal(props.onScroll, onScroll);
  assert.equal(props.keyboardShouldPersistTaps, 'handled');
  assert.equal(props.bottomOffset, undefined);
});

test('native keyboard provider wraps the app without opening a keyboard on startup', () => {
  let preload: unknown;
  const component = compile('../src/ui/AppKeyboardProvider.native.tsx', {
    'react-native-keyboard-controller': { KeyboardProvider: (props: any) => { preload = props.preload; return props.children; } },
  });
  assert.equal(renderToStaticMarkup(React.createElement(component.AppKeyboardProvider, null, 'Workspace')), 'Workspace');
  assert.equal(preload, false);
  const web = compile('../src/ui/AppKeyboardProvider.tsx', {});
  assert.equal(renderToStaticMarkup(React.createElement(web.AppKeyboardProvider, null, 'Workspace')), 'Workspace');
});
