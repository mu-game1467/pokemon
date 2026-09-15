const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname);
const DATA_DIR = path.join(PROJECT_ROOT, 'data');

const json = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'pokemon-champions.json'), 'utf8'));
const items = json.items;
console.log('pokemon-champions.json items type:', typeof items, 'isArray:', Array.isArray(items), 'length:', items ? items.length : null);
const emptyNames = items ? items.filter(i => !i || typeof i.name !== 'string' || i.name.trim() === '') : [];
console.log('empty name count in JSON items:', emptyNames.length);
if (emptyNames.length > 0) {
  console.log('empty items sample:');
  emptyNames.slice(0, 40).forEach(i => console.log(JSON.stringify(i)));
}
