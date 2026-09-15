# Parse Showdown items.ts -> num -> name mapping (name: is first field of each entry)
$ErrorActionPreference = 'Stop'
$src = 'C:/Users/admin/Desktop/pokemon/.tmp-showdown-items.ts'
$lines = Get-Content $src
$map = @{}
$name = $null
foreach ($ln in $lines) {
  if ($ln -match '^\s+name:\s*"([^"]+)"') { $name = $Matches[1]; continue }
  if ($ln -match '^\s*num:\s*(\d+)' -and $name) { $map[[int]$Matches[1]] = $name; $name = $null }
}
Write-Output ("PARSED " + $map.Count + " entries with num")
$targets = @()
Get-Content 'C:/Users/admin/Desktop/pokemon/.tmp-names/unknown-items.txt' -ErrorAction SilentlyContinue | ForEach-Object {
  if ($_ -match 'Unknown Item\s+(\d+)') { $targets += [int]$Matches[1] }
}
$targets = $targets | Sort-Object -Unique
Write-Output ("TARGETS: " + ($targets -join ','))
foreach ($t in $targets) {
  $n = '(NOT-IN-SHOWDOWN-NUM-MAP)'
  if ($map.ContainsKey($t)) { $n = $map[$t] }
  Write-Output ("Unknown Item {0} => {1}" -f $t, $n)
}
$map.GetEnumerator() | Sort-Object {[int]$_.Key} | ForEach-Object { "NUMDUMP`t{0}`t{1}" -f $_.Key, $_.Value } | Out-File 'C:/Users/admin/Desktop/pokemon/.tmp-showdown-nums.txt' -Encoding UTF8
Write-Output 'DONE'