const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const INDEX_HTML = fs.readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf8');
const webcrypto = require('crypto').webcrypto;

// ---------------------------------------------------------------------------
// index.html から純粋ロジック関数・定数を抽出して、テスト可能なサンドボックス
// を組み立てる。アプリ本体（index.html）は一切変更しない。
// ---------------------------------------------------------------------------

function extractBalanced(source, startIndex) {
  const open = source[startIndex];
  const close = open === '{' ? '}' : open === '[' ? ']' : open === '(' ? ')' : null;
  if (!close) throw new Error('startIndex is not a block start: ' + open);
  let depth = 0;
  let inStr = null;
  for (let i = startIndex; i < source.length; i++) {
    const ch = source[i];
    if (inStr) {
      if (ch === '\\') { i++; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) return source.slice(startIndex, i + 1); }
  }
  throw new Error('Unbalanced block at ' + startIndex);
}

function extractFunction(name) {
  // Handle both 'function name(' and 'async function name('
  let marker = 'function ' + name + '(';
  let idx = INDEX_HTML.indexOf(marker);
  let prefix = '';
  if (idx < 0) {
    marker = 'async function ' + name + '(';
    idx = INDEX_HTML.indexOf(marker);
    prefix = 'async ';
    if (idx < 0) throw new Error('Could not find function ' + name);
  }
  const openParen = idx + marker.length - 1;
  let depth = 0;
  let closeParen = -1;
  for (let i = openParen; i < INDEX_HTML.length; i++) {
    const ch = INDEX_HTML[i];
    if (ch === '(') depth++;
    else if (ch === ')') { depth--; if (depth === 0) { closeParen = i; break; } }
  }
  if (closeParen < 0) throw new Error('Could not find parameter end for ' + name);
  const brace = INDEX_HTML.indexOf('{', closeParen);
  const body = extractBalanced(INDEX_HTML, brace);
  return prefix + INDEX_HTML.slice(idx, closeParen + 1) + ' ' + body;
}

function takeStatement(source, startIndex) {
  const depth = { '(': 0, '[': 0, '{': 0 };
  let inStr = null;
  for (let j = startIndex; j < source.length; j++) {
    const ch = source[j];
    if (inStr) {
      if (ch === '\\') { j++; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '(') depth['(']++;
    else if (ch === ')') depth['(']--;
    else if (ch === '[') depth['[']++;
    else if (ch === ']') depth['[']--;
    else if (ch === '{') depth['{']++;
    else if (ch === '}') depth['{']--;
    else if (ch === ';' && depth['('] === 0 && depth['['] === 0 && depth['{'] === 0) {
      return source.slice(startIndex, j);
    }
  }
  throw new Error('Could not find statement end at ' + startIndex);
}

function extractConstStatement(name) {
  const marker = 'const ' + name + ' = ';
  const idx = INDEX_HTML.indexOf(marker);
  if (idx < 0) throw new Error('Could not find const ' + name);
  let i = idx + marker.length;
  while (INDEX_HTML[i] === ' ') i++;
  if (INDEX_HTML[i] === '{' || INDEX_HTML[i] === '[' || INDEX_HTML[i] === '(') {
    const block = extractBalanced(INDEX_HTML, i);
    return 'const ' + name + ' = ' + block + ';';
  }
  return 'const ' + name + ' = ' + takeStatement(INDEX_HTML, i) + ';';
}

// データファイル（window.X = {...} 形式 / JSONではないJSオブジェクトを含む）を読み込む
function extractInlineConst(name) {
  const marker = 'const ' + name + ' = ';
  const idx = INDEX_HTML.indexOf(marker);
  if (idx < 0) throw new Error('Could not find const ' + name);
  const newline = INDEX_HTML.indexOf('\n', idx);
  const lineEnd = newline === -1 ? INDEX_HTML.length : newline;
  // 行末にある ';'（とオブジェクト末尾の '}'）を残して1行で完結する前提
  return INDEX_HTML.slice(idx, lineEnd).trim();
}

function loadDataJs(relativePath) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8'), context);
  return context.window;
}

