$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$outDir = Join-Path $root '.tmp-names'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# ---- sample showdownIds from CBD index API ----
$idx = Invoke-RestMethod -Uri 'https://championsbattledata.com/api' -TimeoutSec 180
$all = @($idx.pokemon)
Write-Output ('index pokemon entries: ' + $all.Count)
$sidSet = @{}
foreach ($p in $all) {
  $sid = $p.showdownId
  if (-not $sid -and -not $p.isForm) { $sid = $p.slug }
  if ($sid) { $sidSet[$sid] = 1 }
}
$sids = @($sidSet.Keys | Sort-Object)
Write-Output ('sample sids: ' + $sids.Count)
if ($sids.Count -gt 100) {
  $sampled = @()
  $step = $sids.Count / 100.0
  for ($i = 0; $i -lt 100; $i++) { $sampled += $sids[[int][math]::Floor($i * $step)] }
  $sids = $sampled
}

$sets = @{
  move = @{}; held_item = @{}; ability = @{}; stat_alignment = @{}; teammate = @{}
}
$unknown = @{}
$done = 0
foreach ($sid in $sids) {
  foreach ($fmt in @('Singles','Doubles')) {
    $url = "https://championsbattledata.com/api/battle/$fmt/$sid"
    $json = $null
    try { $json = Invoke-RestMethod -Uri $url -TimeoutSec 20 } catch { continue }
    foreach ($r in $json.rows) {
      $c = $r.category
      if ($c -eq 'stat_points') { continue }
      if ($sets.ContainsKey($c)) {
        if ($r.name) { $sets[$c][$r.name] = 1 }
      }
      if ($r.name -match '^Unknown Item') { $unknown[$r.name] = 1 }
    }
    $done++
  }
}
Write-Output ("fetched battle responses: " + $done)

# ---- extract map keys from index.html ----
$html = Get-Content -Raw -Encoding UTF8 'index.html'
function Get-MapKeys($html, $name) {
  $m = [regex]::Match($html, "const\s+$name\s*=\s*\{([\s\S]*?)\r?\n\s*\};")
  if (-not $m.Success) { return @() }
  $keys = @()
  foreach ($mm in [regex]::Matches($m.Groups[1].Value, "'((?:[^'\\]|\\.)*)'\s*:")) {
    $keys += ($mm.Groups[1].Value -replace '\\u2019', "'" -replace "\\'", "'")
  }
  return $keys
}
$itemKeys = Get-MapKeys $html 'ITEM_EN_TO_JA'
$moveKeys = Get-MapKeys $html 'MOVE_EN_TO_JA'
$abilKeys = Get-MapKeys $html 'ABILITY_EN_TO_JA'
$natKeys  = Get-MapKeys $html 'NATURE_EN_TO_JA'
$unkKeys  = Get-MapKeys $html 'UNKNOWN_ITEM_MAP'
Write-Output ("map sizes: item={0} move={1} ability={2} nature={3} unknown={4}" -f $itemKeys.Count, $moveKeys.Count, $abilKeys.Count, $natKeys.Count, $unkKeys.Count)

function Write-Diff($set, $mapKeys, $label) {
  $missing = @($set.Keys | Where-Object { $mapKeys -notcontains $_ } | Sort-Object)
  $missing | Set-Content -Encoding UTF8 (Join-Path $outDir ("missing-" + $label + ".txt"))
  Write-Output ("### MISSING {0}: {1}" -f $label, $missing.Count)
}
Write-Diff $sets['held_item'] ($itemKeys + $unkKeys) 'items'
Write-Diff $sets['move'] $moveKeys 'moves'
Write-Diff $sets['ability'] $abilKeys 'abilities'
Write-Diff $sets['stat_alignment'] $natKeys 'natures'

$sets['teammate'].Keys | Sort-Object | Out-File -Encoding UTF8 (Join-Path $outDir 'teammates.txt')
$unknown.Keys | Sort-Object | Out-File -Encoding UTF8 (Join-Path $outDir 'unknown-items.txt')
$sets['held_item'].Keys | Sort-Object | Out-File -Encoding UTF8 (Join-Path $outDir 'api-items.txt')
$sets['move'].Keys | Sort-Object | Out-File -Encoding UTF8 (Join-Path $outDir 'api-moves.txt')
$sets['ability'].Keys | Sort-Object | Out-File -Encoding UTF8 (Join-Path $outDir 'api-abilities.txt')
$sets['stat_alignment'].Keys | Sort-Object | Out-File -Encoding UTF8 (Join-Path $outDir 'api-natures.txt')
Write-Output ('counts: items=' + $sets['held_item'].Count + ' moves=' + $sets['move'].Count + ' abilities=' + $sets['ability'].Count + ' natures=' + $sets['stat_alignment'].Count + ' teammates=' + $sets['teammate'].Count + ' unknowns=' + $unknown.Count)
Write-Output 'DONE'
