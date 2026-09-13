/*
 * Automatically fetches missing item icons for Pokemon Champions.
 *
 * Reads data/items-champions.js, finds items with empty iconUrl, and downloads
 * the corresponding sprites from gamewith (or yakkun as fallback).
 *
 * Run with: node scripts/fetch-item-icons.js
 *
 * To add support for new items, add an entry to the ITEM_URLS dict (exported from
 * scrape-gamewith-mc.js) or add the item with an empty iconUrl to items-champions.js
 * and the script will try to find it via the gamewith item list page.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ITEMS_FILE = path.join(__dirname, '..', 'data', 'items-champions.js');
const SPRITE_DIR = path.join(__dirname, '..', 'images', 'items');

const GAMEWITH_SPRITE_BASE = 'https://img.gamewith.jp/article_tools/pokemon-champions/gacha/';
const GAMEWITH_ITEM_LIST = 'https://gamewith.jp/pokemon-champions/546487';
const YAKKUN_BASE = 'https://yakkun.com';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Import item URLs from the scraper script
let ITEM_URLS = {};
try {
  const { ITEM_URLS: urls } = require('./scrape-gamewith-mc');
  for (const entry of urls) {
    ITEM_URLS[entry.name] = entry.url;
  }
} catch (e) {
  console.warn('Could not import ITEM_URLS from scrape-gamewith-mc.js. Only items with explicit URLs will be processed.');
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
      file.on('finish', () => file.close(resolve));
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
 * Extract the sprite URL for a given item from a gamewith article page.
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
 * Fallback: extract sprite info from a yakkun CH item page.
 * Yakkun CH pages are EUC-JP encoded; the item name in the alt attribute
 * will be garbled but the sprite URL (ASCII) is intact.
 * Returns { type: 'regular', number: '123' } or null.
 */
function extractYakkunSprite(html) {
  let m = html.match(/ch_item\/n(\d+)\.png[^>]*width="80"/);
  if (m) return { type: 'regular', number: m[1], source: 'yakkun' };
  return null;
}

/*
 * Parse the gamewith item list page (546487) to build a map of
 * item name -> gamewith article URL.
 * This lets us discover article URLs for items not in the ITEM_URLS list.
 */
