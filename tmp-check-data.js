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

// moves の p 欠落検出
const moves = loadJs(path.join(DATA_DIR, 'moves-champions.js'));
const moveKeys = Object.keys(moves);
const noP = moveKeys.filter(k => moves[k].p === undefined);
const lines = ['noP count: ' + noP.length, '---'];
noP.slice(0, 200).forEach(k => {
  lines.push(k + ' : ' + JSON.stringify(moves[k]));
});
fs.writeFileSync(path.join(PROJECT_ROOT, 'tmp-noP.txt'), lines.join('\r\n'));
console.log('WROTE tmp-noP.txt');

// showdown 名重複検出
const map = loadJs(path.join(DATA_DIR, 'showdown-name-map.js'));
const vals = Object.values(map);
const dupCount = vals.length - new Set(vals).size;
const dups = [...new Set(vals.filter((v, i) => vals.indexOf(v) !== i))];
const lines2 = ['dup count: ' + dupCount, '---'];
dups.forEach(v => {
  lines2.push(v + ' (cnt: ' + vals.filter(y => y === v).length + ')');
});
fs.writeFileSync(path.join(PROJECT_ROOT, 'tmp-dup.txt'), lines2.join('\r\n'));
console.log('WROTE tmp-dup.txt');

// items の name 空文字検出（data.test.js M-C items 失敗用）
const items = loadJs(path.join(DATA_DIR, 'items-champions.js'));
const emptyNames = items.filter(i => !i || typeof i.name !== 'string' || i.name.trim() === '');
const lines3 = ['empty item name count: ' + emptyNames.length, '---'];
emptyNames.slice(0, 200).forEach(i => {
  lines3.push(JSON.stringify(i));
});
fs.writeFileSync(path.join(PROJECT_ROOT, 'tmp-empty-items.txt'), lines3.join('\r\n'));
console.log('WROTE tmp-empty-items.txt');
