const https = require('https');
https.get('https://championsbattledata.com/api', {headers: {'User-Agent': 'Mozilla/5.0'}}, (res) => {
    var data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        var json = JSON.parse(data);
        // Find Absol
        const absol = json.pokemon.find(p => p.name === 'Absol');
        if (absol) {
            console.log('Absol showdownId:', absol.showdownId);
            console.log('Learnable moves:', absol.learnableMoveNames);
            
            // Check battle data
            if (absol.summary?.battleSummary?.Current?.Singles) {
                const bs = absol.summary.battleSummary.Current.Singles;
                console.log('\nSingles top moves:');
                if (bs.top?.move) console.log('Top move:', bs.top.move);
                if (bs.values?.move) console.log('Move values:', bs.values.move.slice(0, 10));
            }
        }
    });
});
