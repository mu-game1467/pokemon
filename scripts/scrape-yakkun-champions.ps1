param([int]$Limit = 0, [switch]$MissingOnly, [switch]$FilterExisting)

$ErrorActionPreference = 'Stop'
$baseUrl = 'https://yakkun.com'
$output = Join-Path $PSScriptRoot '..\data\pokemon-champions.json'
$headers = @{ 'User-Agent' = 'AI_pokemon local data collector' }

function Get-Page([string]$Url) {
  for ($attempt = 1; $attempt -le 4; $attempt++) {
    try {
      $response = Invoke-WebRequest -Uri $Url -Headers $headers -UseBasicParsing
      return [Text.Encoding]::GetEncoding(51932).GetString($response.RawContentStream.ToArray())
    } catch {
      if ($attempt -eq 4) { throw }
      Start-Sleep -Seconds (15 * $attempt)
    }
  }
}

function Clean([string]$Value) {
  if ($null -eq $Value) { return '' }
  ($Value -replace '<[^>]*>', ' ' -replace '&nbsp;|&#160;', ' ' -replace '&amp;', '&' -replace '\s+', ' ').Trim()
}

function Unique([string[]]$Values) {
  @($Values | ForEach-Object { Clean $_ } | Where-Object { $_ } | Select-Object -Unique)
}

Write-Host "Fetching $baseUrl/ch/zukan/"
$indexHtml = Get-Page "$baseUrl/ch/zukan/"
$records = [ordered]@{}
$linkMatches = [regex]::Matches($indexHtml, '<a\s+href="/ch/zukan/(n[0-9a-z]+)"[^>]*>([\s\S]*?)</a>', 'IgnoreCase')
foreach ($match in $linkMatches) {
  $id = $match.Groups[1].Value.ToLowerInvariant()
  if ($records.Contains($id)) { continue }
  $name = Clean $match.Groups[2].Value
  $start = $indexHtml.LastIndexOf('<li', $match.Index)
  $end = $indexHtml.IndexOf('</li>', $match.Index)
  if ($start -lt 0) { $start = $match.Index }
  if ($end -lt 0) { $end = [Math]::Min($indexHtml.Length, $match.Index + 1800) }
  $row = $indexHtml.Substring($start, $end - $start)
  if ($row -match '<li[^>]*class="[^"]*nodata') { continue }
  $plainRow = Clean $row
  $statMatch = [regex]::Match($plainRow, '(\d+)\s*-\s*(\d+)\s*-\s*(\d+)\s*-\s*(\d+)\s*-\s*(\d+)\s*-\s*(\d+)')
  $typeMatches = [regex]::Matches($row, '<img[^>]+src="[^"]*xy_type[^>]+"[^>]+alt="([^"]+)"', 'IgnoreCase')
  $types = @($typeMatches | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique)
  $stats = $null
  if ($statMatch.Success) { $stats = [ordered]@{ hp=[int]$statMatch.Groups[1].Value; attack=[int]$statMatch.Groups[2].Value; defense=[int]$statMatch.Groups[3].Value; specialAttack=[int]$statMatch.Groups[4].Value; specialDefense=[int]$statMatch.Groups[5].Value; speed=[int]$statMatch.Groups[6].Value } }
  $records[$id] = [ordered]@{ id=$id; name=$name; pageUrl="$baseUrl/ch/zukan/$id"; iconUrl="https://img.yakkun.com/poke/icon96/$id.gif"; types=$types; abilities=@(); baseStats=$stats; moves=@() }
}
$items = @($records.Values)
if ($Limit -gt 0) { $items = @($items | Select-Object -First $Limit) }
if ($FilterExisting -and (Test-Path $output)) {
  $saved = Get-Content $output -Raw | ConvertFrom-Json
  $allowed = @{}
  foreach ($entry in $items) { $allowed[$entry.id] = $true }
  $items = @($saved.pokemon | Where-Object { $allowed.ContainsKey($_.id) })
  $result = [ordered]@{ source="$baseUrl/ch/zukan/#mode=has_data"; fetchedAt=(Get-Date).ToUniversalTime().ToString('o'); count=$items.Count; pokemon=$items }
  $result | ConvertTo-Json -Depth 8 | Set-Content -Path $output -Encoding UTF8
  Write-Host "Filtered saved data to $($items.Count) Champions entries"
  exit
}
if ($MissingOnly -and (Test-Path $output)) {
  $saved = Get-Content $output -Raw | ConvertFrom-Json
  $savedById = @{}
  foreach ($entry in $saved.pokemon) { $savedById[$entry.id] = $entry }
  $items = @($items | Where-Object { -not $savedById.ContainsKey($_.id) -or $_.moves.Count -eq 0 -or $_.abilities.Count -eq 0 } | ForEach-Object {
    if ($savedById.ContainsKey($_.id)) {
      $savedEntry = $savedById[$_.id]
      $_.baseStats = $savedEntry.baseStats
      $_.types = $savedEntry.types
    }
    $_
  })
}
Write-Host "Found $($items.Count) Champions entries"

$index = 0
foreach ($record in $items) {
  $index++
  try {
    $html = Get-Page $record.pageUrl
    $moveHtml = $html
    $moves = @([regex]::Matches($moveHtml, 'class="move_main_row[^"]*"[\s\S]*?<div class="move_name"[^>]*>\s*<a[^>]*>([^<]+)</a>', 'IgnoreCase') | ForEach-Object { Clean $_.Groups[1].Value } | Select-Object -Unique)
    $abilityHtml = $html
    $abilities = @()
    if ($abilityHtml) { $abilities = @([regex]::Matches($abilityHtml, 'href="[^"]*tokusei=[^"]+"[^>]*>\s*([^<]+?)\s*</a>', 'IgnoreCase') | ForEach-Object { Clean $_.Groups[1].Value } | Select-Object -Unique | Select-Object -First 3) }
    $record.moves = $moves
    $record.abilities = $abilities
  } catch { Write-Warning "Skipped $($record.id): $($_.Exception.Message)" }
  if (($index % 25) -eq 0) { Write-Host "$index/$($items.Count)" }
}

$allItems = $items
if ($MissingOnly -and (Test-Path $output)) {
  $previous = Get-Content $output -Raw | ConvertFrom-Json
  $updatedById = @{}
  foreach ($entry in $allItems) { $updatedById[$entry.id] = $entry }
  $allItems = @($previous.pokemon | ForEach-Object { if ($updatedById.ContainsKey($_.id)) { $updatedById[$_.id] } else { $_ } })
}
$result = [ordered]@{ source="$baseUrl/ch/zukan/"; fetchedAt=(Get-Date).ToUniversalTime().ToString('o'); count=$allItems.Count; pokemon=$allItems }
$directory = Split-Path $output
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$result | ConvertTo-Json -Depth 8 | Set-Content -Path $output -Encoding UTF8
Write-Host "Saved $($allItems.Count) entries to $output"