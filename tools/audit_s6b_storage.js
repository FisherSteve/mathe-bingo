'use strict';
// Adversarial persistence inputs: execute the actual source helpers.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(require('node:path').join(__dirname, '../bingo_wuerfel_app_ver1.4.html'), 'utf8');
const source = html.slice(html.indexOf('    function isStoredScoreboard('), html.indexOf('    function physicalCardOrder('));
const scope = {}; vm.createContext(scope);
vm.runInContext(source + ';globalThis.api={isStoredScoreboard,readStoredScoreboard,writeStoredScoreboard};', scope);
const { isStoredScoreboard: valid, readStoredScoreboard: read, writeStoredScoreboard: write } = scope.api;
const row = { name: 'Prüfung', points: 1, wins: [{ card: 12, seed: 'S6B-R-01', roundId: 'S6B-W-01', setCode: 'G4-fixture', time: '10:00:00' }] };
const plain = x => JSON.parse(JSON.stringify(x));
const checks = [];
function test(name, fn) { fn(); checks.push(name); }
function store(raw) { return { raw, writes: 0, getItem() { return this.raw; }, setItem(key, value) { assert.equal(key, 'mb14-scoreboard'); this.raw = value; this.writes++; } }; }
test('Empty storage is usable without a mount-time write', () => {
  for (const raw of [null, '']) { const s = store(raw), result = read(() => s); assert.equal(result.entries.length, 0); assert(result.canWrite); assert.equal(s.writes, 0); }
});
test('Current and historical valid awards are preserved exactly', () => {
  for (const entries of [[], [row], [{ ...row, wins: [{ card: 1, seed: 'old', time: '09:00' }] }]]) {
    const text = JSON.stringify(entries), s = store(text), result = read(() => s);
    assert.deepEqual(plain(result.entries), entries); assert(result.canWrite); assert.equal(result.notice, ''); assert.equal(s.raw, text); assert.equal(s.writes, 0);
  }
});
const badRows = [null, {}, 1, 'text', { ...row, name: {} }, { ...row, name: '' }, { ...row, points: -1 }, { ...row, points: 1.2 }, { ...row, wins: null }, { ...row, wins: [null] }, { ...row, wins: [{ card: {} }] }, { ...row, wins: [{ card: 1, seed: {} }] }, { ...row, wins: [{ card: 1, time: [] }] }, { ...row, wins: [{ card: 1, roundId: 4 }] }, { ...row, wins: [{ card: 1, setCode: {} }] }];
test('Malformed JSON and unsafe React values never render and are not overwritten', () => {
  for (const raw of ['{', 'null', '{}', '42', '"text"', ...badRows.map(r => JSON.stringify([r]))]) {
    const s = store(raw), result = read(() => s); assert.equal(result.entries.length, 0, raw); assert.equal(result.canWrite, false, raw); assert(result.notice.includes('nicht überschrieben')); assert.equal(s.raw, raw); assert.equal(s.writes, 0);
  }
});
test('Storage access denied is a readable temporary-state fallback', () => {
  const result = read(() => { throw Error('denied'); }); assert.equal(result.entries.length, 0); assert(result.notice.includes('Neuladen')); assert.equal(result.canWrite, true);
});
test('Successful save round-trips without modifying the original awards', () => {
  const entries = plain([row]), before = JSON.stringify(entries), s = store(null);
  assert(write(entries, () => s)); assert.equal(JSON.stringify(entries), before); assert.deepEqual(plain(read(() => s).entries), entries); assert.equal(s.writes, 1);
});
test('Quota/access/stringification failures preserve in-memory awards and existing bytes', () => {
  for (const kind of ['access', 'quota']) {
    const entries = plain([row]), before = JSON.stringify(entries), s = store('original');
    s.setItem = () => { throw Error('QuotaExceededError'); };
    assert.equal(write(entries, () => { if (kind === 'access') throw Error('denied'); return s; }), false);
    assert.equal(JSON.stringify(entries), before); assert.equal(s.raw, 'original');
  }
  const circular = plain([row]); circular[0].extra = circular;
  assert.equal(write(circular, () => store(null)), false);
});
test('Invalid outgoing data cannot replace an existing valid score', () => {
  for (const entry of badRows) { const s = store('original'); assert.equal(write([entry], () => s), false); assert.equal(s.raw, 'original'); assert.equal(s.writes, 0); }
  assert.equal(valid([{ ...row, points: NaN }]), false); assert.equal(valid([{ ...row, points: Infinity }]), false);
});
console.log(JSON.stringify({ checks, invalidReadCases: 5 + badRows.length, summary: { passed: checks.length, failed: 0 }, limits: 'Actual UI effects, browser storage faults, offline startup and clipboard are separate browser tests.' }, null, 2));