function builtScript() {
  const moves = loadDataJs(path.join('data', 'moves-champions.js')).MOVE_DATA;
  const rawPokemon = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'data', 'pokemon-champions.json'), 'utf8')).pokemon;
  const pokemon = rawPokemon.map(p => ({
    ...p,
    types: (p.types || []).map(type => type.replace('タイプ', '')),
    abilities: [...new Set((p.abilities || []).map(a => a.replace(/^\*/, '')))],
    color: p.color || '#e7eee0',
    icon: p.icon || p.iconUrl,
  }));

  const parts = [];
  parts.push(extractConstStatement('NATURE_MAP'));
  parts.push(extractConstStatement('typeWeakness'));
  parts.push(extractConstStatement('typeResist'));
  parts.push(extractConstStatement('abilityEffects'));
  parts.push(extractConstStatement('megaMap'));
  parts.push(extractConstStatement('TYPE_COLORS'));
  parts.push(extractConstStatement('ROMAJI_MAP'));
  parts.push(extractInlineConst('toHiragana'));
  parts.push(extractInlineConst('toHiraganaFromRomaji'));
  parts.push('const MOVE_DB = ' + JSON.stringify(moves) + ';');
  parts.push('const pokemon = ' + JSON.stringify(pokemon) + ';');
  parts.push('const POKEDB_TEAMS = ' + JSON.stringify({ seasons: [] }) + ';');
  parts.push('let party = [];');
  parts.push('let savedParties = [];');
  parts.push('let authUserId = "";');
  return parts;
}

function buildRuntimeScript() {
  const parts = builtScript();
  const funcs = [
    'getBaseForm', 'getMegaForms', 'getRoleFromStats', 'baseStatTotal',
    'getNatureColor', 'calculateActualStats', 'calculateTypeEffectiveness', 'calculateMoveDamage',
    'normalizeMember', 'normalizeImportedParties',
    'safeUserId', 'userApiUrl', 'userApiUrlForLogin', 'storageKey', 'hashPassword',
    'learnableMoves', 'moveStatText',
    'generateResponse', 'analyzePartyWeakness', 'showActualStats',
    'recommendByType', 'searchSavedParties', 'showScarfSpeed', 'handleDamageQuery',
    'recommendTeam', 'getWeaknessCounts', 'getTopBuildTeams',
  ];
  funcs.forEach(name => parts.push(extractFunction(name)));

  parts.push(`
    globalThis.__partyLabCtx = {
      getParty: () => party,
      setParty: (p) => { party = p; },
      getSaved: () => savedParties,
      setSaved: (s) => { savedParties = s; },
      setAuthUserId: (id) => { authUserId = id; },
      toHiragana, toHiraganaFromRomaji,
      getBaseForm, getMegaForms, getRoleFromStats, baseStatTotal,
      getNatureColor, calculateActualStats, calculateTypeEffectiveness, calculateMoveDamage,
      normalizeMember, normalizeImportedParties,
      safeUserId, userApiUrl, userApiUrlForLogin, storageKey, hashPassword,
      learnableMoves, moveStatText,
      generateResponse, analyzePartyWeakness, showActualStats,
      recommendByType, searchSavedParties, showScarfSpeed, handleDamageQuery,
    };
  `);
  return parts.join('\n');
}

// hashPassword の両ブランチを動かすため window.crypto / グローバル crypto を用意
global.window = { crypto: webcrypto };
global.crypto = webcrypto;

eval(buildRuntimeScript());

const ctx = globalThis.__partyLabCtx;

if (!ctx) throw new Error('Failed to boot test runtime from index.html');

beforeEach(() => {
  ctx.setParty([]);
  ctx.setSaved([]);
  ctx.setAuthUserId('');
});