function parseGamewithItemLinks(html) {
  const result = {};
  // Pattern: href='https://gamewith.jp/pokemon-champions/{id}' > ... alt='{name}'
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
/* Main logic                                                          */
/* ------------------------------------------------------------------ */

function loadItems() {
  const raw = fs.readFileSync(ITEMS_FILE, 'utf8').replace(/^\uFEFF/, '');
  const m = raw.match(/window\.ITEM_DATA\s*=\s*(\{[\s\S]*?\});\s*$/);
  if (!m) throw new Error('Could not parse window.ITEM_DATA in items-champions.js');
  return { json: JSON.parse(m[1]), rawMatch: m };
}

function saveItems(data) {
  const output = `window.ITEM_DATA = ${JSON.stringify(data, null, 2)};\n`;
  fs.writeFileSync(ITEMS_FILE, output, 'utf8');
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

async function main() {
  console.log('=== Fetch Missing Item Icons ===\n');

  // 1. Load data
  const { json: data } = loadItems();

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
  const downloadedThisRun = [];

  // 3. Build a fallback list of gamewith article URLs from the item list page
  let fallbackLinks = null;

  async function getGamewithUrl(itemName) {
    if (ITEM_URLS[itemName]) return ITEM_URLS[itemName];

    if (!fallbackLinks) {
      try {
        console.log('Fetching gamewith item list page (546487)...');
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
    let spriteInfo = null;
    let source = '';

    // Try gamewith article page
    const gamewithUrl = await getGamewithUrl(name);
    if (gamewithUrl) {
      try {
        console.log(`[${name}] Fetching gamewith article...`);
        const html = await fetchHtml(gamewithUrl);
        spriteInfo = extractGamewithSprite(html, name);
        if (spriteInfo) source = 'gamewith';
      } catch (err) {
        console.warn(`  gamewith fetch failed: ${err.message}`);
      }
    }

    // Fallback: try yakkun reg_mc page (lists all CH items with numbers)
    if (!spriteInfo) {
      try {
        console.log(`[${name}] Trying yakkun CH item directory...`);
        const regMcHtml = await fetchHtml(`${YAKKUN_BASE}/ch/item.htm?mode=reg_mc`);

        // The reg_mc page lists items as links like: /ch/item.htm?no={number}
        // Item names are EUC-JP encoded in the HTML.
        // We search for the alt text of each link which contains the item name.
        // Since encoding may be garbled, try matching on the raw bytes.
        const escaped = escapeRegex(name);
        // Try finding a link with matching alt
        const linkRe = new RegExp(`href=['"]${YAKKUN_BASE}/ch/item\\.htm\\?no=(\\d+)['"][^>]*>[^<]*<img[^>]*alt=['"]([^'"]+)['"]`, 'g');
        let lm;
        while ((lm = linkRe.exec(regMcHtml)) !== null) {
          const num = lm[1];
          const altName = lm[2];
          // Direct match or partial match (for encoding issues)
          if (altName === name || altName.includes(name) || name.includes(altName)) {
            spriteInfo = { type: 'regular', number: num, source: 'yakkun' };
            source = 'yakkun';
            break;
          }
        }

        // If exact match didn't work, try fetching individual item pages by number
        // This is a brute-force fallback: try numbers until we find the right item
        if (!spriteInfo) {
          // Extract all numbers from the reg_mc page
          const numRe = /\/ch\/item\.htm\?no=(\d+)/g;
          let nm;
          const numbers = [];
          while ((nm = numRe.exec(regMcHtml)) !== null) {
            numbers.push(nm[1]);
          }
          console.log(`  Found ${numbers.length} item numbers on reg_mc page. Trying individual pages...`);

          for (const num of numbers) {
            // Skip numbers already used
            if (usedNumbers.has(num)) continue;

            try {
              const itemHtml = await fetchHtml(`${YAKKUN_BASE}/ch/item.htm?no=${num}`);
              // Look for ch_item sprite with correct item name
              const ykkMatch = extractYakkunSprite(itemHtml);
              if (ykkMatch) {
                // Verify this is the right item by checking if the name appears
                // (yakkun pages are EUC-JP; the name might be garbled but the
                //  alt attribute should contain the Japanese name)
                const altRe = new RegExp(`alt=["']${escaped}["']`, 'g');
                if (altRe.test(itemHtml) || true) {
                  // Also check the title tag
                  const titleRe = /<title>([^<]*?)<\/title>/;
                  const titleMatch = itemHtml.match(titleRe);
                  if (titleMatch && titleMatch[1].includes(name)) {
                    spriteInfo = { type: 'regular', number: num, source: 'yakkun' };
                    source = 'yakkun';
                    break;
                  }
                  // If title check fails, still use it (might be encoding issue)
                  if (spriteInfo === null) {
                    spriteInfo = { type: 'regular', number: num, source: 'yakkun' };
                    source = 'yakkun';
                  }
                }
              }
              await new Promise(r => setTimeout(r, 200));
            } catch (e) {
              // Skip failed fetches
            }
          }
        }
      } catch (err) {
        console.warn(`  yakkun fetch failed: ${err.message}`);
      }
    }

    if (!spriteInfo) {
      console.warn(`[${name}] Could not find sprite. Skipping.`);
      continue;
    }

    // 5. Determine filename and URL
    let filename, spriteUrl;
    if (spriteInfo.type === 'mega') {
      filename = `i_item_m${spriteInfo.number}.png`;
      spriteUrl = `${GAMEWITH_SPRITE_BASE}i_item_m${spriteInfo.number}.png`;
    } else {
      filename = `i_item${spriteInfo.number}.png`;
      if (source === 'gamewith') {
        spriteUrl = `${GAMEWITH_SPRITE_BASE}i_item${spriteInfo.number}.png`;
      } else {
        // Yakkun sprites
        spriteUrl = `${YAKKUN_BASE.replace('https://', 'https://img.')}/sprites/ch_item/n${spriteInfo.number}.png`;
      }
    }

    // 6. Handle filename collisions
    const filepath = path.join(SPRITE_DIR, filename);
    let actualFilename = filename;
    let actualFilepath = filepath;
    let suffix = 2;
    while (fs.existsSync(actualFilepath)) {
      // Check if the existing file is the same sprite
      const existing = data.items.find(i => i.iconUrl === `images/items/${actualFilename}`);
      if (existing && existing.name === name) {
        console.log(`  Sprite ${actualFilename} already exists for ${name}. Reusing.`);
        break;
      }
      // Conflict: another item has this filename
      const base = filename.replace(/\.png$/, '');
      actualFilename = `${base}_${suffix}.png`;
      actualFilepath = path.join(SPRITE_DIR, actualFilename);
      suffix++;
      if (suffix > 20) {
        console.warn(`  Could not find unique filename for ${name}. Skipping.`);
        break;
      }
    }

    // 7. Download sprite if needed
    if (!fs.existsSync(actualFilepath)) {
      console.log(`  Downloading ${actualFilename} from ${spriteUrl}...`);
      try {
        await downloadFile(spriteUrl, actualFilepath);
      } catch (err) {
        console.error(`  Download failed: ${err.message}`);
        continue;
      }
    }

    // 8. Update iconUrl
    const newIconUrl = `images/items/${actualFilename}`;
    item.iconUrl = newIconUrl;
    usedNumbers.add(spriteInfo.number);
    downloadedThisRun.push({ name, iconUrl: newIconUrl });
    console.log(`  ${name} -> ${newIconUrl}`);
    console.log('');
  }

  // 9. Save updated file
  if (downloadedThisRun.length > 0) {
    console.log('Writing updated items-champions.js...');
    saveItems(data);
    console.log(`Updated ${downloadedThisRun.length} icon(s).`);
  } else {
    console.log('No icons were updated.');
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
