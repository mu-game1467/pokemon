$ErrorActionPreference = 'Stop'
$dir = Join-Path $PSScriptRoot '..\.tmp-names'
function Load-Map($file) {
  $map = @{}
  if (Test-Path $file) {
    foreach ($line in Get-Content $file -Encoding UTF8) {
      $t = $line.Trim()
      if (-not $t) { continue }
      $parts = $t -split '\|'
      if ($parts.Count -lt 2) { $parts = $t -split "`t" }
      if ($parts.Count -ge 2) {
        $a = $parts[0].Trim(); $b = $parts[1].Trim()
        # orientation auto-detect: JA side has CJK/kana
        if ($a -match '[\u4E00-\u9FFF\u3040-\u30FF]') { $ja = $a; $en = $b } else { $en = $a; $ja = $b }
        if ($en -and $ja -and -not $map.ContainsKey($en)) { $map[$en] = $ja }
      }
    }
  }
  return $map
}
foreach ($cat in @('items','abilities','moves')) {
  $missingFile = Join-Path $dir ("missing-{0}.txt" -f $cat)
  $jaFile = Join-Path $dir ("ja-{0}.txt" -f $cat)
  $patchFile = Join-Path $dir ("patch-{0}.txt" -f $cat)
  $unresFile = Join-Path $dir ("unres-{0}.txt" -f $cat)
  $missing = @()
  if (Test-Path $missingFile) { $missing = Get-Content $missingFile -Encoding UTF8 | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Select-Object -Unique }
  $ja = Load-Map $jaFile
  $lines = New-Object System.Collections.Generic.List[string]
  $unres = New-Object System.Collections.Generic.List[string]
  foreach ($en in $missing) {
    if ($ja.ContainsKey($en)) { $lines.Add(("      '{0}':'{1}'," -f ($en -replace "'", "\''"), $ja[$en])) }
    else { $unres.Add($en) }
  }
  $lines | Set-Content -Path $patchFile -Encoding UTF8
  $unres | Set-Content -Path $unresFile -Encoding UTF8
  Write-Output ("{0}: missing={1} resolved={2} unresolved={3}" -f $cat, $missing.Count, $lines.Count, $unres.Count)
  Write-Output ("  sample: " + (($lines | Select-Object -First 3) -join ' / '))
}