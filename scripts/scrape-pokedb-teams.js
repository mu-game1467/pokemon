/*
 * Scrapes top-ranked team builds from pokedb.tokyo's open data API.
 *
 * Downloads season JSON files that contain ranked team compositions
 * (rank, rating, Pokemon builds with items/tera types).  The data is
 * enriched with sprite URLs from pokemon-champions.js and items-champions.js
 * so the frontend can render everything without additional lookups.
 *
 * Run with: node scripts/scrape-pokedb-teams.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ROOT = path.join(__dirname, '..');
const OUTPUT = path.join(PROJECT_ROOT, 'data', 'pokedb-teams.js');
const BASE_URL = 'https://champs.pokedb.tokyo';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/* ---- Load local data for enrichment ---- */

function loadJs(filePath, varName) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const m = raw.match(new RegExp(`window\\.${varName}\\s*=\\s*(\\{[\\s\\S]*?\\});\\s*$`));
  if (!m) throw new Error(`Could not parse ${varName} in ${path.basename(filePath)}`);
  return JSON.parse(m[1]);
}

// Build maps: pokemon name -> iconUrl, item name -> iconUrl
function buildLookups() {
  const pokemonData = loadJs(path.join(PROJECT_ROOT, 'data', 'pokemon-champions.js'), 'POKEMON_DATA');
  const itemData = loadJs(path.join(PROJECT_ROOT, 'data', 'items-champions.js'), 'ITEM_DATA');

  const pokemonMap = new Map();
  for (const p of pokemonData.pokemon) {
    if (p.name && p.iconUrl) {
      // Keep the first match (usually the base form)
      if (!pokemonMap.has(p.name)) {
        pokemonMap.set(p.name, p.iconUrl);
      }
    }
  }

    const itemMap = new Map();
  for (const item of itemData.items) {
    if (item.name && item.iconUrl) {
      itemMap.set(item.name, item.iconUrl);
    }
  }

  // Build a base-name fallback map: strip " (form)" suffix so we can still
  // resolve the correct sprite when pokedb sends only the base Pokemon name.
  const pokemonBaseMap = new Map();
  for (const p of pokemonData.pokemon) {
    if (p.name && p.iconUrl) {
       const baseName = p.name.split(' (')[0].replace(/[♂♀]$/, '');
      if (!pokemonBaseMap.has(baseName)) {
        pokemonBaseMap.set(baseName, p.iconUrl);
      }
    }
  }

  return { pokemonMap, pokemonBaseMap, itemMap };
}

/* ---- HTTP helpers ---- */

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(fetchJson(res.headers.location));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`${res.statusCode}: ${url}`));
        return;
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

/* ---- Main ---- */

async function fetchSeason(seasonNumber, rule, seasonMeta) {
  const ruleJp = rule === 'single' ? 'シングル' : 'ダブル';
  const url = `${BASE_URL}/opendata/s${seasonNumber}_${rule}_ranked_teams.json`;
  const key = `M-${seasonNumber}_${rule}`;

  try {
    console.log(`  Fetching ${key}...`);
    const data = await fetchJson(url);
    if (!data.teams || !data.teams.length) {
      console.log(`    No teams for ${key}. Skipping.`);
      return null;
    }
    console.log(`    ${data.teams.length} teams found.`);
    return { key, season: data.season, rule: ruleJp, teams: data.teams, updatedAt: data.updated_at };
  } catch (err) {
    console.warn(`    Failed to fetch ${key}: ${err.message}`);
    return null;
  }
}

function enrichTeam(team, pokemonMap, pokemonBaseMap, itemMap, rank) {
  return {
     rank: rank || team.rank,
    rating: team.rating_value,
    team: team.team.map(p => ({
      id: p.id,
      name: p.pokemon,
      form: p.form,
      type1: p.type1,
      type2: p.type2,
      category: p.category,
      terastal: p.terastal,
      item: p.item,
      iconUrl: pokemonMap.get(p.pokemon) || pokemonBaseMap.get(p.pokemon) || '',
      itemIconUrl: p.item && itemMap.get(p.item) ? itemMap.get(p.item).replace('images/items/', '/images/items/') : '',
    })),
  };
}

async function main() {
  console.log('=== Scrape Pokedb Teams ===\n');

  console.log('Loading local data for enrichment...');
  const { pokemonMap, pokemonBaseMap, itemMap } = buildLookups();
  console.log(`  ${pokemonMap.size} Pokemon entries, ${pokemonBaseMap.size} base names, ${itemMap.size} item entries loaded.\n`);

  const seasons = [
    { number: 5, label: 'M-5' },
    { number: 4, label: 'M-4' },
    { number: 3, label: 'M-3' },
    { number: 2, label: 'M-2' },
    { number: 1, label: 'M-1' },
  ];

  const rules = ['single', 'double'];
  const results = [];

  for (const season of seasons) {
    for (const rule of rules) {
      const raw = await fetchSeason(season.number, rule, season.label);
      if (!raw) continue;

      const enriched = {
        season: raw.season,
        seasonNumber: season.number,
        rule: raw.rule,
        updatedAt: raw.updatedAt,
        teams: raw.teams.map((t, index) => enrichTeam(t, pokemonMap, pokemonBaseMap, itemMap, index + 1)),
      };
      results.push(enriched);

      // Respect pokedb's server — small delay between requests
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Build output object keyed by season_rule for easy lookup
  const output = {
    source: `${BASE_URL}/guide/opendata`,
    fetchedAt: new Date().toISOString(),
    seasons: results,
  };

  const jsContent = `window.POKEDB_TEAMS_DATA = ${JSON.stringify(output, null, 2)};\n`;
  fs.writeFileSync(OUTPUT, jsContent, 'utf8');
  console.log(`\nSaved ${results.length} season/rule combinations to ${OUTPUT}`);
}

main().catch(err => { console.error(err); process.exitCode = 1; });
