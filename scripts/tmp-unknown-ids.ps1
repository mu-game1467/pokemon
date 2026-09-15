# Resolve CBD "Unknown Item NNN" ids via PokeAPI item ids (validate: 276=Expert Belt, 542=Roseli Berry)
$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ids = @(185,188,190,192,193,194,197,230,245,253,267,276,277,278,542,544,564,881)
$idList = ($ids | ForEach-Object { "$_" }) -join ','
$q = "{ pokemon_v2_item(where: {id: {_in: [$idList]}}) { id name pokemon_v2_itemnames(where: {language_id: {_eq: 11}}) { name } } }"
$body = @{ query = $q } | ConvertTo-Json -Depth 5 -Compress
try {
  $resp = Invoke-RestMethod -Uri 'https://graphql.pokeapi.co/v1beta2' -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 60
  $out = @()
  foreach ($it in $resp.data.pokemon_v2_item) {
    $ja = ($it.pokemon_v2_itemnames | Select-Object -First 1).name
    if (-not $ja) { $ja = 'NO_JA' }
    $out += ("Unknown Item " + $it.id + "`t" + $it.name + "`t" + $ja)
  }
  $out += ("RETURNED " + $resp.data.pokemon_v2_item.Count + "/" + $ids.Count)
  $out | Set-Content -Encoding UTF8 'C:/Users/admin/Desktop/pokemon/.tmp-names/unknown-pokeapi.txt'
  Write-Output ('OK ' + $resp.data.pokemon_v2_item.Count)
} catch {
  Write-Output ('ERR ' + $_.Exception.Message)
}