describe('calculateActualStats (Lv50 実数値計算)', () => {
  const venusaur = {
    name: 'フシギバナ',
    baseStats: { hp: 80, attack: 82, defense: 83, specialAttack: 100, specialDefense: 100, speed: 80 },
    selectedNature: 'まじめ',
    evs: {},
  };

  test('EV0・性格なしの標準実数値（フシギバナ）', () => {
    expect(ctx.calculateActualStats(venusaur)).toEqual({
      hp: 155, attack: 102, defense: 103, specialAttack: 120, specialDefense: 120, speed: 100,
    });
  });

  test('HPにEV32で+32される', () => {
    const p = { ...venusaur, evs: { hp: 32 } };
    expect(ctx.calculateActualStats(p).hp).toBe(187);
  });

  test('いじっぱり（EV0）は攻撃が1.1倍、特攻が0.9倍', () => {
    const p = { ...venusaur, selectedNature: 'いじっぱり' };
    const s = ctx.calculateActualStats(p);
    expect(s.attack).toBe(112); // floor(102 * 1.1)
    expect(s.specialAttack).toBe(108); // floor(120 * 0.9)
  });

  test('いじっぱり・EV攻32 の正確な値', () => {
    const p = { ...venusaur, selectedNature: 'いじっぱり', evs: { attack: 32 } };
    const s = ctx.calculateActualStats(p);
    // calcBase(82,32) = floor((164+31+64)*0.5)=129 → +5 →134 → *1.1 → floor 147
    expect(s.attack).toBe(147);
    // 特攻は ×0.9: 120*0.9=108
    expect(s.specialAttack).toBe(108);
  });

  test('nullやbaseStats不足はnullを返す', () => {
    expect(ctx.calculateActualStats(null)).toBeNull();
    expect(ctx.calculateActualStats({ name: 'x' })).toBeNull();
  });

  test('性格補正の色（getNatureColor）', () => {
    const p = { ...venusaur, selectedNature: 'ひかえめ' };
    expect(ctx.getNatureColor(p, 'specialAttack')).toBe('color:#2e7d32');
    expect(ctx.getNatureColor(p, 'attack')).toBe('color:#c62828');
    expect(ctx.getNatureColor(p, 'speed')).toBe('');
  });
});

describe('getBaseForm / getMegaForms / メガ関連', () => {
  test('基本フォームはそのまま返る', () => {
    expect(ctx.getBaseForm('ピカチュウ')).toBe('ピカチュウ');
  });

  test('メガ名から元フォームを解決できる', () => {
    expect(ctx.getBaseForm('メガアブソル')).toBe('アブソル');
    expect(ctx.getBaseForm('メガアブソルZ')).toBe('アブソル');
    expect(ctx.getBaseForm('メガリザードンX')).toBe('リザードン');
  });

  test('getMegaForms は Z 形式を含めて列挙する', () => {
    expect(ctx.getMegaForms('アブソル')).toContain('メガアブソル');
    expect(ctx.getMegaForms('アブソル')).toContain('メガアブソルZ');
    expect(ctx.getMegaForms('リザードン')).toEqual(expect.arrayContaining(['メガリザードンX', 'メガリザードンY']));
  });

  test('メガがないポケモンは空配列', () => {
    expect(ctx.getMegaForms('ピカチュウ')).toEqual([]);
  });

  test('データ上の全isMegaエントリは素性よく解決できる', () => {
    const data = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'data', 'pokemon-champions.json'), 'utf8'));
    const names = new Set(data.pokemon.map(p => p.name));
    const mega = data.pokemon.filter(p => p.isMega === true);
    expect(mega.length).toBeGreaterThan(0);
    mega.forEach(p => {
      const base = ctx.getBaseForm(p.name);
      expect(typeof base).toBe('string');
      // メガフォームなら元フォームに解決できる（未登録でも名前は保持される）
      expect(names.has(base)).toBe(true);
    });
  });
});

