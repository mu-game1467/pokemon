const fs = require('fs');
const c = fs.readFileSync('data/items-champions.js', 'utf8');
const idx = c.indexOf('ライチュウナイト');
console.log('ライチュウナイト found:', idx >= 0);
if (idx >= 0) {
    console.log(c.substring(idx-50, idx+300));
}