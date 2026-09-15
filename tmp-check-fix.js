const fs = require('fs');
const c = fs.readFileSync('index.html', 'utf8');

// Fix scoredCandidates filter - remove the line that excludes Pokemon with the weakness
// Currently: if(p.types.some(type=>typeWeakness[type]?.includes(topWeakness)))return false;
// This excludes Pokemon that are weak to the top weakness - but they might still be good additions
// We should only filter out Pokemon that are weak to the top weakness AND don't cover it

// Actually, the real issue is this filter prevents dual-weakness-cover Pokemon from appearing
// in the recommendations panel. Let me check the exact filter code.
const idx = c.indexOf("if(p.types.some(type=>typeWeakness[type]?.includes(topWeakness)))return false");
console.log('Found problematic filter:', idx >= 0);

// Let's see the full filter context
if (idx >= 0) {
  console.log('Context:', c.substring(idx - 100, idx + 200));
}
