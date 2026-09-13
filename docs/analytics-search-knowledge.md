# Analytics Search Knowledge Base

## Overview
The "データ分析" (Analytics) tab allows users to search for Pokemon by various input formats:
Pokemon showdownId, English name, Japanese name, hiragana, katakana, or romaji.

## Search Flow

### Entry Point
1. User clicks "データ分析" tab → `switchTab('analytics')`
2. `setupAnalyticsPokemonInput()` fetches Pokemon list from CBD API and populates datalist
3. User types in `#analyticsPokemonInput` and presses Enter or selects from dropdown
4. `getAnalyticsShowdownId()` resolves the input to a showdownId
5. `loadAnalyticsData()` fetches battle data from CBD API

### Data Sources
- **CBD API Index** (`https://championsbattledata.com/api`): Pokemon list with `showdownId` and English `name`
- **SHOWDOWN_TO_JA map** (`data/showdown-name-map.js`): Maps `showdownId` → Japanese name
- **Cached at**: `cbdPokemonCache` variable (set by `fetchCbdIndex()`)

## getAnalyticsShowdownId() Resolution Order

1. **byId**: Check if input matches a `showdownId` in cached API data
2. **byName**: Check if input matches an English `name` in cached API data (case-insensitive)
3. **jaMatch**: Check if input matches Japanese name (via cached API data)
4. **SHOWDOWN_TO_JA fallback**: If no API cache, search using the static name map

## Known Issues & Fixes

### Issue 1: Empty string match (startsWith("") returns true)
**Symptom**: Typing Japanese characters causes search to return the first Pokemon in the list.
**Root cause**: `romajiToKata()` returns `""` for Japanese input (characters not in the romaji table).
The condition `jaLower.startsWith(inputKata)` then becomes `startsWith("")`, which always returns `true`.
**Fix**: Added `inputKata &&` guard: `(inputKata && jaLower.startsWith(inputKata))`

### Issue 2: Search fails before API data loads
**Symptom**: User types in analytics tab before the CBD API index finishes loading.
**Root cause**: `cbdPokemonCache` is null, `getAnalyticsShowdownId()` returns raw input value
without any conversion.
**Fix**: Added fallback lookup using `window.SHOWDOWN_TO_JA` map (static JS, always available):
```javascript
const showdownIds = window.SHOWDOWN_TO_JA ? Object.keys(window.SHOWDOWN_TO_JA) : [];
for (const sid of showdownIds) {
  ...
}
```

### Issue 3: Deprecated substr() method
**Symptom**: Console warnings about deprecated `substr()` usage.
**Fix**: Replaced `r.substr(i, len)` with `r.slice(i, i + len)` in `romajiToKata()`.

## Search Matching Logic

### Input: showdownId (e.g., "tyrantrum")
- Matched by `byId` check (exact match against `p.showdownId`)

### Input: English name (e.g., "Tyrantrum")
- Matched by `byName` check (case-insensitive match against `p.name`)

### Input: Japanese name (e.g., "ガチゴラス", "ピカチュー")
- Matched by `jaLower.startsWith(inputLower)` (katakana match)
- Note: Long vowel mark "ー" is NOT converted by `kataToHira()`, but `startsWith` still works

### Input: Hiragana (e.g., "がち", "ぴか")
- Matched by `jaHira.startsWith(inputLower)` (hiragana match)
- `kataToHira()` converts katakana to hiragana by subtracting 0x60 from char code

### Input: Romaji (e.g., "ga", "pika", "gachigorasu")
- Matched by `jaLower.startsWith(inputKata)` where `inputKata = romajiToKata(inputLower)`
- `romajiToKata()` converts romaji to katakana using a lookup table
- Greedy matching: tries 4-char segments first, then 3, 2, 1

## romajiToKata() Table

Multi-character entries (longest match first):
- 3-char: kyo, shu, sho, cho, chu, cha, nyo, nyu, nya, ryo, ryu, rya, gyo, gyu, gya, byo, byu, bya, pyo, pyu, pya, kyu, kya
- 2-char: ka, ki, ku, ke, ko, sa, shi, su, se, so, ta, chi, tsu, te, to, na, ni, nu, ne, no, ha, hi, fu, he, ho, ma, mi, mu, me, mo, ya, yu, yo, ra, ri, ru, re, ro, wa, wo, n, ga, gi, gu, ge, go, za, ji, zu, ze, zo, da, de, do, ba, bi, bu, be, bo, pa, pi, pu, pe, po, fa, fi, fe, fo, va, vi, ve, vo
- 1-char: a, i, u, e, o

## kataToHira() Regex

Covers: U+30A1–U+30FA, U+30FE, U+30FF
Does NOT convert: U+30FC (ー long vowel mark)
This means hiragana input like "ぴかちゅー" won't have the "ー" converted, but matching still works via `startsWith`.
