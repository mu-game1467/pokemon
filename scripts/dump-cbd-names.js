// Distinct category/name values from championsbattledata.com API
const https = require('https');
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}
(async () => {
  const idx = await get('https://championsbattledata.com/api');
  console.log('pokemon count:', idx.pokemon.length);
  console.log('first5:', JSON.stringify(idx.pokemon.slice(0,5).map(p=>({showdownId:p.showdownId,name:p.name})), null, 1));
  const abo = idx.pokemon.find(p=>p.showdownId==='abomasnow');
  console.log('abomasnow entry:', JSON.stringify(abo, null, 1).slice(0, 2000));
  for (const sid of ['abomasnow','garchomp','charizard','gengar','pikachu','scizor']) {
    for (const fmt of ['Singles','Doubles']) {
      try {
        const b = await get(`https://championsbattledata.com/api/battle/${fmt}/${sid}`);
        const cats = {};
        for (const r of (b.rows||[])) {
          (cats[r.category] = cats[r.category] || new Set()).add(
            r.category==='stat_points' ? `EV(${r.hp_points}/${r.attack_points}/${r.defense_points}/${r.sp_atk_points}/${r.sp_def_points}/${r.speed_points})` :
            r.category==='stat_alignment' ? `${r.name} up=${r.stat_up} down=${r.stat_down}` : r.name);
        }
        console.log(`\n==== ${fmt}/${sid} ====`);
        for (const [c,set] of Object.entries(cats)) console.log(`[${c}]`, [...set].join(' | '));
      } catch(e) { console.log(`FAIL ${fmt}/${sid}: ${e.message}`); }
    }
  }
})().catch(e=>{console.error(e);process.exit(1);});
