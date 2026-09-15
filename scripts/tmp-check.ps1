$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$urls = [ordered]@{
  'Leftovers'    = 'https://championsbattledata.com/pokemon_champions_assets/items/Leftovers.png'
  'ExpertBelt'   = 'https://championsbattledata.com/pokemon_champions_assets/items/Expert%20Belt.png'
  'Abomasite'    = 'https://championsbattledata.com/pokemon_champions_assets/items/Abomasite.png'
  'RoseliBerry'  = 'https://championsbattledata.com/pokemon_champions_assets/items/Roseli%20Berry.png'
  'BabiriBerry'  = 'https://championsbattledata.com/pokemon_champions_assets/items/Babiri%20Berry.png'
  'Froslassite'  = 'https://championsbattledata.com/pokemon_champions_assets/items/Froslassite.png'
  'UnknownItem542Raw' = 'https://championsbattledata.com/pokemon_champions_assets/items/Unknown%20Item%20542.png'
}
foreach ($k in $urls.Keys) {
  $code = 'ERR'
  try { $resp = Invoke-WebRequest -Uri $urls[$k] -Method Head -TimeoutSec 15 -UseBasicParsing; $code = $resp.StatusCode } catch { if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode } else { $code = $_.Exception.Message } }
  Write-Output ("{0}: {1}" -f $k, $code)
}
# CBD API index: does it expose item sprites list?
try {
  $idx = Invoke-RestMethod -Uri 'https://championsbattledata.com/api' -TimeoutSec 120
  Write-Output ('top-level keys: ' + (($idx.PSObject.Properties.Name) -join ', '))
  if ($idx.items) { Write-Output ('idx.items count: ' + @($idx.items).Count); Write-Output ('idx.items[0]: ' + ($idx.items[0] | ConvertTo-Json -Compress -Depth 3)) }
  if ($idx.itemSprites) { Write-Output ('idx.itemSprites: ' + ($idx.itemSprites | ConvertTo-Json -Compress -Depth 2)) }
} catch { Write-Output ('index fetch failed: ' + $_.Exception.Message) }
Write-Output 'DONE'

$start = $raw.IndexOf('{')
$json = $raw.Substring($start).TrimEnd()
if ($json.EndsWith(';')) { $json = $json.Substring(0, $json.Length - 1) }
$d = $json | ConvertFrom-Json
Write-Output ('TOTAL ITEMS: ' + $d.items.Count)
# dump all item name/iconUrl pairs to a UTF8 file (no console encoding issues)
$lines = foreach ($it in $d.items) { '{0}|{1}' -f $it.name, $it.iconUrl }
$lines | Set-Content -Encoding UTF8 (Join-Path $outDir 'all-items.txt')

Write-Output '=== icon files ==='
Write-Output ('icon total: ' + (Get-ChildItem images/items -Filter *.png).Count)
$names = Get-ChildItem images/items -Name
# berries in yakkun numbering live around 500-560 per prior assumption; test a range
$have = @()
foreach ($i in 500..560) { if ($names -contains ('i_item' + $i + '.png')) { $have += $i } }
Write-Output ('berry-range icon files present (500-560): ' + ($have -join ','))
foreach ($i in @(276,542)) { Write-Output ('i_item' + $i + '.png exists: ' + ($names -contains ('i_item' + $i + '.png'))) }
Write-Output 'DONE'
