# Probe CBD numeric sprite URLs for Unknown Items + fetch Yakkun SV item list
$ids = 185,188,190,192,193,194,197,230,245,253,267,276,277,278,542,544,564,881
New-Item -ItemType Directory -Force .tmp-sprites | Out-Null
foreach ($n in $ids) {
  $u = "https://championsbattledata.com/pokemon_champions_assets/items/$n.png"
  curl.exe -f -s $u -o ".tmp-sprites/$n.png" 2>$null
  if (-not (Test-Path ".tmp-sprites/$n.png")) { Write-Output "CBD $n : NO SPRITE" }
}
Get-ChildItem .tmp-sprites | Select-Object Name,Length | Format-Table -AutoSize | Out-String
curl.exe -s -A 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' 'https://yakkun.com/sv/item_list.htm' -o .tmp-yakkun-items.html
if (Test-Path .tmp-yakkun-items.html) {
  $len = (Get-Item .tmp-yakkun-items.html).Length
  Write-Output "YAKKUN HTML SIZE: $len"
} else { Write-Output 'YAKKUN FETCH FAILED' }
