/*
 * Automatically fetches missing item icons for Pokemon Champions.
 *
 * Reads data/items-champions.js, finds items with empty iconUrl, and downloads
 * the corresponding sprites from GameWith.
 *
 * Run with: node scripts/fetch-item-icons.js
 *
 * To add support for new items, either:
 * 1. Add the item with an empty iconUrl to items-champions.js
 *    (the script will search the GameWith item list page for its article URL)
 * 2. Or add an entry to ITEM_URLS in scripts/scrape-gamewith-mc.js
 *
 * The script also updates pokemon-champions.js/json with the resolved iconUrl
 * values, keeping both data files in sync.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const PROJECT_ROOT = path.join(__dirname, '..');
const ITEMS_FILE = path.join(PROJECT_ROOT, 'data', 'items-champions.js');
const POKEMON_ITEMS_FILE = path.join(PROJECT_ROOT, 'data', 'pokemon-champions.js');
const SPRITE_DIR = path.join(PROJECT_ROOT, 'images', 'items');

const GAMEWITH_SPRITE_BASE = 'https://img.gamewith.jp/article_tools/pokemon-champions/gacha/';
const GAMEWITH_ITEM_LIST = 'https://gamewith.jp/pokemon-champions/546487';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Import ITEM_URLS from the scraper script
let ITEM_URLS = {};
try {
  const mod = require('./scrape-gamewith-mc');
  for (const entry of mod.ITEM_URLS) {
    ITEM_URLS[entry.name] = entry.url;
  }
} catch (e) {
  console.warn('Could not import ITEM_URLS from scrape-gamewith-mc.js. Only items on the gamewith list page will be found.');
}

/* ------------------------------------------------------------------ */
/* HTTP utilities                                                       */
/* ------------------------------------------------------------------ */

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(fetchHtml(res.headers.location));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`${res.statusCode} ${res.statusText}: ${url}`));
        return;
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(downloadFile(res.headers.location, filepath));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`${res.statusCode} ${res.statusText}: ${url}`));
        return;
      }
      const file = fs.createWriteStream(filepath);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
      file.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

/* ------------------------------------------------------------------ */
/* Parsing utilities                                                   */
/* ------------------------------------------------------------------ */

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/*
 * Extract sprite number from a GameWith article page.
 * Returns { type: 'mega'|'regular', number: '123' } or null.
 */
function extractGamewithSprite(html, itemName) {
  const escaped = escapeRegex(itemName);

  // Mega stone: i_item_m{number}.png ... alt='{name}'
  let m = html.match(new RegExp(`i_item_m(\\d+)\\.png[^>]*alt=['"]${escaped}['"]`, 'i'));
  if (m) return { type: 'mega', number: m[1] };

  // Regular item: i_item{number}.png ... alt='{name}'
  m = html.match(new RegExp(`i_item(\\d+)\\.png[^>]*alt=['"]${escaped}['"]`, 'i'));
  if (m) return { type: 'regular', number: m[1] };

  return null;
}

/*
 * Parse the GameWith item list page (546487) to build a map of
 * item name -> gamewith article URL.
 * This lets us discover article URLs for items not in ITEM_URLS.
 */
