param([int]$Limit = 0, [switch]$Resume)

$ErrorActionPreference = 'Stop'
$baseUrl = 'https://champs.pokedb.tokyo'
$listUrl = "$baseUrl/pokemon/list?season=5&rule=0"
$output = Join-Path $PSScriptRoot '..\data\pokedb-champions-m5.json'
$headers = @{ 'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0 Safari/537.36'; 'Accept-Language' = 'ja-JP,ja;q=0.9' }

function Get-Page([string]$Url) {
  $response = Invoke-WebRequest -Uri $Url -Headers $headers -UseBasicParsing -TimeoutSec 30
  if ($response.RawContentStream) { return [Text.Encoding]::UTF8.GetString($response.RawContentStream.ToArray()) }
  return $response.Content
}

function Clean([string]$Value) {
  if ($null -eq $Value) { return '' }
  ($Value -replace '<[^>]*>', ' ' -replace '&nbsp;|&#160;', ' ' -replace '&amp;', '&' -replace '\s+', ' ').Trim()
}

$indexHtml = Get-Page $listUrl
$records = [ordered]@{}
foreach ($match in [regex]::Matches($indexHtml, '<a\s+href="/pokemon/show/(\d{4}-\d{2})[^\"]*"[^>]*>([\s\S]*?)</a>', 'IgnoreCase')) {
  $id = $match.Groups[1].Value
  if ($records.Contains($id)) { continue }
  $name = (Clean $match.Groups[2].Value) -replace '^\d+\s+', ''
  if (-not $name -or $name -match '^\d+$') { continue }
  $records[$id] = [ordered]@{ id=$id; name=$name; pageUrl="$baseUrl/pokemon/show/${id}?season=M-5&format=single"; iconUrl=""; types=@(); abilities=@(); baseStats=$null; moves=@() }
}
$items = @($records.Values)
if ($Resume -and (Test-Path $output)) {
  $saved = Get-Content $output -Raw | ConvertFrom-Json
  $savedById = @{}
  foreach ($entry in $saved.pokemon) { $savedById[$entry.id] = $entry }
  foreach ($record in $items) {
    if ($savedById.ContainsKey($record.id)) {
      $savedEntry = $savedById[$record.id]
      $record.name = $savedEntry.name
      $record.iconUrl = $savedEntry.iconUrl
      $record.types = $savedEntry.types
      $record.abilities = $savedEntry.abilities
      $record.baseStats = $savedEntry.baseStats
      $record.moves = $savedEntry.moves
    }
  }
}
if ($Limit -gt 0) { $items = @($items | Select-Object -First $Limit) }
Write-Host "Found $($items.Count) M-5 single battle entries"

$index = 0
foreach ($record in $items) {
  $index++
  try {
    $html = Get-Page $record.pageUrl
    $record.iconUrl = "https://s3-ap-northeast-1.amazonaws.com/pokedb.tokyo/champs/assets/pokemon/icons_128/pokemon-$($record.id).webp"
    $payload = [regex]::Match($html, 'x-data="pokemonShowBasis\(([\s\S]*?)\)"')
    if ($payload.Success) {
      $detail = (($payload.Groups[1].Value -replace '&quot;', '"') -replace '&amp;', '&') | ConvertFrom-Json
      $form = $detail.forms.PSObject.Properties | Where-Object { $_.Name -eq $record.id } | Select-Object -First 1
      if ($form) {
        $record.types = @($form.Value.types.name)
        $record.abilities = @($form.Value.abilities.name)
        $stats = $form.Value.stats
        $record.baseStats = [ordered]@{ hp=[int]$stats.hp.base; attack=[int]$stats.attack.base; defense=[int]$stats.defense.base; specialAttack=[int]$stats.sp_attack.base; specialDefense=[int]$stats.sp_defense.base; speed=[int]$stats.speed.base }
      }
    }
    $record.moves = @([regex]::Matches($html, 'data-move-detail="[^"]*?name&quot;:&quot;([^&]+).*?rate&quot;:([\d.]+)', 'IgnoreCase') | ForEach-Object { [ordered]@{ name=(Clean $_.Groups[1].Value); usageRate=[double]$_.Groups[2].Value } })
  } catch { Write-Warning "Skipped $($record.id): $($_.Exception.Message)" }
  if (($index % 25) -eq 0) { Write-Host "$index/$($items.Count)" }
}

$result = [ordered]@{ source=$listUrl; season='M-5'; rule='single'; fetchedAt=(Get-Date).ToUniversalTime().ToString('o'); count=$items.Count; pokemon=$items }
New-Item -ItemType Directory -Force -Path (Split-Path $output) | Out-Null
$result | ConvertTo-Json -Depth 8 | Set-Content -Path $output -Encoding UTF8
Write-Host "Saved $($items.Count) entries to $output"