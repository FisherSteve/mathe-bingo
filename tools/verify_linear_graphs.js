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
vm.runInContext(core + plots + ';globalThis.api={graphLayout,graphScaleLabel,graphAxisModel,buildLinearFunctionTasks,buildLinearFunctionCards,normalizeParams,createCardSet,parseGameCode,EZ_PRESETS};', scope);
const api = scope.api, plain = value => JSON.parse(JSON.stringify(value));
const integers = (min, max) => Array.from({ length: max - min + 1 }, (_, i) => min + i);
let graphChecks = 0;
function checkGraph(item, params) {
  const g = api.graphLayout(item, 720, 520, params);
  assert.equal(g.xStep, 1); assert.equal(g.yStep, 1);
  const unitX = g.sx(1) - g.sx(0), unitY = g.sy(0) - g.sy(1);
  assert(Math.abs(unitX - unitY) < 1e-9, 'An x- und y-Achse muss eine Einheit gleich lang sein.');
  assert.deepEqual([g.bounds.xMin, g.bounds.xMax], [g.bounds.yMin, g.bounds.yMax]);
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
  assert(g.sx(g.xLabelStep) - g.sx(0) >= 20 - 1e-9);
  assert(g.sy(0) - g.sy(g.yLabelStep) >= 20 - 1e-9);
  assert.equal(api.graphScaleLabel(item, g), '');
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
  let firstUnit;
  for (const item of graphs) {
    const g = checkGraph(item, params);
    const axes = api.graphAxisModel(item, g);
    assert.equal(axes.arrows.length, 2);
    assert(axes.xLabels.every(([v,x,y]) => v !== 0 && x === g.sx(v) && y === g.sy(0) + 20));
    assert(axes.yLabels.every(([v,x,y]) => v !== 0 && x === g.sx(0) - 12 && y === g.sy(v) + 4));
    const unit = g.sx(1) - g.sx(0);
    if (firstUnit === undefined) firstUnit = unit;
    assert.equal(unit, firstUnit, 'Der Abstand pro Einheit darf sich zwischen Geraden eines Satzes nicht ändern.');
    assert.equal(g.xLabelStep, 1); assert.equal(g.yLabelStep, 1);
  }
  // Frozen paper-code fingerprints protect the original cards and assignments.
  const set = api.createCardSet({ mode: preset.mode, params, cardSeed: preset.cardSeed });
  assert(set.paperCode.startsWith('B45'));
  const loaded = api.parseGameCode(set.paperCode);
  assert.equal(loaded.fingerprint, set.fingerprint);
  assert.deepEqual(plain(loaded.cards), plain(set.cards));
}

// Viewport depends only on the saved set parameters, including asymmetric pools.
for (const raw of [
  { linearFunctionSlopeMax: 1, linearFunctionBMax: 0 },
  { linearFunctionSlopeMax: 12, linearFunctionBMax: 0 },
  { linearFunctionSlopeMax: 2, linearFunctionBMax: 30, linearFunctionNegativeSlopes: false, linearFunctionNegativeIntercepts: false }
]) {
  const params = api.normalizeParams({ ...raw, linearFunctionTaskType: 'graphToFormula' });
  let expected;
  for (const item of api.buildLinearFunctionTasks(params)) {
    const g = checkGraph(item, params), unit = g.sx(1) - g.sx(0);
    if (!expected) expected = { unit, bounds: plain(g.bounds) };
    assert.equal(unit, expected.unit); assert.deepEqual(plain(g.bounds), expected.bounds);
  }
}

// Exercise the actual PDF drawing code with physical millimeter coordinates.
// Rectangular 2x2/3x3 cells must not stretch the square coordinate grid again.
const pdfSource = source.slice(source.indexOf('function drawFunctionGraphOnPdf'), source.indexOf('function drawGeometryFigureOnPdf'));
scope.activeParams = api.normalizeParams({ linearFunctionSlopeMax: 4, linearFunctionBMax: 6 });
vm.runInContext(pdfSource + ';globalThis.pdfGraph=drawFunctionGraphOnPdf;', scope);
for (const [w, h] of [[96.4, 57.65], [63.73, 37.9], [50, 90]]) {
  let firstUnit;
  for (const item of [{ m: 1, b: 0 }, { m: 4, b: 6 }, { m: -3, b: -5 }]) {
    const lines = [], doc = { line: (...coords) => lines.push(coords) };
    for (const method of ['setLineWidth','setDrawColor','setFont','setTextColor','setFontSize','text','setFillColor','circle','triangle']) doc[method] = () => {};
    scope.pdfGraph(doc, { graphType: 'linear', ...item }, 10, 20, w, h);
    const xGrid = lines.filter(([x1,y1,x2,y2]) => x1 === x2 && Math.abs(y2-y1) > 1);
    const yGrid = lines.filter(([x1,y1,x2,y2]) => y1 === y2 && Math.abs(x2-x1) > 1);
    assert(xGrid.length >= 17 && yGrid.length >= 17);
    const ux = xGrid[1][0] - xGrid[0][0], uy = yGrid[0][1] - yGrid[1][1];
    assert(Math.abs(ux-uy) < 1e-9, 'Quadratisches Gitter muss auch im PDF erhalten bleiben.');
    if (firstUnit === undefined) firstUnit = ux;
    assert.equal(ux, firstUnit);
  }
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
console.log(`OK: ${graphChecks} lineare Graphen mit quadratischem 1er-Gitter und gleichem Maßstab pro Satz; PDF und quadratische Regression geprüft.`);
