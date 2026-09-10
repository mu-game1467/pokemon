const fs = require('fs');
const path = require('path');

const POKEMON_URLS = [
  { name: 'プクリン', url: 'https://gamewith.jp/pokemon-champions/575626' },
  { name: 'ペルシアン', url: 'https://gamewith.jp/pokemon-champions/575627' },
  { name: 'アローラペルシアン', url: 'https://gamewith.jp/pokemon-champions/575628' },
  { name: 'カモネギ', url: 'https://gamewith.jp/pokemon-champions/575708' },
  { name: 'バリヤード', url: 'https://gamewith.jp/pokemon-champions/575705' },
  { name: 'マルノーム', url: 'https://gamewith.jp/pokemon-champions/575704' },
  { name: 'メガアブソルZ', url: 'https://gamewith.jp/pokemon-champions/574492' },
  { name: 'ボーマンダ', url: 'https://gamewith.jp/pokemon-champions/575013' },
  { name: 'メガボーマンダ', url: 'https://gamewith.jp/pokemon-champions/575012' },
  { name: 'メガガブリアスZ', url: 'https://gamewith.jp/pokemon-champions/574491' },
  { name: 'メガルカリオZ', url: 'https://gamewith.jp/pokemon-champions/574490' },
  { name: 'ゴーゴート', url: 'https://gamewith.jp/pokemon-champions/575629' },
  { name: 'グソクムシャ', url: 'https://gamewith.jp/pokemon-champions/575014' },
  { name: 'メガグソクムシャ', url: 'https://gamewith.jp/pokemon-champions/575652' },
  { name: 'ゴリランダー', url: 'https://gamewith.jp/pokemon-champions/574661' },
  { name: 'エースバーン', url: 'https://gamewith.jp/pokemon-champions/575630' },
  { name: 'インテレオン', url: 'https://gamewith.jp/pokemon-champions/575631' },
  { name: 'フォクスライ', url: 'https://gamewith.jp/pokemon-champions/575632' },
  { name: 'ストリンダー(ハイ)', url: 'https://gamewith.jp/pokemon-champions/575633' },
  { name: 'ストリンダー(ロー)', url: 'https://gamewith.jp/pokemon-champions/575768' },
  { name: 'オトスパス', url: 'https://gamewith.jp/pokemon-champions/575634' },
  { name: 'ニャイキング', url: 'https://gamewith.jp/pokemon-champions/575635' },
  { name: 'ネギガナイト', url: 'https://gamewith.jp/pokemon-champions/575636' },
  { name: 'バチンウニ', url: 'https://gamewith.jp/pokemon-champions/575637' },
  { name: 'イエッサン(オス)', url: 'https://gamewith.jp/pokemon-champions/575639' },
  { name: 'イエッサン(メス)', url: 'https://gamewith.jp/pokemon-champions/575638' },
  { name: 'パーモット', url: 'https://gamewith.jp/pokemon-champions/575656' },
  { name: 'オリーヴァ', url: 'https://gamewith.jp/pokemon-champions/575640' },
  { name: 'イキリンコ', url: 'https://gamewith.jp/pokemon-champions/575641' },
  { name: 'マフィティフ', url: 'https://gamewith.jp/pokemon-champions/575642' },
  { name: 'セグレイブ', url: 'https://gamewith.jp/pokemon-champions/574625' },
  { name: 'メガセグレイブ', url: 'https://gamewith.jp/pokemon-champions/575651' },
];

const ITEM_URLS = [
  { name: 'ながねぎ', url: 'https://gamewith.jp/pokemon-champions/575675' },
  { name: 'ゴツゴツメット', url: 'https://gamewith.jp/pokemon-champions/575674' },
  { name: 'ふうせん', url: 'https://gamewith.jp/pokemon-champions/575673' },
  { name: 'レッドカード', url: 'https://gamewith.jp/pokemon-champions/575676' },
  { name: 'ノーマルジュエル', url: 'https://gamewith.jp/pokemon-champions/575670' },
  { name: 'グランドコート', url: 'https://gamewith.jp/pokemon-champions/575669' },
  { name: 'エレキシード', url: 'https://gamewith.jp/pokemon-champions/575668' },
  { name: 'サイコシード', url: 'https://gamewith.jp/pokemon-champions/575661' },
  { name: 'ミストシード', url: 'https://gamewith.jp/pokemon-champions/575662' },
  { name: 'グラスシード', url: 'https://gamewith.jp/pokemon-champions/575663' },
  { name: 'アブソルナイトZ', url: 'https://gamewith.jp/pokemon-champions/575009' },
  { name: 'ガブリアスナイトZ', url: 'https://gamewith.jp/pokemon-champions/575008' },
  { name: 'ルカリオナイトZ', url: 'https://gamewith.jp/pokemon-champions/575006' },
  { name: 'ボーマンダナイト', url: 'https://gamewith.jp/pokemon-champions/575007' },
  { name: 'グソクムシャナイト', url: 'https://gamewith.jp/pokemon-champions/575005' },
  { name: 'セグレイブナイト', url: 'https://gamewith.jp/pokemon-champions/575010' },
];

