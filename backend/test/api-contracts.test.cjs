const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function files(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? ['node_modules', '.expo', 'dist'].includes(entry.name) ? [] : files(path.join(root, entry.name)) : /\.tsx?$/.test(entry.name) ? [path.join(root, entry.name)] : []);
}
const literal = node => node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined;
const normalize = value => value.replace(/\/+$/, '').replace(/:[\w]+/g, ':param');

test('frontend API methods and paths have matching backend routes', () => {
  const routes = new Set();
  for (const file of files(path.join(__dirname, '../src/modules'))) {
    if (!file.endsWith('.controller.ts')) continue;
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    let prefix;
    const visit = node => {
      if (ts.isClassDeclaration(node)) {
        for (const decorator of ts.getDecorators(node) ?? []) {
          const expression = decorator.expression;
          if (ts.isCallExpression(expression) && expression.expression.getText(source) === 'Controller') prefix = literal(expression.arguments[0]) ?? '';
        }
      }
        if (ts.isMethodDeclaration(node)) for (const decorator of ts.getDecorators(node) ?? []) {
        const expression = decorator.expression;
        if (!ts.isCallExpression(expression)) continue;
        const verb = expression.expression.getText(source).toUpperCase();
        if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(verb)) continue;
        const route = [prefix, literal(expression.arguments[0])].filter(Boolean).join('/');
        routes.add(`${verb} ${normalize(`/${route}`)}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  const missing = [];
  for (const file of files(path.join(__dirname, '../../frontend')).filter(file => !/[\\/](node_modules|\.expo)[\\/]/.test(file))) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = node => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(source) === 'api') {
        const verb = node.expression.name.text.toUpperCase();
        const argument = node.arguments[0];
        let route = literal(argument);
        if (argument && ts.isTemplateExpression(argument)) route = argument.head.text + argument.templateSpans.map(span => ':param' + span.literal.text).join('');
        if (route?.startsWith('/') && ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(verb)) {
          const target = `${verb} ${normalize(route)}`;
          const segments = target.split('/');
          const exists = [...routes].some(candidate => candidate.split('/').length === segments.length && candidate.split('/').every((part, index) => segments[index] === ':param' || segments[index] === part));
          if (!exists) missing.push(`${path.relative(path.join(__dirname, '../..'), file)}: ${verb} ${route}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.deepEqual(missing, []);
});
