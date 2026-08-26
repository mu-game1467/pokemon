const fs = require('fs');
const path = require('path');

const POKEMON_JSON = path.join(__dirname, '..', 'data', 'pokemon-champions.json');
const POKEMON_JS = path.join(__dirname, '..', 'data', 'pokemon-champions.js');
const GAMEWITH_JSON = path.join(__dirname, '..', 'data', 'gamewith-moves.json');

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function updatePokemonData() {
  console.log('Loading existing pokemon data...');
  const existing = readJson(POKEMON_JSON);
  console.log(`Existing: ${existing.count} Pokemon`);

  console.log('Loading GameWith move data...');
  const gameWith = readJson(GAMEWITH_JSON);
  console.log(`GameWith: ${gameWith.count} Pokemon`);

  const gwMap = new Map(gameWith.pokemon.map(p => [p.name, p]));

  let updated = 0;
  let skipped = 0;
  for (const p of existing.pokemon) {
    const gw = gwMap.get(p.name);
    if (gw && gw.moves && gw.moves.length > 0) {
      p.moves = gw.moves;
      updated++;
    } else {
      skipped++;
    }
  }

  existing.count = existing.pokemon.length;
  existing.source = 'GameWith + Yakkun';
  existing.updatedAt = new Date().toISOString();

  fs.writeFileSync(POKEMON_JSON, JSON.stringify(existing, null, 2) + '\n', 'utf8');
  console.log(`Updated ${updated} Pokemon moves in pokemon-champions.json`);
  console.log(`Skipped ${skipped} Pokemon (no GameWith data)`);

  // Also update the JS version
  console.log('Updating pokemon-champions.js...');
  const jsContent = fs.readFileSync(POKEMON_JS, 'utf8').replace(/^\uFEFF/, '');
  const jsMatch = jsContent.match(/window\.POKEMON_DATA\s*=\s*({[\s\S]*?});/);
  if (jsMatch) {
    const jsJson = JSON.parse(jsMatch[1]);
    const jsMap = new Map(jsJson.pokemon.map(p => [p.name, p]));
    
    let jsUpdated = 0;
    for (const p of jsJson.pokemon) {
      const gw = gwMap.get(p.name);
      if (gw && gw.moves && gw.moves.length > 0) {
        p.moves = gw.moves;
        jsUpdated++;
      }
    }
    
    const newJs = `window.POKEMON_DATA = ${JSON.stringify(jsJson, null, 2)};`;
    fs.writeFileSync(POKEMON_JS, newJs, 'utf8');
    console.log(`Updated ${jsUpdated} Pokemon moves in pokemon-champions.js`);
  }

  // Clean up temp files
  const progressFile = path.join(__dirname, '..', 'data', 'gamewith-moves-progress.json');
  if (fs.existsSync(progressFile)) {
    fs.unlinkSync(progressFile);
    console.log('Cleaned up progress file');
  }

  console.log('\nDone!');
}

updatePokemonData();