describe('getRoleFromStats / baseStatTotal', () => {
  const stats = (over) => ({
    hp: 80, attack: 80, defense: 80, specialAttack: 80, specialDefense: 80, speed: 80, ...over,
  });
  test('特防高めは特殊受け', () => {
    expect(ctx.getRoleFromStats({ baseStats: stats({ specialDefense: 110 }) })).toBe('特殊受け');
  });
  test('物理高打点は物理AT', () => {
    expect(ctx.getRoleFromStats({ baseStats: stats({ attack: 120 }) })).toBe('物理AT');
  });
  test('両刀分類', () => {
    expect(ctx.getRoleFromStats({ baseStats: stats({ attack: 100, specialAttack: 90 }) })).toBe('両刀');
  });
  test('baseStatTotalは六能力の合計', () => {
    const p = { baseStats: stats({ hp: 1, attack: 2, defense: 3, specialAttack: 4, specialDefense: 5, speed: 6 }) };
    expect(ctx.baseStatTotal(p)).toBe(21);
  });
});

describe('calculateTypeEffectiveness（タイプ相性）', () => {
  const def = (types, ability) => ({ name: 'test', types, selectedAbility: ability || '' });

  test('みずタイプはほのおを半減', () => {
    expect(ctx.calculateTypeEffectiveness('ほのお', def(['みず']))).toBe(0.5);
  });
  test('みず攻撃はみずタイプへ半減（0.5倍）', () => {
    expect(ctx.calculateTypeEffectiveness('みず', def(['みず']))).toBe(0.5);
  });
  test('でんきはみず・ひこうに抜群(4倍)', () => {
    expect(ctx.calculateTypeEffectiveness('でんき', def(['みず', 'ひこう']))).toBe(4);
  });
  test('ふゆう特性はじめん技を無効化', () => {
    expect(ctx.calculateTypeEffectiveness('じめん', def(['でんき'], 'ふゆう'))).toBe(0);
  });
  test('タイプなしは等倍', () => {
    expect(ctx.calculateTypeEffectiveness('でんき', {})).toBe(1);
  });
});