const TYPE_MAP = {
  'ノーマル': 'normal',
  'ほのお': 'fire',
  'みず': 'water',
  'くさ': 'grass',
  'でんき': 'electric',
  'こおり': 'ice',
  'かくとう': 'fighting',
  'どく': 'poison',
  'じめん': 'ground',
  'ひこう': 'flying',
  'エスパー': 'psychic',
  'むし': 'bug',
  'いわ': 'rock',
  'ゴースト': 'ghost',
  'ドラゴン': 'dragon',
  'あく': 'dark',
  'はがね': 'steel',
  'フェアリー': 'fairy',
  'ステラ': 'stellar',
};

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

function extractArticleBody(html) {
  const match = html.match(/"articleBody"\s*:\s*"([\s\S]*?)"\s*,\s*"image"/);
  if (!match) return null;
  let body = match[1];
  body = body.replace(/\\\\/g, '\\');
  body = body.replace(/\\"/g, '"');
  body = body.replace(/\\n/g, '\n');
  body = body.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return body;
}

function parsePokemonData(name, articleBody, url) {
  const result = { name, types: [], baseStats: {}, abilities: [], megaStone: null, isMega: false, baseForm: null };
  
  result.isMega = name.startsWith('メガ');
  if (result.isMega) {
    result.baseForm = name.replace('メガ', '').replace('Z', '');
  }
  
  // Extract types from text like "ノーマルとフェアリーの複合タイプ" or "単タイプ"
  const typeMatch = articleBody.match(/([^。]*?(?:複合タイプ|単タイプ|タイプです|タイプ[^、。]*?)[^。]*?)/);
  if (typeMatch) {
    const typeText = typeMatch[1];
    for (const [ja, en] of Object.entries(TYPE_MAP)) {
      if (typeText.includes(ja + 'タイプ') || typeText.includes(ja + 'と') || typeText.includes(ja + '・') || typeText === ja + 'タイプ') {
        if (!result.types.includes(en)) result.types.push(en);
      }
    }
  }
  
  // Fallback: extract from species text like "ノーマルとフェアリーの複合タイプ"
  if (result.types.length === 0) {
    const speciesMatch = articleBody.match(/([^。]*?)(?:と|・)([^。]*?)の複合タイプ/);
    if (speciesMatch) {
      for (const [ja, en] of Object.entries(TYPE_MAP)) {
        if (speciesMatch[0].includes(ja)) {
          if (!result.types.includes(en)) result.types.push(en);
        }
      }
    }
  }
  
  // Extract base stats from pattern like "HP140攻撃70防御45特攻85特防50素早45" 
  // The text has rankings like "HP1402位攻撃70275位" so we need to handle that
  const statMatch = articleBody.match(/HP(\d+)(?:\d*位)?攻撃(\d+)(?:\d*位)?防御(\d+)(?:\d*位)?特攻(\d+)(?:\d*位)?特防(\d+)(?:\d*位)?素早(\d+)/);
  if (statMatch) {
    result.baseStats = {
      hp: parseInt(statMatch[1]),
      attack: parseInt(statMatch[2]),
      defense: parseInt(statMatch[3]),
      specialAttack: parseInt(statMatch[4]),
      specialDefense: parseInt(statMatch[5]),
      speed: parseInt(statMatch[6]),
    };
  }
  
  // Fallback: look for "種族値が" patterns
  if (Object.keys(result.baseStats).length === 0) {
    const hpMatch = articleBody.match(/HP種族値が(\d+)/);
    const atkMatch = articleBody.match(/攻撃種族値が(\d+)/);
    const defMatch = articleBody.match(/防御種族値が(\d+)/);
    const spaMatch = articleBody.match(/特攻種族値が(\d+)/);
    const spdMatch = articleBody.match(/特防種族値が(\d+)/);
    const speMatch = articleBody.match(/素早さ種族値(?:も|が)(\d+)/);
    
    if (hpMatch && atkMatch && defMatch && spaMatch && spdMatch && speMatch) {
      result.baseStats = {
        hp: parseInt(hpMatch[1]),
        attack: parseInt(atkMatch[1]),
        defense: parseInt(defMatch[1]),
        specialAttack: parseInt(spaMatch[1]),
        specialDefense: parseInt(spdMatch[1]),
        speed: parseInt(speMatch[1]),
      };
    }
  }
  
  // Extract abilities from pattern "特性1メロメロボディ...特性2かちき...隠れ特性おみとおし"
  const abilityMatches = articleBody.match(/特性\d+([^特性隠れ。]+)/g);
  if (abilityMatches) {
    for (const am of abilityMatches) {
      const clean = am.replace(/特性\d+/, '').trim();
      // Filter out non-ability text
      if (clean && clean.length > 1 && clean.length < 20 && 
          !clean.includes('種族値') && !clean.includes('弱点') && !clean.includes('タイプ') &&
          !clean.includes('位') && !clean.includes('位') && !clean.includes('合計') &&
          !clean.match(/^\d/)) {
        result.abilities.push(clean);
      }
    }
  }
  
  // Also check for hidden ability
  const hiddenMatch = articleBody.match(/隠れ特性([^。]+)/);
  if (hiddenMatch) {
    const hidden = hiddenMatch[1].trim();
    if (hidden && hidden.length > 1 && hidden.length < 20 && !result.abilities.includes(hidden)) {
      result.abilities.push(hidden);
    }
  }
  
  // Extract mega stone for mega evolutions
  if (result.isMega) {
    // Try to find the mega stone name in the text
    const megaStoneMatch = articleBody.match(/([^。]*?ナイトZ?)[^。]*?(?:メガシンカ|メガストーン)/);
    if (megaStoneMatch) {
      result.megaStone = megaStoneMatch[1].trim();
    } else {
      // Infer from name
      const baseName = name.replace('メガ', '').replace('Z', '');
      result.megaStone = baseName + 'ナイト' + (name.includes('Z') ? 'Z' : '');
    }
  }
  
  return result;
}

function parseItemData(name, articleBody, url) {
  const result = { name, description: '' };
  
  // Extract effect from "効果XXX。" pattern
  const effectMatch = articleBody.match(/効果([^。]+)。/);
  if (effectMatch) {
    result.description = effectMatch[1].trim();
  } else {
    // Fallback: look for "効果" and take text until next section
    const idx = articleBody.indexOf('効果');
    if (idx >= 0) {
      const snippet = articleBody.substring(idx + 2, idx + 200);
      const endIdx = snippet.indexOf('。');
      if (endIdx > 0) {
        result.description = snippet.substring(0, endIdx).trim();
      }
    }
  }
  
  return result;
}

async function scrapeAll() {
  console.log('Fetching Pokemon data...');
  const pokemon = [];
  
  for (let i = 0; i < POKEMON_URLS.length; i++) {
    const { name, url } = POKEMON_URLS[i];
    try {
      console.log(`[${i + 1}/${POKEMON_URLS.length}] Fetching ${name}...`);
      const html = await fetchPage(url);
      const articleBody = extractArticleBody(html);
      if (articleBody) {
        const data = parsePokemonData(name, articleBody, url);
        pokemon.push(data);
        console.log(`  Types: ${data.types.join(', ') || 'N/A'}, Stats: ${JSON.stringify(data.baseStats)}, Abilities: ${data.abilities.join(', ')}`);
      } else {
        console.log(`  ERROR: No articleBody found`);
      }
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('\nFetching Item data...');
  const items = [];
  
  for (let i = 0; i < ITEM_URLS.length; i++) {
    const { name, url } = ITEM_URLS[i];
    try {
      console.log(`[${i + 1}/${ITEM_URLS.length}] Fetching ${name}...`);
      const html = await fetchPage(url);
      const articleBody = extractArticleBody(html);
      if (articleBody) {
        const data = parseItemData(name, articleBody, url);
        items.push(data);
        console.log(`  Description: ${data.description}`);
      } else {
        console.log(`  ERROR: No articleBody found`);
      }
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }
  
  const output = {
    source: 'https://gamewith.jp/pokemon-champions/574460',
    fetchedAt: new Date().toISOString(),
    pokemon,
    items,
  };
  
  const outputPath = path.join(__dirname, '..', 'data', 'gamewith-mc.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`\nSaved to ${outputPath}`);
  console.log(`Pokemon: ${pokemon.length}, Items: ${items.length}`);
}

scrapeAll().catch(err => { console.error(err); process.exitCode = 1; });