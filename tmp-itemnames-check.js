const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT_ROOT = path.resolve(__dirname);
const DATA_DIR = path.join(PROJECT_ROOT, 'data');

function loadJs(filePath) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''), context);
  const keys = Object.keys(context.window);
  if (keys.length !== 1) throw new Error('Expected single export in ' + filePath + ' (got ' + keys.length + ')');
  return context.window[keys[0]];
}

const ITEM_DATA = loadJs(path.join(DATA_DIR, 'items-champions.js'));
const itemNames = ITEM_DATA.items.map(i => i.name);
const out = [
  'ITEM_DATA.items.length=' + ITEM_DATA.items.length,
  'itemNames.length=' + itemNames.length,
  'has empty name? ' + itemNames.some(n => typeof n !== 'string' || n.trim() === ''),
  '---',
];
['アブソルナイト', 'ガブリアスナイト', 'ルカリオナイト', 'アブソルナイトZ', 'グランドコート', 'ながねぎ'].forEach(n => {
  out.push(n + (itemNames.includes(n) ? ' IN' : ' NOT-IN'));
});
out.push('--- first 5 ---');
out.push(itemNames.slice(0, 5).join(' | '));
out.push('--- last 5 ---');
out.push(itemNames.slice(-5).join(' | '));
fs.writeFileSync(path.join(PROJECT_ROOT, 'tmp-itemnames.txt'), out.join('\r\n'), 'utf8');
console.log('WROTE tmp-itemnames.txt');
