const fs = require('fs');
const c = fs.readFileSync('index.html', 'utf8');

// Check fix 1 - covering logic
const idx1 = c.indexOf("if (p.types.includes(topWeaknessType)) return false; return !p.types.some");
console.log('Fix 1 (covering):', idx1 >= 0 ? 'OK' : 'NOT FOUND');

// Check fix 2 - season sort
const idx2 = c.indexOf("sa !== sb) return sb - sa");
console.log('Fix 2 (season sort):', idx2 >= 0 ? 'OK' : 'NOT FOUND');

// Check fix 3 - matchingTeams
const idx3 = c.indexOf("!t.types.some(type => typeWeakness[type]?.includes(topWeaknessType))");
console.log('Fix 3 (matchingTeams):', idx3 >= 0 ? 'OK' : 'NOT FOUND');

// Check fix 4 - dualCover  
const idx4 = c.indexOf("!p.types.some(t => typeWeakness[t]?.includes(topWeaknessType))");
console.log('Fix 4 (dualCover):', idx4 >= 0 ? 'OK' : 'NOT FOUND');

// Also check the old patterns are gone
console.log('Old covering pattern removed:', c.includes("p.types.some(type => typeResist[type]?.includes(topWeaknessType) || type === topWeaknessType))");
