const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');
// Replace the \r\n inside the template literal
const old = "'#ffebee':'\r\nb.startsWith";
const newStr = "'#ffebee':b.startsWith";
c = c.replace(old, newStr);
fs.writeFileSync('index.html', c);
// Verify
const idx = c.indexOf("badges.map(b =>");
console.log('After fix:', JSON.stringify(c.substring(idx, idx + 200)));
