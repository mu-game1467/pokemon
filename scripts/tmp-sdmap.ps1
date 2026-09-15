$ErrorActionPreference = 'Stop'
$sf = Join-Path $PSScriptRoot '..\.tmp-showdown-items.ts'
$nums = Get-Content (Join-Path $PSScriptRoot '..\.tmp-names\unknown-items.txt') -Encoding UTF8 |
  ForEach-Object { if ($_ -match '(\d+)') { [int]$Matches[1] } } | Select-Object -Unique
$found = @{}
$entry = ''; $name = ''
foreach ($line in [System.IO.File]::ReadLines($sf)) {
  if ($line -match '^([A-Za-z0-9_]+): \{') { $entry = $Matches[1]; $name = '' }
  elseif ($line -match '^\s+name: "([^"]+)"') { $name = $Matches[1] }
  elseif ($line -match '^\s+num: (\d+),\s*$') {
    $n = [int]$Matches[1]
    if (-not $found.ContainsKey($n)) { $found[$n] = @{ name = $name; entry = $entry; line = '' } }
  }
}
foreach ($n in $nums) {
  if ($found.ContainsKey($n)) { $v = $found[$n]; Write-Output ("NUM {0} => {1} (entry: {2})" -f $n, $v.name, $v.entry) }
  else { Write-Output ("NUM {0} => NOT FOUND" -f $n) }
}
