# One-off audit helper: translate missing EN names -> official JA via PokeAPI (GraphQL, REST fallback)
# and resolve "Unknown Item NNN" -> local JA name/icon from data/items-champions.js (GameWith numbering).
$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = 'C:/Users/admin/Desktop/pokemon'
$namesDir = Join-Path $root '.tmp-names'

function Read-NameList([string]$file) {
  Get-Content (Join-Path $namesDir $file) | ForEach-Object { ($_ -replace "`uFEFF", '').Trim() } | Where-Object { $_ }
}

# ---- 1. Unknown Item NNN -> local JA name + local icon path (by GameWith item number) ----
$itemsRaw = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'data/items-champions.js')
$rx = '(?s)"name":\s*"([^"]+)",\s*"iconUrl":\s*"images/items/(i_item(?:_m)?\d+)\.png"'
$numToJa = @{}
$numToIcon = @{}
foreach ($m in [regex]::Matches($itemsRaw, $rx)) {
  $num = $m.Groups[2].Value -replace '^i_item(?:_m)?', ''
  if (-not $numToJa.ContainsKey($num)) {
    $numToJa[$num] = $m.Groups[1].Value
    $numToIcon[$num] = 'images/items/' + $m.Groups[2].Value + '.png'
  }
}
$unkOut = @(); $unkIconOut = @()
foreach ($u in (Read-NameList 'unknown-items.txt')) {
  if ($u -match 'Unknown Item (\d+)') {
    $n = $Matches[1]
    if ($numToJa.ContainsKey($n)) {
      $unkOut += ("$u`t" + $numToJa[$n])
      $unkIconOut += ("$u`t" + $numToIcon[$n])
    } else {
      $unkOut += ("$u`tUNRESOLVED")
      Write-Output ("UNKNOWN_UNRESOLVED " + $u)
    }
  }
}
$unkOut | Set-Content -Encoding UTF8 (Join-Path $namesDir 'ja-unknown.txt')
$unkIconOut | Set-Content -Encoding UTF8 (Join-Path $namesDir 'icon-unknown.txt')
foreach ($line in $unkIconOut) {
  $p = Join-Path $root (($line -split "`t")[1])
  if (-not (Test-Path $p)) { Write-Output ("MISSING_ICON " + $line) }
}
Write-Output ("UNKNOWN_RESOLVED " + $unkOut.Count + "/" + (Read-NameList 'unknown-items.txt').Count)

# ---- 2. PokeAPI translate helpers ----
function Slugify([string]$s) {
  $t = $s.ToLower() -replace "[\u2019']", '' -replace '[^a-z0-9\-]', '-'
  return ($t -replace '-+', '-' -replace '^-', '' -replace '-$', '')
}
function Invoke-Gql([string]$query) {
  $body = @{ query = $query } | ConvertTo-Json -Depth 5 -Compress
  return Invoke-RestMethod -Uri 'https://graphql.pokeapi.co/v1beta2' -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 60
}

function Translate-List([string]$file, [string]$gqlType, [string]$gqlNameField, [string]$restName, [string]$outFile) {
  $names = @(Read-NameList $file | Where-Object { $_ -notmatch '^Unknown Item' })
  $result = @{}
  $chunkSize = 60
  for ($i = 0; $i -lt $names.Count; $i += $chunkSize) {
    $end = [Math]::Min($i + $chunkSize - 1, $names.Count - 1)
    $slugList = (($names[$i..$end] | ForEach-Object { '"' + (Slugify $_) + '"' }) -join ',')
    $q = "{ ${gqlType}(where: {name: {_in: [$slugList]}}) { name ${gqlNameField}(where: {language_id: {_eq: 11}}) { name } } }"
    try {
      $resp = Invoke-Gql $q
      $list = $resp.data.$gqlType
      foreach ($obj in $list) {
        if ($obj.$gqlNameField -and $obj.$gqlNameField.Count -gt 0) { $result[$obj.name] = $obj.$gqlNameField[0].name }
      }
    } catch { Write-Output ("GQL_ERR " + $file + " chunk@" + $i + ": " + $_.Exception.Message) }
    Start-Sleep -Milliseconds 250
  }
  # REST fallback for leftovers
  $leftovers = @($names | Where-Object { -not $result.ContainsKey((Slugify $_)) })
  foreach ($n in $leftovers) {
    $slug = Slugify $n
    try {
      $r = Invoke-RestMethod -Uri ("https://pokeapi.co/api/v2/" + $restName + "/" + $slug) -TimeoutSec 30
      $ja = ($r.names | Where-Object { $_.language.name -eq 'ja' } | Select-Object -First 1).name
      if (-not $ja) { $ja = ($r.names | Where-Object { $_.language.name -eq 'ja-Hrkt' } | Select-Object -First 1).name }
      if ($ja) { $result[$slug] = $ja } else { Write-Output ("NO_JA " + $n) }
    } catch { Write-Output ("REST_ERR " + $n + " (" + $slug + ")") }
    Start-Sleep -Milliseconds 120
  }
  $out = @()
  foreach ($n in $names) {
    $slug = Slugify $n
    if ($result.ContainsKey($slug)) { $out += ($n + "`t" + $result[$slug]) } else { $out += ($n + "`tUNTRANSLATED") }
  }
  $out | Set-Content -Encoding UTF8 (Join-Path $namesDir $outFile)
  $okCount = @($out | Where-Object { $_ -notmatch 'UNTRANSLATED' }).Count
  Write-Output ("DONE " + $outFile + " total=" + $names.Count + " ok=" + $okCount)
}

Translate-List 'missing-items.txt' 'pokemon_v2_item' 'pokemon_v2_itemnames' 'item' 'ja-items.txt'
Translate-List 'missing-abilities.txt' 'pokemon_v2_ability' 'pokemon_v2_abilitynames' 'ability' 'ja-abilities.txt'
Translate-List 'missing-moves.txt' 'pokemon_v2_move' 'pokemon_v2_movenames' 'move' 'ja-moves.txt'
Write-Output 'ALL_DONE'