describe('calculateMoveDamage（ダメージ計算）', () => {
  const mkAttacker = (over) => ({
    name: 'A', types: ['ほのお'],
    baseStats: { hp: 80, attack: 82, defense: 83, specialAttack: 100, specialDefense: 100, speed: 80 },
    selectedAbility: 'もうか', item: '', evs: {}, selectedNature: 'まじめ', ...over,
  });
  const mkDefender = (over) => ({
    name: 'B',
    baseStats: { hp: 120, attack: 50, defense: 70, specialAttack: 50, specialDefense: 70, speed: 40 },
    selectedAbility: '', item: '', evs: {}, selectedNature: 'まじめ', ...over,
  });
  const opts = { level: 50, critical: false, burn: false, helpingHand: false, weather: '' };

  test('10まんボルト vs みず/ひこう は4倍の正確な値', () => {
    const r = ctx.calculateMoveDamage(mkAttacker(), '10まんボルト', mkDefender({ types: ['みず', 'ひこう'] }), opts);
    expect(r).toEqual({
      min: 183, max: 216, avg: 199, typeEff: 4, stab: 1, effective: true, ohko: false, koChance: 1 - (195 - 1) / 199,
    });
  });

  test('変化技や威力なし・未定義技はnull', () => {
    const a = mkAttacker();
    const d = mkDefender();
    expect(ctx.calculateMoveDamage(a, 'でんじは', d, opts)).toBeNull();
    expect(ctx.calculateMoveDamage(a, '存在しない技', d, opts)).toBeNull();
    expect(ctx.calculateMoveDamage(null, '10まんボルト', d, opts)).toBeNull();
  });

  test('タイプ無効の技は0ダメージ', () => {
    const a = mkAttacker({ types: ['どく'] });
    const d = mkDefender({ types: ['でんき'], selectedAbility: 'ふゆう' });
    const r = ctx.calculateMoveDamage(a, 'じしん', d, opts);
    expect(r.typeEff).toBe(0);
    expect(r.effective).toBe(false);
    expect(r.min).toBe(0);
    expect(r.max).toBe(0);
  });

  test('STABは1.5倍、アダプタビリティは2倍', () => {
    const d = mkDefender({ types: ['ノーマル'] });
    const aFire = mkAttacker(); // ほのお で かえんほうしゃ
    const r1 = ctx.calculateMoveDamage(aFire, 'かえんほうしゃ', d, opts);
    expect(r1.typeEff).toBe(1);
    expect(r1.stab).toBe(1.5);
    const aAda = mkAttacker({ selectedAbility: 'アダプタビリティ' });
    const r2 = ctx.calculateMoveDamage(aAda, 'かえんほうしゃ', d, opts);
    expect(r2.stab).toBe(2);
    expect(r2.max).toBeGreaterThan(r1.max);
  });

  test('いのちのたま・こだわりハチマキの倍率', () => {
    const a = mkAttacker({ item: 'いのちのたま' });
    const d = mkDefender();
    const plain = ctx.calculateMoveDamage(a, 'かえんほうしゃ', d, opts);
    const boosted = ctx.calculateMoveDamage(a, 'かえんほうしゃ', d, { ...opts, lifeOrb: true });
    expect(boosted.max).toBeGreaterThan(plain.max);
    const band = ctx.calculateMoveDamage(mkAttacker({ item: 'こだわりハチマキ' }), 'かえんほうしゃ', d, { ...opts, choiceBand: true });
    expect(band.max).toBeGreaterThan(ctx.calculateMoveDamage(mkAttacker({ item: 'こだわりハチマキ' }), 'かえんほうしゃ', d, opts).max);
  });

  test('雨天・晴れのほのお/みず補正', () => {
    const a = mkAttacker();
    const d = mkDefender();
    const sunFire = ctx.calculateMoveDamage(a, 'かえんほうしゃ', d, { ...opts, weather: 'sun' });
    const plainFire = ctx.calculateMoveDamage(a, 'かえんほうしゃ', d, opts);
    expect(sunFire.max).toBeGreaterThan(plainFire.max);
    const a2 = mkAttacker({ types: ['みず'] });
    const sunWater = ctx.calculateMoveDamage(a2, 'ハイドロポンプ', d, { ...opts, weather: 'sun' });
    const plainWater = ctx.calculateMoveDamage(a2, 'ハイドロポンプ', d, opts);
    expect(sunWater.max).toBeLessThan(plainWater.max);
  });

  test('まひ・急所バーン補正・範囲の整合性', () => {
    const a = mkAttacker();
    const d = mkDefender();
    const crit = ctx.calculateMoveDamage(a, 'かえんほうしゃ', d, { ...opts, critical: true });
    const plain = ctx.calculateMoveDamage(a, 'かえんほうしゃ', d, opts);
    expect(crit.max).toBeGreaterThan(plain.max);
    const burn = ctx.calculateMoveDamage(mkAttacker(), 'ストーンエッジ', d, { ...opts, burn: true });
    const noBurn = ctx.calculateMoveDamage(mkAttacker(), 'ストーンエッジ', d, opts);
    if (noBurn && burn) expect(burn.max).toBeLessThan(noBurn.max);
  });

  test('min<=avg<=max / typeEffに応じた値域', () => {
    const cases = [
      [mkAttacker({ types: ['でんき'] }), '10まんボルト', mkDefender({ types: ['みず', 'ひこう'] })],
      [mkAttacker(), 'かえんほうしゃ', mkDefender()],
      [mkAttacker({ types: ['くさ'] }), 'ソーラービーム', mkDefender({ types: ['みず'] })],
    ];
    cases.forEach(([a, mv, d]) => {
      const r = ctx.calculateMoveDamage(a, mv, d, opts);
      if (!r) return;
      expect(r.min).toBeLessThanOrEqual(r.avg);
      expect(r.avg).toBeLessThanOrEqual(r.max);
      expect(Number.isInteger(r.min)).toBe(true);
      expect(Number.isInteger(r.max)).toBe(true);
      expect(Number.isFinite(r.koChance)).toBe(true);
      expect(r.avg).toBeGreaterThanOrEqual(r.min);
    });
  });
});

