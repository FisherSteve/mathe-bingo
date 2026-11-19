'use strict';
// Check the exact release artefact as well as the authoring-to-runtime link.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict'), vm = require('node:vm'), postcss = require('postcss');
const { generate } = require('./build_standalone');
const root = path.resolve(__dirname, '..'), sha = value => crypto.createHash('sha256').update(value).digest('hex');
const checks = [];
function test(name, action) { action(); checks.push(name); }
(async () => {
  const a = await generate(), b = await generate();
  const bytes = fs.readFileSync(path.join(root, 'index.html')), text = bytes.toString('utf8');
  test('Two independent builds equal the committed product byte-for-byte', () => {
    assert.equal(a.product, b.product); assert(bytes.equals(Buffer.from(a.product))); assert(!text.includes('\r'));
  });
  const scripts = [...text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  test('Exactly three local runtimes, build metadata and compiled application; no runtime compiler', () => {
    assert.equal(scripts.length, 5);
    assert.deepEqual(scripts.slice(0, 3).map(m => m[1].match(/data-runtime="([^"]+)"/)[1]), ['react', 'react-dom', 'jspdf']);
    for (const block of scripts) assert(!/\bsrc=|text\/babel/.test(block[1]));
    for (const block of scripts.filter(m => !m[1].includes('application/json'))) new vm.Script(block[2]);
  });
  test('Embedded build manifest binds all source, compiler, CSS and runtime versions', () => {
    const info = JSON.parse(scripts[3][2]); assert.deepEqual(info, a.info);
    assert.equal(info.format, 'MATHE-BINGO-STANDALONE'); assert.equal(info.runtime.length, 3);
    assert.equal(info.buildTools.react, '18.3.1'); assert.equal(info.buildTools['react-dom'], '18.3.1'); assert.equal(info.buildTools.jspdf, '2.5.1');
    assert.equal(sha(scripts[4][2].trim()), info.compiledSHA256);
    const css = text.match(/<style id="bingo-utilities">\n([\s\S]*?)\n  <\/style>/)[1]; assert.equal(sha(css), info.cssSHA256);
  });
  test('Styles are already generated and request no external fonts/imports/images', () => {
    const markup = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    const styles = [...markup.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]; assert.equal(styles.length, 2);
    for (const style of styles) {
      const ast = postcss.parse(style[1]); ast.walkAtRules('import', () => assert.fail('External CSS import'));
      ast.walkDecls(decl => assert(!/url\(\s*['"]?https?:/i.test(decl.value)));
    }
    assert(text.includes('.s6-panel')); assert(text.includes('.fs-overlay')); assert(text.includes('.bingo-preview'));
  });
  test('Delivered folder contains only the identical index.html', () => {
    assert.deepEqual(fs.readdirSync(path.join(root, 'output/portable')), ['index.html']);
    assert(fs.readFileSync(path.join(root, 'output/portable/index.html')).equals(bytes));
  });
  test('Runtime licenses and mathematical PDF font are embedded', () => {
    for (const name of ['react 18.3.1', 'react-dom 18.3.1', 'jspdf 2.5.1', 'tailwindcss 3.4.17']) assert(text.includes(name));
    assert(text.includes('Permission is hereby granted')); assert(text.includes('PDF_MATH_FONT')); assert(text.includes('MatheBingoMath'));
    assert(!scripts.some(s => /^\/\/[#@] sourceMappingURL=/m.test(s[2])));
  });
  console.log(JSON.stringify({ productSHA256: sha(bytes), bytes: bytes.length, checks, summary: { passed: checks.length, failed: 0 }, limits: 'Real browser network, storage and rendered PDF checks are separate tests.' }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
