const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

// Extract MOVE_EN_TO_JA
const moveMatch = content.match(/MOVE_EN_TO_JA\s*=\s*{([\s\S]*?)\};/);
if (moveMatch) {
    const moveMap = eval('({' + moveMatch[1].replace(/'/g, '"').replace(/([a-zA-Z]+):/g, '"$1":').replace(/,?$/, '') + '})');
    console.log('MOVE_EN_TO_JA entries:', Object.keys(moveMap).length);
}

// Instead let's parse manually
const moveStart = content.indexOf('MOVE_EN_TO_JA = {');
const moveEnd = content.indexOf('};', moveStart);
const moveContent = content.substring(moveStart, moveEnd);

// Find entries
const moveRegex = /'([^']+)'\s*:\s*'([^']+)'/g;
let m;
const moves = {};
while ((m = moveRegex.exec(moveContent)) !== null) {
    moves[m[1]] = m[2];
}
console.log('Moves in map:', Object.keys(moves).length);

// Check for specific moves
const testMoves = ['Night Daze', 'Night Slash', 'Shadow Claw', 'Illusion', 'Alluring Voice', "King's Shield"];
testMoves.forEach(move => {
    console.log(move + ':', moves[move] || 'NOT FOUND');
});

// Check abilities
const abilityStart = content.indexOf('ABILITY_EN_TO_JA = {');
const abilityEnd = content.indexOf('};', abilityStart);
const abilityContent = content.substring(abilityStart, abilityEnd);
const abilityRegex = /'([^']+)'\s*:\s*'([^']+)'/g;
const abilities = {};
while ((m = abilityRegex.exec(abilityContent)) !== null) {
    abilities[m[1]] = m[2];
}
console.log('\nAbilities in map:', Object.keys(abilities).length);

const testAbilities = ['Illusion', 'Adaptability', 'Bulletproof', 'Cursed Body'];
testAbilities.forEach(abl => {
    console.log(abl + ':', abilities[abl] || 'NOT FOUND');
});
