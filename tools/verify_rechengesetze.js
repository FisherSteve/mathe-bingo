'use strict';
// Check mathematical values independently of the generator, plus the actual renderer.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const babel = require('@babel/core'), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'bingo_wuerfel_app_ver1.4.html'), 'utf8');
let source = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/)[1];
source = source.slice(0, source.indexOf('function summarizeCards'));
source += ';globalThis.api = { EZ_PRESETS, GAME_MODES, buildSmartTasks, buildDrawQueue, normalizeParams, createCardSet, parseGameCode, packCodeParams, unpackCodeParams };';
const scope = { React, btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary') };
vm.createContext(scope);
vm.runInContext(babel.transformSync(source, { presets: ['@babel/preset-react'], configFile: false, babelrc: false }).code, scope);
const core = scope.api, families = ['commute', 'associate', 'brackets', 'lawsMixed'];

function evaluate(expression, limit, checkIntermediates = true) {
  assert(/^[\d\s+−()]+$/.test(expression), expression);
  const tokens = expression.match(/\d+|[+−()]/g);
  let index = 0;
  function atom() {
    if (tokens[index] === '(') {
      index++;
      const value = sum();
      assert.equal(tokens[index++], ')', expression);
      return value;
    }
    assert(/^\d+$/.test(tokens[index]), expression);
    const value = Number(tokens[index++]);
    assert(value >= 0 && value <= limit, expression);
    return value;
  }
  function sum() {
    let value = atom();
    while (tokens[index] === '+' || tokens[index] === '−') {
      const operator = tokens[index++], right = atom();
      value = operator === '+' ? value + right : value - right;
      if (checkIntermediates) assert(value >= 0 && value <= limit, expression);
    }
    return value;
  }
  const value = sum();
  assert.equal(index, tokens.length, expression);
  return value;
}

let expressions = 0, rounds = 0;
for (const smartLevel of ['easy', 'standard']) for (const smartFamily of families) {
  const params = core.normalizeParams({ smartLevel, smartFamily, grid: 3, cards: 60 });
  const tasks = core.buildSmartTasks(params), limit = smartLevel === 'easy' ? 100 : 1000, unit = limit / 10;
  assert.equal(new Set(tasks.map(t => t.targetKey)).size, 36);
  assert.equal(new Set(tasks.map(t => t.id)).size, tasks.length);
  if (smartLevel === 'standard') {
    const results = [...new Set(tasks.map(t => Number(t.targetKey)))];
    assert(results.every(n => n > 100 && n <= 1000));
    assert(results.filter(n => n % 10 !== 0).length >= 24, 'Use varied final digits in the range up to 1000.');
  }
  for (const task of tasks) {
    const expected = Number(task.targetKey);
    assert.equal(evaluate(task.label, limit), expected, task.label);
    for (const step of task.strategy.split(' = ')) assert.equal(evaluate(step, limit), expected, task.strategy);
    assert([...task.label.matchAll(/\d+/g)].every(m => Number(m[0]) > 0));
    if (task.subtype === 'commute') {
      const [a, b, c] = task.label.match(/\d+/g).map(Number);
      assert.equal((a + c) % unit, 0, task.label);
      assert.notEqual((a + b) % unit, 0, task.label);
      assert.notEqual((b + c) % unit, 0, task.label);
      assert(!/[−()]/.test(task.label));
    } else if (task.subtype === 'associate') {
      assert(!task.label.includes('−'));
      assert(task.label.includes('('));
    } else {
      assert.equal(task.subtype, 'brackets');
      assert(task.label.includes('− ('));
      // Ignoring the subtraction bracket must give a different answer.
      assert.notEqual(evaluate(task.label.replace(/[()]/g, ''), limit, false), expected, task.label);
    }
    // The task renderer must contain only the expression, with no strategy/result.
    assert.equal(renderToStaticMarkup(core.GAME_MODES.smartArithmetic.renderTask(task)), `<span data-testid="smart-task">${task.label}</span>`);
    expressions++;
  }
  for (let seed = 0; seed < 24; seed++) {
    const input = { mode: 'smartArithmetic', params, roundSeed: `LAWS-${seed}` };
    const queue = core.buildDrawQueue(input);
    assert.equal(queue.length, 36);
    assert.equal(new Set(queue.map(t => t.targetKey)).size, 36);
    assert.equal(JSON.stringify(queue), JSON.stringify(core.buildDrawQueue(input)));
    for (const task of queue) {
      assert.equal(evaluate(task.label, limit), Number(task.targetKey));
      assert.equal(JSON.stringify(task.acceptedTargetKeys), JSON.stringify([task.targetKey]));
    }
    if (smartFamily === 'lawsMixed') for (const f of families.slice(0, 3)) assert.equal(queue.filter(t => t.subtype === f).length, 12);
    rounds++;
  }
  // Include free-set boundaries and both parameter-payload lengths.
  for (const grid of [2, 3, 5]) for (const cards of [1, 60, 300]) {
    const p = core.normalizeParams({ ...params, grid, cards });
    const payload = core.packCodeParams('smartArithmetic', p);
    assert.equal(payload.length, smartFamily === 'lawsMixed' ? 4 : 3);
    const decoded = core.unpackCodeParams('smartArithmetic', payload);
    assert.equal(decoded.smartFamily, smartFamily);
    assert.equal(decoded.smartLevel, smartLevel);
    assert.equal(decoded.grid, grid);
    assert.equal(decoded.cards, cards);
  }
}

const allEasy = families.slice(0, 3).flatMap(smartFamily => core.buildSmartTasks(core.normalizeParams({ smartLevel: 'easy', smartFamily })));
for (const [label, result] of [['55 + 9 + 5', 69], ['31 − (10 − 9)', 30], ['21 + (18 + 12)', 51], ['12 + (19 + 21)', 52]]) {
  assert(allEasy.some(t => t.label === label && t.targetKey === String(result)), label);
}
const allStandard = families.slice(0, 3).flatMap(smartFamily => core.buildSmartTasks(core.normalizeParams({ smartLevel: 'standard', smartFamily })));
for (const [label, result] of [['550 + 90 + 50', 690], ['301 − (100 − 99)', 300], ['210 + (180 + 120)', 510], ['120 + (190 + 210)', 520]]) {
  assert(allStandard.some(t => t.label === label && t.targetKey === String(result)), label);
}
const smartPresets = core.EZ_PRESETS.filter(p => p.mode === 'smartArithmetic');
assert.equal(smartPresets.length, 18);
for (const p of smartPresets) {
  assert(p.label.startsWith(`Klasse 5 · bis ${p.params.smartLevel === 'easy' ? 100 : 1000}: `), p.label);
  assert(p.label.endsWith(` · ${p.params.grid}×${p.params.grid} · ${p.params.cards} Karten`), p.label);
}
const presets = smartPresets.filter(p => /^smart-1[1-8]$/.test(p.id));
assert.equal(presets.length, 8);
for (const level of ['easy', 'standard']) for (const family of families) {
  assert.equal(presets.filter(p => p.params.smartLevel === level && p.params.smartFamily === family).length, 1);
}
for (const preset of presets) {
  const set = core.createCardSet(preset);
  assert.equal(set.cards.length, 60);
  assert.equal(set.params.grid, 3);
  assert.equal(set.codeKind, 'preset');
  assert.equal(set.paperCode.replace(/-/g, '').length, 12);
  assert.equal(new Set(set.cards.map(c => [...c.entries.map(e => e.targetKey)].sort().join(','))).size, 60);
  for (const card of set.cards) assert.equal(new Set(card.entries.map(e => e.targetKey)).size, 9);
  for (const code of [set.paperCode, set.longCode]) {
    const parsed = core.parseGameCode(code);
    assert.equal(parsed.fingerprint, set.fingerprint);
    assert.equal(JSON.stringify(parsed.cards), JSON.stringify(set.cards));
  }
}

// Fixed pre-extension codes: round-tripping newly generated codes alone would
// miss an accidental change in the old three-bit family encoding.
for (const [id, code] of [
  ['smart-01', 'MB3.G4.F.S.AGK.APF4-UNU5-B386-4PBF-82SJ.CTH2-QLNH-CLG2-9JQB-BQK2.K8UF-NMA'],
  ['smart-05', 'MB3.G4.F.S.AGJ.APF4-UNU5-B386-4PBF-82UJ.4YAL-YBX9-NHD4-7T2B-G982.96D8-85A'],
  ['smart-10', 'MB3.G4.F.S.JGS.APF4-UNU5-B386-4PBF-86S2.A364-UMCC-LREL-2S32-3MA2.4MAF-842']
]) {
  const expected = core.createCardSet(core.EZ_PRESETS.find(p => p.id === id));
  assert.equal(expected.longCode, code, id);
  assert.equal(core.parseGameCode(code).fingerprint, expected.fingerprint, id);
}

console.log(`OK: ${expressions} Aufgaben samt Rechenwegen, ${rounds} vollständige Runden, 8 Vorlagen mit je 60 verschiedenen Karten, 18 eindeutige Zahlenraum-Namen, kurze und lange Spielcodes; Aufgabenanzeige ohne Hinweise.`);