function parseGamewithItemLinks(html) {
  const result = {};
  const re = /href=['"](https:\/\/gamewith\.jp\/pokemon-champions\/\d+)['"][^>]*>\s*<img[^>]*alt=['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const url = m[1];
    const name = m[2];
    if (!result[name]) result[name] = url;
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Data file utilities                                                 */
/* ------------------------------------------------------------------ */

function loadJsData(filePath, varName) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const m = raw.match(new RegExp(`window\\.${varName}\\s*=\\s*(\\{[\\s\\S]*?\\});\\s*$`));
  if (!m) throw new Error(`Could not parse ${varName} in ${path.basename(filePath)}`);
  return JSON.parse(m[1]);
}

function saveJsData(filePath, varName, data) {
  const output = `window.${varName} = ${JSON.stringify(data, null, 2)};\n`;
  fs.writeFileSync(filePath, output, 'utf8');
}

/* Returns a Set of sprite numbers already used by items with icons. */
function getUsedNumbers(items) {
  const used = new Set();
  for (const item of items) {
    if (item.iconUrl) {
      const m = item.iconUrl.match(/i_item(?:_m)?(\d+)\.png/);
      if (m) used.add(m[1]);
    }
  }
  return used;
}

/* ------------------------------------------------------------------ */
/* Main logic                                                          */
/* ------------------------------------------------------------------ */

async function main() {
  console.log('=== Fetch Missing Item Icons ===\n');

  // 1. Load data
  const data = loadJsData(ITEMS_FILE, 'ITEM_DATA');

  // 2. Find items with empty iconUrl
  const missing = data.items.filter(item => !item.iconUrl);

  if (missing.length === 0) {
    console.log('All items already have icons. Nothing to do.');
    return;
  }

  console.log(`${missing.length} item(s) missing icons:`);
  missing.forEach(item => console.log(`  - ${item.name}`));
  console.log('');

  const usedNumbers = getUsedNumbers(data.items);
  let updatedCount = 0;

  // 3. Build a fallback list of gamewith article URLs from the item list page
  let fallbackLinks = null;

  async function getGamewithUrl(itemName) {
    if (ITEM_URLS[itemName]) return ITEM_URLS[itemName];

    if (!fallbackLinks) {
      try {
        console.log('Fetching gamewith item list page to discover article URLs...');
        const html = await fetchHtml(GAMEWITH_ITEM_LIST);
        fallbackLinks = parseGamewithItemLinks(html);
        console.log(`  Found ${Object.keys(fallbackLinks).length} item links.`);
      } catch (err) {
        console.warn(`  Could not fetch item list: ${err.message}`);
        fallbackLinks = {};
      }
    }

    return fallbackLinks[itemName] || null;
  }

  // 4. Process each missing item
  for (const item of missing) {
    const name = item.name;
    const isMegaStone = name.endsWith('ナイト') || name.endsWith('ナイトZ');

    let spriteInfo = null;

    // Try gamewith article page
    const gamewithUrl = await getGamewithUrl(name);
    if (gamewithUrl) {
      try {
        console.log(`[${name}] Fetching gamewith article...`);
        const html = await fetchHtml(gamewithUrl);
        spriteInfo = extractGamewithSprite(html, name);
      } catch (err) {
        console.warn(`  gamewith fetch failed: ${err.message}`);
      }
    }

    if (!spriteInfo) {
      console.warn(`[${name}] Could not find sprite URL. Add this item to ITEM_URLS in scrape-gamewith-mc.js.`);
      continue;
    }

    // 5. Determine filename and URL
    let filename, spriteUrl;
    if (spriteInfo.type === 'mega') {
      filename = `i_item_m${spriteInfo.number}.png`;
      spriteUrl = `${GAMEWITH_SPRITE_BASE}i_item_m${spriteInfo.number}.png`;
    } else {
      filename = `i_item${spriteInfo.number}.png`;
      spriteUrl = `${GAMEWITH_SPRITE_BASE}i_item${spriteInfo.number}.png`;
    }

    // 6. Handle filename collisions
    let filepath = path.join(SPRITE_DIR, filename);
    if (fs.existsSync(filepath) && !usedNumbers.has(spriteInfo.number)) {
      // File exists but is used by a different item; use _2, _3 suffix
      let suffix = 2;
      while (fs.existsSync(path.join(SPRITE_DIR, filename.replace(/\.png$/, `_${suffix}.png`)))) {
        suffix++;
        if (suffix > 20) break;
      }
      filename = filename.replace(/\.png$/, `_${suffix}.png`);
      filepath = path.join(SPRITE_DIR, filename);
    }

    // 7. Download sprite if needed
    if (!fs.existsSync(filepath)) {
      console.log(`  Downloading ${filename}...`);
      try {
        await downloadFile(spriteUrl, filepath);
      } catch (err) {
        console.error(`  Download failed: ${err.message}`);
        continue;
      }
    } else {
      console.log(`  Sprite ${filename} already exists.`);
    }

    // 8. Update iconUrl in data
    item.iconUrl = `images/items/${filename}`;
    usedNumbers.add(spriteInfo.number);
    updatedCount++;
    console.log(`  ${name} -> ${item.iconUrl}`);
    console.log('');
  }

  // 9. Save updated items-champions.js
  if (updatedCount > 0) {
    console.log('Writing updated items-champions.js...');
    saveJsData(ITEMS_FILE, 'ITEM_DATA', data);
    console.log(`Updated ${updatedCount} icon(s).`);
  } else {
    console.log('No icons were updated.');
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
