const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');
// Find the exact bytes around the issue
const idx = c.indexOf("#ffebee':'");
console.log('Found at:', idx);
if (idx >= 0) {
  const bytes = c.substring(idx-5, idx+30);
  console.log('Bytes:', JSON.stringify(bytes));
  console.log('Raw bytes:', [...bytes].map(ch => ch.charCodeAt(0).toString(16)).join(' '));
}
