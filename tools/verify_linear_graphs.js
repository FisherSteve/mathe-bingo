'use strict';
// Regression: every supported linear graph uses unit grid lines and axis ticks.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../bingo_wuerfel_app_ver1.4.html'), 'utf8');
const source = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/)[1];
const core = source.slice(0, source.indexOf('function summarizeCards')).replace(/^\s*renderTask:.*$/gm, '');
const plots = source.slice(source.indexOf('function graphYValue'), source.indexOf('function FunctionGraph'));
const scope = { React: {}, console, TextEncoder, TextDecoder,
  btoa: value => Buffer.from(value, 'binary').toString('base64'),
  atob: value => Buffer.from(value, 'base64').toString('binary') };
vm.createContext(scope);
vm.runInContext(core + plots + ';globalThis.api={graphLayout,graphScaleLabel,buildLinearFunctionTasks,buildLinearFunctionCards,normalizeParams,createCardSet,parseGameCode,EZ_PRESETS};', scope);
const api = scope.api, plain = value => JSON.parse(JSON.stringify(value));
const integers = (min, max) => Array.from({ length: max - min + 1 }, (_, i) => min + i);
let graphChecks = 0;
function checkGraph(item) {
  const g = api.graphLayout(item, 720, 520);
  assert.equal(g.xStep, 1); assert.equal(g.yStep, 1);
  assert.deepEqual(plain(g.xTicks), integers(g.bounds.xMin, g.bounds.xMax));
  assert.deepEqual(plain(g.yTicks), integers(g.bounds.yMin, g.bounds.yMax));
  assert(g.xTicks.includes(0) && g.yTicks.includes(0));
  for (const [x, y] of g.points) {
    assert.equal(y, item.m * x + item.b);
    assert(g.sx(x) > g.left && g.sx(x) < g.right);
    assert(g.sy(y) > g.top && g.sy(y) < g.bottom);
  }
  assert(g.segments.length > 0);
  for (const segment of g.segments) for (const [x, y] of segment) {
    assert(x >= g.left && x <= g.right && y >= g.top && y <= g.bottom);
  }
  for (const value of g.xLabels) assert(g.xTicks.includes(value));
  for (const value of g.yLabels) assert(g.yTicks.includes(value));
  assert(g.sx(g.xLabelStep) - g.sx(0) >= 32 - 1e-9);
  assert(g.sy(0) - g.sy(g.yLabelStep) >= 22 - 1e-9);
  assert(api.graphScaleLabel(item, g).startsWith('Gitter: x 1; y 1'));
  graphChecks++;
  return g;
}

// Entire offered range, including negative slopes/intercepts and all extremes.
for (let m = -12; m <= 12; m++) if (m) for (let b = -30; b <= 30; b++) {
  checkGraph({ graphType: 'linear', m, b, subtype: 'graphToFormula' });
  checkGraph({ graphType: 'linear', m, b }); // Formula-to-graph card, no subtype.
}

// Every standard graph and its printed target keep full integer number labels.
const presets = api.EZ_PRESETS.filter(p => p.mode === 'linearFunctions' && ['graphToFormula', 'formulaToGraph'].includes(p.params.linearFunctionTaskType));
assert.equal(presets.length, 2);
for (const preset of presets) {
  const params = api.normalizeParams(preset.params);
  const tasks = api.buildLinearFunctionTasks(params), cards = api.buildLinearFunctionCards(params);
  assert.equal(tasks.length, 104); assert.equal(cards.length, 104);
  const graphs = params.linearFunctionTaskType === 'graphToFormula' ? tasks : cards;
  for (const item of graphs) {
    const g = checkGraph(item);
    assert.equal(g.xLabelStep, 1); assert.equal(g.yLabelStep, 1);
  }
  // Frozen paper-code fingerprints protect the original cards and assignments.
  const set = api.createCardSet({ mode: preset.mode, params, cardSeed: preset.cardSeed });
  assert(set.paperCode.startsWith('B45'));
  const loaded = api.parseGameCode(set.paperCode);
  assert.equal(loaded.fingerprint, set.fingerprint);
  assert.deepEqual(plain(loaded.cards), plain(set.cards));
}

// Quadratic graph bounds, tick spacing and labels retain their existing behavior.
for (const [item, expectedBounds, xStep, yStep] of [
  [{ a: 1, b: 0, c: 0 }, { xMin: -3, xMax: 3, yMin: -2, yMax: 6 }, 1, 2],
  [{ a: 4, b: 3, c: -5 }, { xMin: -2, xMax: 6, yMin: -7, yMax: 13 }, 2, 5],
  [{ a: -3, b: -4, c: 6 }, { xMin: -7, xMax: 3, yMin: -8, yMax: 8 }, 2, 5]
]) {
  const g = api.graphLayout({ graphType: 'quadratic', ...item }, 720, 520);
  assert.deepEqual(plain(g.bounds), expectedBounds);
  assert.equal(g.xStep, xStep); assert.equal(g.yStep, yStep);
  assert.deepEqual(plain(g.xTicks), plain(g.xLabels));
  assert.deepEqual(plain(g.yTicks), plain(g.yLabels));
}
console.log(`OK: ${graphChecks} lineare Graphen mit 1er-Gitter; beide Vorlagen und quadratische Regression geprüft.`);
