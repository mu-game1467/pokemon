/*
 * Collects the public Champions Pokedex data from Yakkun into a local JSON file.
 * Run with: node scripts/scrape-yakkun-champions.js
 */
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://yakkun.com';
const INDEX_URL = `${BASE_URL}/ch/zukan/`;
const OUTPUT = path.join(__dirname, '..', 'data', 'pokemon-champions.json');
const concurrency = 4;

function clean(value) {
  return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function unique(values) {
  return [...new Set(values.map(value => clean(value)).filter(Boolean))];
}

async function getHtml(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'AI_pokemon local data collector' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

function collectList(html) {
  const records = new Map();
  const linkPattern = /<a\s+href="\/ch\/zukan\/(n[0-9a-z]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkPattern.exec(html))) {
    const id = match[1].toLowerCase();
    const name = clean(match[2]);
    if (!name || records.has(id)) continue;
    const start = Math.max(0, html.lastIndexOf('<li', match.index));
    const end = html.indexOf('</li>', match.index);
    const row = html.slice(start, end === -1 ? match.index + 1500 : end);
    if (/<li[^>]*class="[^"]*nodata/i.test(row)) continue;
    const statsMatch = row.match(/(\d+)\s*-\s*(\d+)\s*-\s*(\d+)\s*-\s*(\d+)\s*-\s*(\d+)\s*-\s*(\d+)/);
    const types = [...row.matchAll(/alt="([^"]*?)タイプ"/gi)].map(item => item[1]);
    const abilities = [...row.matchAll(/<a[^>]*>\s*([^<]+?)\s*<\/a>/gi)].map(item => item[1]);
    records.set(id, {
      id,
      name,
      pageUrl: `${BASE_URL}/ch/zukan/${id}`,
      iconUrl: `https://img.yakkun.com/poke/icon96/${id}.gif`,
      types: unique(types),
      abilities: unique(abilities).slice(-3),
      baseStats: statsMatch ? { hp: +statsMatch[1], attack: +statsMatch[2], defense: +statsMatch[3], specialAttack: +statsMatch[4], specialDefense: +statsMatch[5], speed: +statsMatch[6] } : null,
      moves: []
    });
  }
  return [...records.values()];
}

function parseDetails(record, html) {
  const moveTableStart = html.indexOf('覚える技');
  const moveHtml = moveTableStart === -1 ? '' : html.slice(moveTableStart);
  const moves = [...moveHtml.matchAll(/class="move_main_row[^"]*"[\s\S]*?<div class="move_name"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/gi)].map(match => match[1]);
  const statsStart = html.indexOf('種族値');
  const statsHtml = statsStart === -1 ? '' : html.slice(statsStart, statsStart + 10000);
  const statNames = [['hp', 'HP'], ['attack', '攻撃'], ['defense', '防御'], ['specialAttack', '特攻'], ['specialDefense', '特防'], ['speed', '素早']];
  const baseStats = {};
  for (const [key, label] of statNames) {
    const match = statsHtml.match(new RegExp(`<tr[^>]*>[\\s\\S]*?<t[hd][^>]*>${label}<\\/t[hd]>[\\s\\S]*?<t[hd][^>]*>[^0-9]*(\\d+)`, 'i'));
    if (match) baseStats[key] = +match[1];
  }
  const abilitySection = html.match(/特性\(とくせい\)[\s\S]{0,12000}/i)?.[0] || '';
  const abilities = [...abilitySection.matchAll(/<a[^>]*>\s*([^<]+?)\s*<\/a>/gi)].map(match => match[1]).filter(value => !/ヘルプ|検索/.test(value));
  return { ...record, baseStats: Object.keys(baseStats).length === 6 ? baseStats : record.baseStats, abilities: unique(abilities).slice(0, 3), moves: unique(moves) };
}

async function mapWithConcurrency(items, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      try { results[index] = await worker(items[index], index); }
      catch (error) { console.warn(`Skipped ${items[index].id}: ${error.message}`); results[index] = items[index]; }
      if ((index + 1) % 25 === 0) console.log(`${index + 1}/${items.length}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, run));
  return results;
}

async function main() {
  console.log(`Fetching ${INDEX_URL}`);
  const records = collectList(await getHtml(INDEX_URL));
  console.log(`Found ${records.length} Champions entries`);
  const detailed = await mapWithConcurrency(records, async record => parseDetails(record, await getHtml(record.pageUrl)));
  const output = { source: INDEX_URL, fetchedAt: new Date().toISOString(), count: detailed.length, pokemon: detailed };
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Saved ${detailed.length} entries to ${OUTPUT}`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });