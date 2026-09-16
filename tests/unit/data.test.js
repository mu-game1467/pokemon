const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function loadJs(filePath) {
  // window.X = {...} 形式のJSデータをサンドボックスで実行して読み込む
  // （JSON前提の正規表現は、ナイト系アイテム等のJSON外構文で壊れるため）
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''), context);
  const keys = Object.keys(context.window);
  if (keys.length !== 1) throw new Error('Expected single export in ' + filePath);
  return context.window[keys[0]];
}

describe('pokemon-champions.json data integrity', () => {
  const champions = loadJson(path.join(DATA_DIR, 'pokemon-champions.json'));

  test('has required top-level fields', () => {
    expect(champions).toHaveProperty('source');
    expect(champions).toHaveProperty('fetchedAt');
    expect(champions).toHaveProperty('count');
    expect(champions).toHaveProperty('pokemon');
    expect(champions).toHaveProperty('updatedAt');
    expect(Array.isArray(champions.pokemon)).toBe(true);
    expect(typeof champions.count).toBe('number');
  });

  test('count matches pokemon array length', () => {
    expect(champions.count).toBe(champions.pokemon.length);
  });

  test('every Pokemon has required fields', () => {
    const requiredFields = ['id', 'name', 'pageUrl', 'iconUrl', 'types', 'abilities', 'baseStats', 'moves'];
    champions.pokemon.forEach((p, i) => {
      requiredFields.forEach(field => {
        expect(p).toHaveProperty(field);
      });
    });
  });

  test('all IDs are unique', () => {
    const ids = champions.pokemon.map(p => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  test('all names are unique', () => {
    const names = champions.pokemon.map(p => p.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  test('types use Japanese format with タイプ suffix', () => {
    const validPrefixes = [
      'ノーマル', 'ほのお', 'みず', 'でんき', 'くさ', 'こおり', 'かくとう',
      'どく', 'じめん', 'ひこう', 'エスパー', 'むし', 'いわ', 'ゴースト',
      'ドラゴン', 'あく', 'はがね', 'フェアリー', 'ステラ'
    ];
    champions.pokemon.forEach(p => {
      p.types.forEach(type => {
        const prefix = type.replace('タイプ', '');
        expect(validPrefixes).toContain(prefix);
      });
    });
  });

  test('baseStats has all required stat fields with positive integers', () => {
    const statFields = ['hp', 'attack', 'defense', 'specialAttack', 'specialDefense', 'speed'];
    champions.pokemon.forEach(p => {
      statFields.forEach(field => {
        expect(p.baseStats).toHaveProperty(field);
        expect(Number.isInteger(p.baseStats[field])).toBe(true);
        expect(p.baseStats[field]).toBeGreaterThan(0);
      });
    });
  });

  test('M-C Mega entries have megaStone, isMega, and baseForm fields', () => {
    const megaEntries = champions.pokemon.filter(p => p.name.startsWith('メガ') && p.isMega === true);
    expect(megaEntries.length).toBeGreaterThan(0);
    megaEntries.forEach(p => {
      expect(p.isMega).toBe(true);
      expect(p).toHaveProperty('megaStone');
      expect(p).toHaveProperty('baseForm');
      expect(typeof p.baseForm).toBe('string');
      expect(p.baseForm.length).toBeGreaterThan(0);
    });
  });

  test('moves is an array', () => {
    champions.pokemon.forEach(p => {
      expect(Array.isArray(p.moves)).toBe(true);
    });
  });

  test('id follows n{pokedexNo}{variant} format', () => {
    const idPattern = /^n\d+[a-z]*$/;
    champions.pokemon.forEach(p => {
      expect(idPattern.test(p.id)).toBe(true);
    });
  });

  test('pageUrl is a valid URL and iconUrl is local/remote asset', () => {
    champions.pokemon.forEach(p => {
      expect(p.pageUrl).toMatch(/^https?:\/\//);
      // アイコンはローカル（images/pokemon/）または外部URLのどちらでも可
      expect(p.iconUrl).toMatch(/^(https?:\/\/|images\/)/);
    });
  });

  test('local icon files exist for every Pokemon', () => {
    const imagesDir = path.join(PROJECT_ROOT, 'images', 'pokemon');
    let localCount = 0;
    champions.pokemon.forEach(p => {
      if (p.iconUrl && p.iconUrl.startsWith('images/')) {
        localCount++;
        expect(fs.existsSync(path.join(imagesDir, path.basename(p.iconUrl)))).toBe(true);
      }
    });
    expect(localCount).toBeGreaterThan(0);
  });

  test('M-C update Pokemon are present', () => {
    const mcNames = ['プクリン', 'ペルシアン', 'アローラペルシアン', 'ボーマンダ', 'メガボーマンダ',
      'メガグソクムシャ', 'エースバーン', 'インテレオン', 'フォクスライ', 'セグレイブ', 'メガセグレイブ',
      'イエッサン(オス)', 'イエッサン(メス)', 'ストリンダー(ハイ)', 'ストリンダー(ロー)'];
    const names = new Set(champions.pokemon.map(p => p.name));
    mcNames.forEach(name => {
      expect(names.has(name)).toBe(true);
    });
  });

  test('items array exists and has entries', () => {
    expect(champions).toHaveProperty('items');
    expect(Array.isArray(champions.items)).toBe(true);
    expect(champions.items.length).toBeGreaterThan(0);
  });

  test('each item has name and description', () => {
    champions.items.forEach((item, i) => {
      expect(item).toHaveProperty('name');
      expect(typeof item.name).toBe('string');
      expect(item.name.length).toBeGreaterThan(0);
      expect(item).toHaveProperty('description');
      expect(typeof item.description).toBe('string');
    });
  });

  test('M-C items are present', () => {
    // pokemon-champions.json（YakkunのM-C名鑑）内の items はM-C対応の6種のメガストーンを含む
    // ※アブソル/ガブリアス/ルカリオは名鑑上「Z」表記のストーンで登録されている
    const mcItems = ['アブソルナイトZ', 'ガブリアスナイトZ', 'ルカリオナイトZ',
      'ボーマンダナイト', 'グソクムシャナイト', 'セグレイブナイト'];
    const itemNames = champions.items.map(i => i.name);
    mcItems.forEach(name => {
      expect(itemNames).toContain(name);
    });
  });

  test('every mega entry resolves its megaStone to an existing item', () => {
    const megaEntries = champions.pokemon.filter(p => p.isMega === true);
    const itemNames = new Set(champions.items.map(i => i.name));
    expect(megaEntries.length).toBeGreaterThan(0);
    megaEntries.forEach(p => {
      expect(p.megaStone).toBeDefined();
      expect(itemNames.has(p.megaStone)).toBe(true);
    });
  });

  test('every mega entry has a valid baseForm in the roster', () => {
    const megaEntries = champions.pokemon.filter(p => p.isMega === true);
    const names = new Set(champions.pokemon.map(p => p.name));
    megaEntries.forEach(p => {
      expect(typeof p.baseForm).toBe('string');
      expect(names.has(p.baseForm)).toBe(true);
    });
  });
});

describe('pokemon-champions.js sync with JSON', () => {
  test('JS file exists', () => {
    expect(fs.existsSync(path.join(DATA_DIR, 'pokemon-champions.js'))).toBe(true);
  });

  test('JS file has matching count', () => {
    const jsonData = loadJson(path.join(DATA_DIR, 'pokemon-champions.json'));
    const jsData = loadJs(path.join(DATA_DIR, 'pokemon-champions.js'));
    expect(jsData.count).toBe(jsonData.count);
  });

  test('JS file pokemon count matches JSON', () => {
    const jsonData = loadJson(path.join(DATA_DIR, 'pokemon-champions.json'));
    const jsData = loadJs(path.join(DATA_DIR, 'pokemon-champions.js'));
    expect(jsData.pokemon.length).toBe(jsonData.pokemon.length);
  });

  test('JS file contains new M-C Pokemon', () => {
    const jsData = loadJs(path.join(DATA_DIR, 'pokemon-champions.js'));
    const names = jsData.pokemon.map(p => p.name);
    expect(names).toContain('プクリン');
    expect(names).toContain('メガアブソルZ');
    expect(names).toContain('メガガブリアスZ');
    expect(names).toContain('メガルカリオZ');
  });

  test('JS file contains non-Z mega stone items', () => {
    const jsData = loadJs(path.join(DATA_DIR, 'pokemon-champions.js'));
    const itemNames = jsData.items.map(i => i.name);
    expect(itemNames).toContain('アブソルナイト');
    expect(itemNames).toContain('ガブリアスナイト');
    expect(itemNames).toContain('ルカリオナイト');
  });
});

describe('items-champions.js data integrity', () => {
  test('contains M-C items', () => {
    const jsData = loadJs(path.join(DATA_DIR, 'items-champions.js'));
    const itemNames = jsData.items.map(i => i.name);
    expect(itemNames).toContain('アブソルナイトZ');
    expect(itemNames).toContain('グランドコート');
    expect(itemNames).toContain('ながねぎ');
  });

  test('every item has name, description, and iconUrl', () => {
    const jsData = loadJs(path.join(DATA_DIR, 'items-champions.js'));
    jsData.items.forEach(item => {
      expect(item).toHaveProperty('name');
      expect(typeof item.name).toBe('string');
      expect(item.name.length).toBeGreaterThan(0);
      expect(item).toHaveProperty('description');
      expect(item).toHaveProperty('iconUrl');
      expect(typeof item.iconUrl).toBe('string');
      expect(item.iconUrl.length).toBeGreaterThan(0);
    });
  });

  test('all iconUrl paths reference existing files', () => {
    const jsData = loadJs(path.join(DATA_DIR, 'items-champions.js'));
    const itemsDir = path.join(PROJECT_ROOT, 'images', 'items');
    jsData.items.forEach(item => {
      const filepath = path.join(itemsDir, path.basename(item.iconUrl));
      expect(fs.existsSync(filepath)).toBe(true);
    });
  });
});
