const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const htmlArg = process.argv.find(arg => arg.startsWith('--html='));
const versionArg = process.argv.find(arg => arg.startsWith('--version='));
const htmlFile = htmlArg ? htmlArg.split('=')[1] : `bingo_wuerfel_app_ver${versionArg ? versionArg.split('=')[1] : '1.3'}.html`;
const htmlPath = path.isAbsolute(htmlFile) ? htmlFile : path.join(root, htmlFile);

function loadCore() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const match = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/);
  if (!match) throw new Error('Konnte den Babel-Scriptblock nicht finden.');
  const source = match[1];
  const cut = source.indexOf('function summarizeCards');
  if (cut < 0) throw new Error('Konnte die Grenze des reinen Logikblocks nicht finden.');
  let core = source.slice(0, cut);
  core = core.replace(/^\s*renderTask:.*$/gm, '');
  core += `
    globalThis.__MB_CORE__ = {
      EZ_PRESETS, visiblePresets, normalizeParams, encodeDisplayGameCode,
      parseGameCode, generateCards, buildDrawQueue, validatePools,
      countBingoPatterns
    };
  `;
  const context = {
    console,
    btoa: text => Buffer.from(text, 'binary').toString('base64'),
    atob: text => Buffer.from(text, 'base64').toString('binary'),
    React: {
      useEffect() {},
      useMemo() {},
      useState() { return [undefined, () => {}]; }
    }
  };
  vm.createContext(context);
  vm.runInContext(core, context, { filename: 'mb-core.js' });
  return context.__MB_CORE__;
}

function signature(cards) {
  return cards
    .map(card => `${card.id}:${card.entries.map(entry => entry.targetKey).join(',')}`)
    .join('\n');
}

function independentBingoCount(card, drawnKeys, rules, size) {
  const marked = card.entries.map(entry => drawnKeys.has(entry.targetKey));
  let count = 0;
  if (rules.rows) {
    for (let row = 0; row < size; row += 1) {
      if (Array.from({ length: size }, (_, col) => marked[row * size + col]).every(Boolean)) count += 1;
    }
  }
  if (rules.cols) {
    for (let col = 0; col < size; col += 1) {
      if (Array.from({ length: size }, (_, row) => marked[row * size + col]).every(Boolean)) count += 1;
    }
  }
  if (rules.diags) {
    if (Array.from({ length: size }, (_, index) => marked[index * size + index]).every(Boolean)) count += 1;
    if (Array.from({ length: size }, (_, index) => marked[index * size + (size - 1 - index)]).every(Boolean)) count += 1;
  }
  if (rules.corners) {
    const last = size - 1;
    if ([0, last, last * size, size * size - 1].every(index => marked[index])) count += 1;
  }
  if (rules.fullHouse && marked.every(Boolean)) count += 1;
  return count;
}

function verifyCase(core, testCase) {
  const params = core.normalizeParams(testCase.params);
  const cards = core.generateCards({ mode: testCase.mode, params, cardSeed: testCase.cardSeed });
  const code = core.encodeDisplayGameCode(testCase.mode, params, testCase.cardSeed, { cards });
  const parsed = core.parseGameCode(code);
  const parsedCards = core.generateCards({ mode: parsed.mode, params: parsed.params, cardSeed: parsed.cardSeed });
  if (signature(cards) !== signature(parsedCards)) {
    throw new Error(`${testCase.name}: Spielcode rekonstruiert andere Karten (${code}).`);
  }
  if (parsed.cards && signature(parsed.cards) !== signature(cards)) throw new Error(`${testCase.name}: Fingerabdruck-geprüfter Satz enthält andere Karten.`);

  const queue = core.buildDrawQueue({ mode: testCase.mode, params, roundSeed: testCase.roundSeed });
  const drawnKeys = new Set();
  let firstBingo = null;
  for (let drawIndex = 0; drawIndex < queue.length; drawIndex += 1) {
    // Use the same admitted answers as the played round. Mathematical admission
    // itself is checked independently in audit_s2_answers.js.
    for (const key of queue[drawIndex].acceptedTargetKeys || [queue[drawIndex].targetKey]) drawnKeys.add(key);
    for (const card of cards) {
      const appCount = core.countBingoPatterns(card, drawnKeys, testCase.rules, params.grid);
      const independentCount = independentBingoCount(card, drawnKeys, testCase.rules, params.grid);
      if (appCount !== independentCount) {
        throw new Error(`${testCase.name}: Abweichung bei Ziehung ${drawIndex + 1}, Karte #${card.id}: App=${appCount}, Kontrolle=${independentCount}.`);
      }
      if (!firstBingo && appCount > 0) firstBingo = { draw: drawIndex + 1, card: card.id, count: appCount };
    }
  }

  const fullDrawnKeys = new Set(queue.flatMap(entry => entry.acceptedTargetKeys || [entry.targetKey]));
  const cardsWithoutBingo = cards
    .filter(card => core.countBingoPatterns(card, fullDrawnKeys, testCase.rules, params.grid) <= 0)
    .map(card => card.id);
  if (cardsWithoutBingo.length) {
    throw new Error(`${testCase.name}: Nach voller Runde ohne Bingo: ${cardsWithoutBingo.slice(0, 20).join(', ')}.`);
  }

  return {
    name: testCase.name,
    mode: testCase.mode,
    cards: cards.length,
    targets: core.validatePools(testCase.mode, params).stats.uniqueTargets,
    draws: queue.length,
    firstBingo: firstBingo ? `${firstBingo.draw} (#${firstBingo.card})` : '-',
    code
  };
}

function main() {
  const core = loadCore();
  const defaultRules = { rows: true, cols: true, diags: true, corners: false, fullHouse: false };
  const cases = [
    { name: 'Multiplikation Preset 4', mode: 'multiplication', params: { n: 12, grid: 5, cards: 100 }, cardSeed: 'EZ-MUL-04', roundSeed: 'VERIFY-MUL-04', rules: defaultRules },
    { name: 'Multiplikation CHIOG Seed', mode: 'multiplication', params: { n: 8, grid: 4, cards: 30 }, cardSeed: 'CHIOG23RD53', roundSeed: 'VERIFY-CHIOG', rules: defaultRules },
    { name: 'Multiplikation n=30 Grenzfall', mode: 'multiplication', params: { n: 30, grid: 4, cards: 100 }, cardSeed: 'VERIFY-N30', roundSeed: 'VERIFY-N30', rules: defaultRules },
    { name: 'Multiplikation n=50 Maximalfall', mode: 'multiplication', params: { n: 50, grid: 4, cards: 100 }, cardSeed: 'VERIFY-N50', roundSeed: 'VERIFY-N50', rules: defaultRules }
  ];

  if (process.argv.includes('--all-presets')) {
    for (const preset of core.visiblePresets()) {
      cases.push({
        name: `Preset ${preset.id}`,
        mode: preset.mode,
        params: preset.params,
        cardSeed: preset.cardSeed,
        roundSeed: `VERIFY-${preset.id}`,
        rules: defaultRules
      });
    }
  }

  const results = cases.map(testCase => verifyCase(core, testCase));
  console.table(results);
  console.log(`OK: ${results.length} Kartenpruefungen ohne falsche Bingo-Zaehlung.`);
}

main();
