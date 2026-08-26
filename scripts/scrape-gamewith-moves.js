const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUTPUT = path.join(__dirname, '..', 'data', 'gamewith-moves.json');
const PROGRESS = path.join(__dirname, '..', 'data', 'gamewith-moves-progress.json');
const MOVES_JS = path.join(__dirname, '..', 'data', 'moves-champions.js');

function loadKnownMoves() {
  const text = fs.readFileSync(MOVES_JS, 'utf8');
  const matches = text.match(/"([^"]+)"\s*:/g) || [];
  const moves = [];
  for (const m of matches) {
    const name = m.slice(1, -2).replace(/^"|"$/g, '').trim();
    if (name) moves.push(name);
  }
  return moves.sort((a, b) => b.length - a.length);
}

function extractMovesFromText(text, knownMoves) {
  const moves = [];
  const seen = new Set();
  
  const idx = text.indexOf('覚える技');
  if (idx === -1) return moves;
  
  const endMarkers = ['関連ページ', '属性別一覧', '世代別一覧', 'タイプ別一覧'];
  let endIdx = text.length;
  for (const marker of endMarkers) {
    const mi = text.indexOf(marker, idx + 10);
    if (mi !== -1 && mi < endIdx) endIdx = mi;
  }
  
  const section = text.substring(idx, endIdx);
  
  for (const move of knownMoves) {
    if (move.length < 2) continue;
    const escaped = move.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(escaped).test(section)) {
      if (!seen.has(move)) {
        seen.add(move);
        moves.push(move);
      }
    }
  }
  
  return moves.sort((a, b) => a.localeCompare(b, 'ja'));
}

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS)) {
      const data = JSON.parse(fs.readFileSync(PROGRESS, 'utf8'));
      return new Map(data.pokemon.map(p => [p.name, p]));
    }
  } catch (e) {}
  return new Map();
}

function saveProgress(pokemonMap) {
  const data = {
    source: 'https://gamewith.jp/pokemon-champions/546414',
    updatedAt: new Date().toISOString(),
    count: pokemonMap.size,
    pokemon: [...pokemonMap.values()]
  };
  fs.writeFileSync(PROGRESS, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

async function main() {
  console.log('Loading known moves...');
  const knownMoves = loadKnownMoves();
  console.log(`Loaded ${knownMoves.length} known moves`);

  console.log('Loading progress...');
  const progressMap = loadProgress();
  console.log(`Resuming with ${progressMap.size} Pokemon`);

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  console.log('Loading GameWith list page...');
  await page.goto('https://gamewith.jp/pokemon-champions/546414', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 4000));

  const records = await page.evaluate(() => {
    const items = [];
    document.querySelectorAll('a._name').forEach(a => {
      const name = a.innerText.trim();
      const href = a.getAttribute('href');
      if (name && href && href.includes('/pokemon-champions/')) {
        const id = href.split('/').pop();
        items.push({ gamewithId: id, name, pageUrl: href });
      }
    });
    return items;
  });

  console.log(`Found ${records.length} Pokemon on GameWith`);

  const seen = new Set();
  const uniqueRecords = records.filter(r => {
    if (seen.has(r.name)) return false;
    seen.add(r.name);
    return true;
  });
  console.log(`Unique: ${uniqueRecords.length}`);

  let completed = 0;
  for (const rec of uniqueRecords) {
    if (progressMap.has(rec.name)) {
      completed++;
      continue;
    }

    try {
      await page.goto(rec.pageUrl, { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 1200));
      
      const text = await page.evaluate(() => document.body.innerText || '');
      const moves = extractMovesFromText(text, knownMoves);
      console.log(`[${completed + 1}/${uniqueRecords.length}] ${rec.name}: ${moves.length} moves`);
      progressMap.set(rec.name, { name: rec.name, gamewithId: rec.gamewithId, moves, error: null });
    } catch (err) {
      console.log(`[${completed + 1}/${uniqueRecords.length}] ${rec.name}: ERROR - ${err.message}`);
      progressMap.set(rec.name, { name: rec.name, gamewithId: rec.gamewithId, moves: [], error: err.message });
    }

    completed++;
    if (completed % 10 === 0) {
      saveProgress(progressMap);
      console.log(`  Saved progress: ${completed}/${uniqueRecords.length}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  await browser.close();

  const allResults = [...progressMap.values()];
  const success = allResults.filter(r => r.moves.length > 0).length;
  const output = {
    source: 'https://gamewith.jp/pokemon-champions/546414',
    fetchedAt: new Date().toISOString(),
    count: allResults.length,
    success,
    failed: allResults.length - success,
    pokemon: allResults
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n', 'utf8');
  fs.unlinkSync(PROGRESS);
  console.log(`\nDone! Saved ${allResults.length} entries to ${OUTPUT}`);
}

main().catch(err => { console.error(err); process.exitCode = 1; });
