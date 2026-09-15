const fs = require('fs');
const c = fs.readFileSync('index.html', 'utf8');

const startIdx = c.indexOf("          const recEl = $('recommendations');");
console.log('Start at:', startIdx);

// The section ends at the line "        }" before "        document.addEventListener"  
const docListenerIdx = c.indexOf("document.addEventListener('click'", startIdx);
console.log('docListener at:', docListenerIdx);

// Find "        }" right before document.addEventListener
const searchRegion = c.substring(docListenerIdx - 100, docListenerIdx);
console.log('Search region:', JSON.stringify(searchRegion));

// Find last } in the search region
const lastClose = searchRegion.lastIndexOf("}");
console.log('Last } at:', lastClose);

// Extract the full section
const sectionEndIdx = docListenerIdx - (100 - lastClose) + 1;
console.log('Section ends at:', sectionEndIdx);
console.log('Section end content:', JSON.stringify(c.substring(sectionEndIdx - 5, sectionEndIdx + 5)));
