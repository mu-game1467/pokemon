const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');

// Fix 1: recommendTeam() covering logic - exclude Pokemon that have the weakness
const oldCovering = "return p.types.some(type => typeResist[type]?.includes(topWeaknessType) || type === topWeaknessType);";
const newCovering = "if (p.types.includes(topWeaknessType)) return false; return !p.types.some(type => typeWeakness[type]?.includes(topWeaknessType));";
c = c.replace(oldCovering, newCovering);

// Fix 2: getTopBuildTeams - sort by season descending (M-4 before M-1)
const oldSort = "return teams.filter(t => t.name).sort((a, b) => b.rating - a.rating).slice(0, 20);";
const newSort = "return teams.filter(t => t.name).sort((a, b) => { const sa = Number(a.season?.replace('M-', '')) || 999; const sb = Number(b.season?.replace('M-', '')) || 999; if (sa !== sb) return sb - sa; return b.rating - a.rating; }).slice(0, 20);";
c = c.replace(oldSort, newSort);

// Fix 3: recommendTeam() matchingTeams filter - exclude Pokemon with the weakness
const oldMatchTeams = "const matchingTeams = topBuilds.filter(t => t.types.some(type => type === topWeaknessType || typeResist[type]?.includes(topWeaknessType)));";
const newMatchTeams = "const matchingTeams = topBuilds.filter(t => !t.types.some(type => typeWeakness[type]?.includes(topWeaknessType)));";
c = c.replace(oldMatchTeams, newMatchTeams);

// Fix 4: recommendTeam() dualCover filter - exclude Pokemon with either weakness
const oldDualCover = "const dualCover = pokemon.filter(p => p.types.some(t => typeResist[t]?.includes(topWeaknessType)) && p.types.some(t => typeResist[t]?.includes(secondWeakType))).slice(0, 3);";
const newDualCover = "const dualCover = pokemon.filter(p => !p.types.some(t => typeWeakness[t]?.includes(topWeaknessType)) && !p.types.some(t => typeWeakness[t]?.includes(secondWeakType))).slice(0, 3);";
c = c.replace(oldDualCover, newDualCover);

fs.writeFileSync('index.html', c);
console.log('Fixed all 4 issues');
console.log('Fix 1 (covering):', c.includes("if (p.types.includes(topWeaknessType)) return false; return !p.types.some"));
console.log('Fix 2 (season sort):', c.includes('sa !== sb) return sb - sa'));
console.log('Fix 3 (matchingTeams):', c.includes("!t.types.some(type => typeWeakness[type]?.includes(topWeaknessType))"));
console.log('Fix 4 (dualCover):', c.includes("!p.types.some(t => typeWeakness[t]?.includes(topWeaknessType))"));
