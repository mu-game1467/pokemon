const fs = require('fs');
const c = fs.readFileSync('data/items-champions.js', 'utf8');
// Find Charizardite entries
const idx1 = c.indexOf('リザードナイト');
console.log('リザードナイト found:', idx1 >= 0);
if (idx1 >= 0) {
    console.log(c.substring(idx1-50, idx1+200));
}
const idx2 = c.indexOf('Charizardite');
console.log('Charizardite found:', idx2 >= 0);
if (idx2 >= 0) {
    console.log(c.substring(idx2-50, idx2+200));
}
