const https = require('https');
https.get('https://championsbattledata.com/api', {headers: {'User-Agent': 'Mozilla/5.0'}}, (res) => {
    var data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        var json = JSON.parse(data);
        // Get all unique moves from a few Pokemon
        const allMoves = new Set();
        const allAbilities = new Set();
        const allItems = new Set();
        json.pokemon.slice(0, 50).forEach(p => {
            if (p.learnableMoveNames) p.learnableMoveNames.forEach(m => allMoves.add(m));
            if (p.summary?.battleSummary?.Current) {
                const bs = p.summary.battleSummary.Current;
                if (bs.Singles) {
                    if (bs.Singles.values?.ability) bs.Singles.values.ability.forEach(a => allAbilities.add(a));
                    if (bs.Singles.values?.held_item) bs.Singles.values.held_item.forEach(i => allItems.add(i));
                }
                if (bs.Doubles) {
                    if (bs.Doubles.values?.ability) bs.Doubles.values.ability.forEach(a => allAbilities.add(a));
                    if (bs.Doubles.values?.held_item) bs.Doubles.values.held_item.forEach(i => allItems.add(i));
                }
            }
        });
        
        console.log('=== Moves ===');
        console.log('Total:', allMoves.size);
        console.log([...allMoves].sort().join(', '));
        
        console.log('\n=== Abilities ===');
        console.log('Total:', allAbilities.size);
        console.log([...allAbilities].sort().join(', '));
        
        console.log('\n=== Items ===');
        console.log('Total:', allItems.size);
        console.log([...allItems].sort().join(', '));
    });
});
