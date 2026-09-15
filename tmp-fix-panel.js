const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');

// Find the recommendations section
const startIdx = c.indexOf("          const recEl = $('recommendations');");
const docListenerIdx = c.indexOf("document.addEventListener('click'", startIdx);
const sectionEnd = docListenerIdx - (100 - c.substring(docListenerIdx - 100, docListenerIdx).lastIndexOf("}")) + 1;

const before = c.substring(0, startIdx);
const after = c.substring(sectionEnd);

// Build the new section using a clean approach
const newLines = [
  "          const recEl = $('recommendations');",
  "          if (recEl) {",
  "            if (!party.length) {",
  "              recEl.innerHTML = '<div class=\"mono\" style=\"color:var(--muted)\">パーティを追加するとおすすめを表示します。</div>';",
  "            } else {",
  "              const topWeaknessType = weakness.length ? weakness[0][0] : null;",
  "              const partyTypes = new Set(party.flatMap(p => p.types));",
  "              let recommended = [];",
  "              if (topWeaknessType) {",
  "                recommended = pokemon.filter(p => {",
  "                  if (party.some(x => x.name === p.name)) return false;",
  "                  if (p.types.some(type => typeWeakness[type] && typeWeakness[type].includes(topWeaknessType))) return false;",
  "                  return true;",
  "                }).sort((a, b) => baseStatTotal(b) - baseStatTotal(a)).slice(0, 5);",
  "              }",
  "              let html = recommended.map(p => {",
  "                const covers = topWeaknessType && p.types.some(t => typeResist[t] && typeResist[t].includes(topWeaknessType));",
  "                const newType = p.types.some(t => !partyTypes.has(t));",
  "                const tags = [];",
  "                if (covers) tags.push('💥 弱点カバー');",
  "                if (newType) tags.push('🌈 新規タイプ');",
  "                if (p.types.some(t => partyTypes.has(t))) tags.push('⚠️ タイプ重複');",
  "                const iconUrl = findPokemonLocal(p.name)?.iconUrl || '';",
  '                return \'<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line);cursor:pointer" onclick="addPokemon(\\\'' + p.name + \'\\\')"><img src="\' + iconUrl + \'" style="width:28px;height:28px;object-fit:contain" onerror="this.style.display=\\\'none\\\'" ><div style="flex:1"><div style="font-weight:600">\' + p.name + \' (\' + p.types.join(\'/\') + \')</div><div style="font-size:10px;color:var(--muted)">\' + p.role + \'</div><div style="font-size:10px">\' + tags.map(t => \'<span style="background:#fff3e0;padding:2px 6px;border-radius:3px;margin-right:4px">\' + t + \'</span>\').join(\'\') + \'</div></div></div></div>\';',
  "              }).join('');",
  "              const topBuilds = getTopBuildTeams();",
  "              if (topWeaknessType && topBuilds.length) {",
  "                const matchingBuilds = topBuilds.filter(t => !t.types.some(type => typeWeakness[type] && typeWeakness[type].includes(topWeaknessType)));",
  "                if (matchingBuilds.length > 0) {",
  "                  html += '<div style=\"font-size:10px;color:var(--muted);padding:4px 0 2px\">【実戦 \' + topWeaknessType + \' 対策ポケモン】</div>';",
  "                  html += matchingBuilds.slice(0, 3).map(t => {",
  "                    const iconUrl = findPokemonLocal(t.name)?.iconUrl || '';",
  '                    return \'<div style="display:flex;align-items:center;gap:4px;padding:2px 0;cursor:pointer" onclick="addPokemon(\\\'' + t.name + \'\\\')"><img src="\' + iconUrl + \'" style="width:24px;height:24px;object-fit:contain" onerror="this.style.display=\\\'none\\\'" ><div>\' + t.name + \' / \' + t.item + \'</div><div style="color:var(--muted)">S\' + t.season + \'</div></div></div>\';',
  "                  }).join('');",
  "                }",
  "              }",
  "              if (!html) html = '<div class=\"mono\" style=\"color:var(--muted)\">パーティの弱点を補完するポケモンが見つかりません。</div>';",
  "              recEl.innerHTML = html;",
  "            }",
  "          }"
];

const newSection = newLines.join('\r\n');

c = before + newSection + after;
fs.writeFileSync('index.html', c);
console.log('Replaced recommendations panel with fixed escaping');
