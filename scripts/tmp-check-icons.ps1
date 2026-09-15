$ErrorActionPreference = 'Continue'
Set-Location 'C:\Users\admin\Desktop\pokemon'
Write-Output '== GIT =='
git --no-pager log --oneline -3
git --no-pager status --short

Write-Output '== ITEM ICON FILES (i_item90..i_item110) =='
Get-ChildItem images\items -File | Where-Object { $_.Name -match '^i_item(9[0-9]|10[0-9]|110)\.png$' } | Sort-Object Name | ForEach-Object { Write-Output $_.Name }

Write-Output '== BERRY ENTRIES IN items-champions.js =='
$lines = Get-Content data\items-champions.js -Encoding UTF8
for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($lines[$i] -match '"category": "きのみ"') {
    $nm = ''
    $ic = ''
    for ($j = $i; $j -ge $i - 5; $j--) { if ($lines[$j] -match '"name": "(.+)"') { $nm = $Matches[1]; break } }
    for ($j = $i; $j -le $i + 3; $j++) { if ($j -lt $lines.Count -and $lines[$j] -match '"iconUrl": "(.+)"') { $ic = $Matches[1]; break } }
    $exists = if ($ic) { Test-Path $ic } else { $false }
    Write-Output ("{0} | {1} | exists={2}" -f $nm, $ic, $exists)
  }
}

Write-Output '== MEGA STONE ENTRIES =='
for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($lines[$i] -match 'ナイト' -and $lines[$i] -match '"name"') {
    $nm = $Matches[1]
    $ic = ''
    for ($j = $i; $j -le $i + 3; $j++) { if ($j -lt $lines.Count -and $lines[$j] -match '"iconUrl": "(.+)"') { $ic = $Matches[1]; break } }
    $exists = if ($ic) { Test-Path $ic } else { $false }
    Write-Output ("{0} | {1} | exists={2}" -f $nm, $ic, $exists)
  }
}

Write-Output '== ALL ITEM ICON EXISTENCE CHECK =='
for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($lines[$i] -match '"name": "(.+)"') {
    $nm = $Matches[1]
    $ic = ''
    for ($j = $i; $j -le $i + 3 -and $j -lt $lines.Count; $j++) { if ($lines[$j] -match '"iconUrl": "(.+)"') { $ic = $Matches[1]; break } }
    if ($ic -and -not (Test-Path $ic)) { Write-Output ("MISSING: {0} -> {1}" -f $nm, $ic) }
  }
}
Write-Output '== DONE =='
