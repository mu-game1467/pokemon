const fs = require('fs');
const c = fs.readFileSync('index.html', 'utf8');
console.log('Fix 1 (covering):', c.includes("if (p.types.includes(topWeaknessType)) return false; return !p.types.some") ? 'OK' : 'NOT FOUND');
console.log('Fix 2 (season sort):', c.includes("sa !== sb) return sb - sa") ? 'OK' : 'NOT FOUND');
console.log('Fix 3 (matchingTeams):', c.includes("!t.types.some(type => typeWeakness[type]?.includes(topWeaknessType))") ? 'OK' : 'NOT FOUND');
console.log('Fix 4 (dualCover):', c.includes("!p.types.some(t => typeWeakness[t]?.includes(topWeaknessType)) && !p.types.some(t => typeWeakness[t]?.includes(secondWeakType))") ? 'OK' : 'NOT FOUND');