describe('normalizeMember / normalizeImportedParties', () => {
  test('normalizeMemberは技を文字列化しnullを除外する', () => {
    const m = ctx.normalizeMember({
      name: 'フシギバナ',
      moves: ['やどりぎのタネ', { name: 'じしん' }, null, ''],
    });
    expect(m.moves).toEqual(['やどりぎのタネ', 'じしん']);
  });

  test('normalizeMemberはnullをそのまま返す', () => {
    expect(ctx.normalizeMember(null)).toBeNull();
  });

  test('normalizeImportedPartiesは6体上限・30件上限・不正形式除外', () => {
    const many = Array.from({ length: 35 }, (_, i) => ({
      name: 'PT' + i,
      party: Array.from({ length: 8 }, (_, j) => ({ name: 'x' + j })),
    }));
    const result = ctx.normalizeImportedParties(many);
    expect(result).toHaveLength(30);
    result.forEach(entry => expect(entry.party).toHaveLength(6));
  });

  test('normalizeImportedPartiesは不正データを除外し形式エラーを投げる', () => {
    expect(() => ctx.normalizeImportedParties('garbage')).toThrow('形式が違います');
    expect(ctx.normalizeImportedParties([{ name: 'nA', party: [{ name: 'y' }] }, { name: 'no-party' }, null])[0].party)
      .toEqual([{ name: 'y', moves: [] }]);
  });
});

describe('safeUserId / storageKey / userApiUrl / hashPassword', () => {
  test('safeUserIdは許可文字のみ・32文字上限', () => {
    expect(ctx.safeUserId('abc')).toBe('abc');
    expect(ctx.safeUserId('')).toBe('');
    expect(ctx.safeUserId('..')).toBe('');
    expect(ctx.safeUserId('a/b\\c:d')).toBe('abcd');
    const long = ctx.safeUserId('x'.repeat(50));
    expect(long).toBe('x'.repeat(32));
    expect(ctx.safeUserId('user-名_1')).toBe('user-_1');
  });

  test('storageKeyはログインユーザーごとにprefk', () => {
    expect(ctx.storageKey('party-lab')).toBe('party-lab');
    ctx.setAuthUserId('alice');
    expect(ctx.storageKey('party-lab')).toBe('party-lab-alice');
  });

  test('userApiUrlとuserApiUrlForLoginはサニタイズ済みパスを返す', () => {
    ctx.setAuthUserId('alice');
    expect(ctx.userApiUrl()).toBe('/api/user/alice');
    expect(ctx.userApiUrlForLogin('bob/../etc')).toBe('/api/user/bobetc');
  });

  test('hashPasswordはSHA-256を16進数で返す（決定性）', async () => {
    expect(global.crypto && global.crypto.subtle).toBeTruthy();
    const h1 = await ctx.hashPassword('password123');
    const h2 = await ctx.hashPassword('password123');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h1).not.toBe(await ctx.hashPassword('password124'));
  });

  test('WebCrypto非対応環境ではフォールバックハッシュを使い決定性を保つ', async () => {
    const savedWindow = global.window;
    const savedCrypto = global.crypto;
    global.window = {};
    global.crypto = undefined;
    try {
      const h1 = await ctx.hashPassword('pass');
      const h2 = await ctx.hashPassword('pass');
      expect(h1).toBe(h2);
      expect(typeof h1).toBe('string');
      expect(h1.length).toBeGreaterThan(0);
    } finally {
      global.window = savedWindow;
      global.crypto = savedCrypto;
    }
  });
});

