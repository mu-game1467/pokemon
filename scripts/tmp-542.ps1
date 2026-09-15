# 1) Which CBD Pokemon carry each "Unknown Item NNN" (fairy mons to test Roseli hypothesis)
# 2) PokeAPI REST lookup for unresolved item IDs
# 3) CBD sprite URL checks for candidate English names
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ids = @('sylveon','togekiss','clefable','whimsicott','diancie','azumarill','klefki','florges','granbull','chandelure','gengar','mimikyu','wigglytuff','mr-mime','floette')
$targets = @{}
foreach ($id in $ids) {
  try {
    $b = Invoke-RestMethod -Uri "https://championsbattledata.com/api/battle/Singles/$id" -TimeoutSec 20
    $items = @($b.rows | Where-Object { $_.category -eq 'held_item' } | ForEach-Object { $_.name } | Select-Object -Unique)
    $unknown = @($items | Where-Object { $_ -like 'Unknown Item*' })
    if ($unknown.Count -gt 0) {
      Write-Output ("CARRIER {0}: {1}" -f $id, ($unknown -join ', '))
      foreach ($u in $unknown) { if (-not $targets.ContainsKey($u)) { $targets[$u] = @() }; $targets[$u] += $id }
    } else {
      Write-Output ("CARRIER {0}: (no unknown items) items=[{1}]" -f $id, ($items -join ' / '))
    }
  } catch { Write-Output ("CARRIER {0}: ERROR {1}" -f $id, $_.Exception.Message) }
}
Write-Output '---- summary ----'
foreach ($k in $targets.Keys) { Write-Output ("{0} => carried by: {1}" -f $k, ($targets[$k] -join ', ')) }

Write-Output '---- PokeAPI item lookups ----'
foreach ($n in @(185,188,190,192,193,194,197,245,267,276,277,278,542,544,564,881)) {
  try {
    $it = Invoke-RestMethod -Uri "https://pokeapi.co/api/v2/item/$n" -TimeoutSec 20
    $en = ($it.names | Where-Object { $_.language.name -eq 'en' } | Select-Object -First 1).name
    $ja = ($it.names | Where-Object { $_.language.name -eq 'ja' } | Select-Object -First 1).name
    Write-Output ("POKEAPI {0}: en={1} ja={2}" -f $n, $en, $ja)
  } catch { Write-Output ("POKEAPI {0}: ERROR {1}" -f $n, $_.Exception.Message) }
}

Write-Output '---- CBD sprite checks ----'
foreach ($n in @('Chandelurite','Roseli Berry','Salamencite','Floettite','Barbaracite','Victreebelite')) {
  try {
    $u = "https://championsbattledata.com/pokemon_champions_assets/items/" + [uri]::EscapeDataString($n) + ".png"
    $r = Invoke-WebRequest -Uri $u -Method Head -TimeoutSec 20 -UseBasicParsing
    Write-Output ("CBDSPRITE {0}: {1}" -f $n, $r.StatusCode)
  } catch { Write-Output ("CBDSPRITE {0}: {1}" -f $n, $_.Exception.Message) }
}
