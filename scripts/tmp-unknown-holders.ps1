$ErrorActionPreference = 'Continue'
Set-Location 'C:/Users/admin/Desktop/pokemon'
$base = 'https://championsbattledata.com/api'
$out = '.tmp-unknown-holders.log'
"start $(Get-Date -Format o)" | Out-File $out -Encoding utf8
$idx = Invoke-RestMethod -Uri $base -TimeoutSec 90
$mons = @($idx.pokemon | Where-Object { $_.showdownId })
"pokemon count: $($mons.Count)" | Out-File $out -Append -Encoding utf8
$holders = @{}
$i = 0
foreach ($m in $mons) {
  $i++
  foreach ($fmt in @('Singles','Doubles')) {
    $url = "$base/battle/$fmt/$($m.showdownId)"
    try {
      $b = Invoke-RestMethod -Uri $url -TimeoutSec 30
      foreach ($r in $b.rows) {
        if ($r.category -eq 'held_item' -and $r.name -like 'Unknown Item*') {
          $k = $r.name
          if (-not $holders.ContainsKey($k)) { $holders[$k] = @{} }
          $pct = 0
          if ($r.percentage_value) { $pct = [double]$r.percentage_value }
          $prev = 0
          if ($holders[$k].ContainsKey($m.name)) { $prev = [double]$holders[$k][$m.name] }
          if ($pct -gt $prev) { $holders[$k][$m.name] = $pct }
        }
      }
    } catch {
      "ERR $url : $($_.Exception.Message)" | Out-File $out -Append -Encoding utf8
    }
  }
  if ($i % 50 -eq 0) { "progress $i/$($mons.Count)" | Out-File $out -Append -Encoding utf8 }
}
"=== UNKNOWN ITEM HOLDERS (pokemon:maxpct) ===" | Out-File $out -Append -Encoding utf8
foreach ($k in ($holders.Keys | Sort-Object)) {
  $line = ($holders[$k].GetEnumerator() | Sort-Object { [double]$_.Value } -Descending | ForEach-Object { "{0}:{1}%" -f $_.Key, $_.Value }) -join ', '
  "$k => $line" | Out-File $out -Append -Encoding utf8
}
"done $(Get-Date -Format o)" | Out-File $out -Append -Encoding utf8