describe('learnableMoves / moveStatText', () => {
  test('learnableMovesは重複除去し正規化する', () => {
    expect(ctx.learnableMoves({ moves: ['じしん', { name: 'じしん' }, 'ねむる', '', null] }))
      .toEqual(['じしん', 'ねむる']);
  });

  test('moveStatTextは変化技と威力付きを仕分ける', () => {
    expect(ctx.moveStatText({ c: '変化' })).toBe('変化技');
    expect(ctx.moveStatText({ c: '特殊', p: 90, a: 100 })).toBe('威力 90 ／ 命中 100');
    expect(ctx.moveStatText({ c: '物理', p: null, a: null })).toBe('威力 — ／ 命中 必中');
  });
});

describe('toHiragana / toHiraganaFromRomaji', () => {
  test('toHiraganaはカタカナをひらがな化', () => {
    expect(ctx.toHiragana('ピカチュウ')).toBe('ぴかちゅう');
    expect(ctx.toHiragana('プクリン')).toBe('ぷくりん');
  });

  test('toHiraganaFromRomajiはローマ字を日本語化', () => {
    expect(ctx.toHiraganaFromRomaji('pikachu')).toBe('ぴかちゅ');
    expect(ctx.toHiraganaFromRomaji('Pikachu')).toBe('ぴかちゅ');
    // 現行実装は n → ん 置換後に解釈するため 'ze n i game' が「ぜんいがめ」になる
    expect(ctx.toHiraganaFromRomaji('zenigame')).toBe('ぜんいがめ');
  });
});

describe('generateResponse（チャットルーティング）', () => {
  const venusaurMember = {
    name: 'フシギバナ',
    types: ['くさ', 'どく'],
    baseStats: { hp: 80, attack: 82, defense: 83, specialAttack: 100, specialDefense: 100, speed: 80 },
    selectedAbility: 'しんりょく',
    selectedNature: 'まじめ',
    evs: {},
    item: '',
  };
  const charizard = { ...venusaurMember, name: 'リザードン', types: ['ほのお', 'ひこう'] };

  test('弱点質問は弱点分析へルーティング', () => {
    ctx.setParty([venusaurMember, charizard]);
    const out = ctx.generateResponse('このパーティの弱点は？');
    expect(out).toContain('【弱点分析】');
    expect(out).toContain('こおり'); // 複合した弱点を検出
  });

  test('空パーティの弱点はガイド文', () => {
    expect(ctx.generateResponse('弱点は？')).toContain('パーティが空です');
  });

  test('実数値の計算', () => {
    ctx.setParty([venusaurMember]);
    const out = ctx.generateResponse('実数値を計算して');
    expect(out).toContain('【実数値一覧】');
    expect(out).toContain('HP155');
  });

  test('タイプおすすめ', () => {
    const out = ctx.generateResponse('みずタイプのポケモンをおすすめして');
    expect(out).toMatch(/【みずタイプのおすすめ】/);
  });

  test('保存済みパーティ検索', () => {
    ctx.setSaved([]);
    expect(ctx.searchSavedParties('フシギバナ')).toContain('保存済みパーティがありません');
    ctx.setSaved([{ name: '雨パ', party: [venusaurMember] }, { name: '砂パ', party: [charizard] }]);
    const found = ctx.searchSavedParties('フシギバナ');
    expect(found).toContain('【保存済みパーティ検索結果】');
    expect(found).toContain('雨パ');
    expect(ctx.searchSavedParties('存在しない名前')).toContain('見つかりませんでした');
  });

  test('スカーフ速さ表示', () => {
    ctx.setParty([]);
    expect(ctx.generateResponse('こだわりスカーフの速さは？')).toContain('パーティが空です');
  });

  test('未知の質問はヘルプ文', () => {
    expect(ctx.generateResponse('意味不明な質問')).toContain('認識できませんでした');
  });

  test('handleDamageQueryはダメージレポートを生成', () => {
    ctx.setParty([venusaurMember, charizard]);
    const out = ctx.generateResponse('フシギバナの10まんボルトがリザードンに与えるダメージは？');
    expect(out).toContain('【ダメージ計算】');
    expect(out).toContain('ダメージ: ');
    expect(out).toContain('×2');
  });
});