const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');

function loadJs(filePath) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''), context);
  const found = Object.keys(context.window).find(k =>
    context.window[k] && typeof context.window[k] === 'object'
  );
  if (!found) throw new Error('No object export found in ' + filePath);
  return context.window[found];
}

describe('moves-champions.js integrity', () => {
  const moves = loadJs(path.join(DATA_DIR, 'moves-champions.js'));

  test('load returns a non-empty move map', () => {
    expect(Object.keys(moves).length).toBeGreaterThan(100);
  });

  test('all moves have valid structure', () => {
    const VALID_TYPES = [
      'ノーマル', 'ほのお', 'みず', 'でんき', 'くさ', 'こおり', 'かくとう', 'どく',
      'じめん', 'ひこう', 'エスパー', 'むし', 'いわ', 'ゴースト', 'ドラゴン',
      'あく', 'はがね', 'フェアリー',
    ];
    const VALID_CATEGORIES = ['物理', '特殊', '変化'];

    Object.entries(moves).forEach(([name, move]) => {
      expect(typeof name).toBe('string');
      expect(typeof move).toBe('object');
      expect(move).toHaveProperty('t');
      expect(VALID_TYPES).toContain(move.t);
      expect(VALID_CATEGORIES).toContain(move.c);
      // p（威力）/ a（命中）は「可変威力」「必中」を null で表現するため null を許容する
      if ('p' in move) {
        expect(move.p === null || typeof move.p === 'number').toBe(true);
        if (move.p !== null) expect(move.p).toBeGreaterThan(0);
      }
      if ('a' in move) {
        expect(move.a === null || typeof move.a === 'number').toBe(true);
        if (move.a !== null) {
          expect(move.a).toBeGreaterThan(0);
          expect(move.a).toBeLessThanOrEqual(100);
        }
      }
      expect(move).toHaveProperty('e');
    });
  });

  test('every Pokemon move references an existing move entry', () => {
    const pokes = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'pokemon-champions.json'), 'utf8')).pokemon;
    const missing = new Set();
    let referenced = 0;
    pokes.forEach(p => {
      (p.moves || []).forEach(m => {
        const n = typeof m === 'string' ? m : (m && m.name);
        if (!n) return;
        referenced++;
        if (!(n in moves)) missing.add(p.name + ':' + n);
      });
    });
    expect(referenced).toBeGreaterThan(0);
    expect([...missing]).toEqual([]);
  });
});

describe('pokedb-teams.js integrity', () => {
  const pokedb = loadJs(path.join(DATA_DIR, 'pokedb-teams.js'));

  test('has seasons with teams', () => {
    expect(pokedb).toHaveProperty('seasons');
    const seasons = pokedb.seasons;
    expect(Array.isArray(seasons)).toBe(true);
    expect(seasons.length).toBeGreaterThan(0);
    expect(seasons[0]).toHaveProperty('teams');
    expect(Array.isArray(seasons[0].teams)).toBe(true);
    expect(seasons[0].teams.length).toBeGreaterThan(0);
  });

  test('team structure is consistent', () => {
    const seasons = pokedb.seasons;
    seasons.forEach(season => {
      const teams = season.teams;
      expect(Array.isArray(teams)).toBe(true);
      teams.forEach(team => {
        expect(Array.isArray(team.team)).toBe(true);
        expect(team.team).toHaveLength(6);
        team.team.forEach(member => {
          expect(member).toHaveProperty('name');
          expect(typeof member.name).toBe('string');
        });
        expect(team).toHaveProperty('rating');
      });
    });
  });
});

describe('showdown-name-map.js integrity', () => {
  const map = loadJs(path.join(DATA_DIR, 'showdown-name-map.js'));

  test('map is non-empty', () => {
    expect(Object.keys(map).length).toBeGreaterThan(0);
  });

  test('values are non-empty strings', () => {
    Object.values(map).forEach(v => {
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(0);
    });
  });

  test('duplicate values are visible (warn only)', () => {
    const vals = Object.values(map);
    const dupSet = new Set();
    const seen = new Set();
    vals.forEach(v => {
      if (seen.has(v)) dupSet.add(v);
      else seen.add(v);
    });
    const dupArr = [...dupSet];
    expect(dupArr.length).toBeGreaterThanOrEqual(0);
    if (dupArr.length > 0) {
      console.log('showdown-name-map has duplicate values:', dupArr);
    }
  });
});
