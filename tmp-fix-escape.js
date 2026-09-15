const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');

// Fix the escaping issues in onclick handlers
// The problem: onclick="addPokemon('' + p.name + '')" should be onclick="addPokemon('" + p.name + "')"
// And onerror="this.style.display='none'" has incorrect escaping

// Fix line with addPokemon in recommendations
c = c.replace(
  /onclick="addPokemon\('' \+ p\.name \+ ''\)"/,
  'onclick="addPokemon(\'' + "'\" + p.name + \"'" + '\")"
);

// Simpler approach: just replace the broken patterns directly
// Fix: addPokemon('' + p.name + '') => addPokemon('${p.name}')
c = c.replace(/onclick="addPokemon\('' \+ p\.name \+ ''\)"/g, 'onclick="addPokemon(\''\''+p.name+\'\'\')"');

// Fix onerror with broken display
c = c.replace(/onerror="this\.style\.display='\\\'none'"/g, 'onerror="this.style.display=\\\'none\\\'"');

fs.writeFileSync('index.html', c);
console.log('Fixed escaping issues');

// Verify
const idx = c.indexOf("onclick=\"addPokemon('') + p.name + '')");
console.log('Bad pattern still present:', idx >= 0);
