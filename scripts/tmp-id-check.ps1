$ErrorActionPreference = 'Continue'
Set-Location 'C:/Users/admin/Desktop/pokemon'
$out = '.tmp-id-check.log'
"start $(Get-Date -Format o)" | Out-File $out -Encoding utf8

# PokeAPI item ids by number (CBD Unknown Item numbers)
$ids = 185,188,190,192,193,194,197,230,245,253,267,276,277,278,542,544,564,881
foreach ($i in $ids) {
  try {
    $it = Invoke-RestMethod -Uri "https://pokeapi.co/api/v2/item/$i" -TimeoutSec 30
    $en = $it.name
    $ja = ($it.names | Where-Object { $_.language.name -eq 'ja' } | Select-Object -First 1).name
    $jaH = ($it.names | Where-Object { $_.language.name -eq 'ja-Hrkt' } | Select-Object -First 1).name
    "id=$i en=$en ja=$ja jaHrkt=$jaH" | Out-File $out -Append -Encoding utf8
  } catch {
    "id=$i ERR $($_.Exception.Message)" | Out-File $out -Append -Encoding utf8
  }
}

# by-name ids for anchors
foreach ($n in 'roseli-berry','chandelurite','salamencite','floettite','poison-barb','expert-belt','iron-ball','leek','barbaracite') {
  try {
    $it = Invoke-RestMethod -Uri "https://pokeapi.co/api/v2/item/$n" -TimeoutSec 30
    "name=$n id=$($it.id)" | Out-File $out -Append -Encoding utf8
  } catch { "name=$n ERR" | Out-File $out -Append -Encoding utf8 }
}

# CBD holders for key pokemon (evidence for 542/253)
$base = 'https://championsbattledata.com/api'
foreach ($sid in 'clefable','klefki','chandelure','mawile') {
  foreach ($fmt in 'Singles','Doubles') {
    try {
      $b = Invoke-RestMethod -Uri "$base/battle/$fmt/$sid" -TimeoutSec 30
      $rows = $b.rows | Where-Object { $_.category -eq 'held_item' } | ForEach-Object { "{0} {1}" -f $_.name, $_.percentage }
      "HOLDERS $fmt/$sid => $($rows -join ', ')" | Out-File $out -Append -Encoding utf8
    } catch { "HOLDERS $fmt/$sid ERR $($_.Exception.Message)" | Out-File $out -Append -Encoding utf8 }
  }
}
"done $(Get-Date -Format o)" | Out-File $out -Append -Encoding utf8
