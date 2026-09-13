# AGENTS.md - Pokemon Champions Project

## Project Overview
Pokemon Champions Party Lab - a team builder for Pokemon Champions (ポケモンチャンピオンズ)
with user sync capabilities.

## Data Sources
- **Yakkun** (https://yakkun.com): Pokemon stats, abilities, moves, sprites
- **GameWith** (https://gamewith.jp): Item descriptions, recommended builds, sprite URLs
- **championsbattledata.com** (https://championsbattledata.com): Pokemon Champions battle data API (moves, items, abilities, natures, EVs, teammates)

## Commands

### Development
- `npm start` / `npm run dev` - Start static file server
- `npm test` - Run unit tests (jest)
- `npm run test:ui` - Run UI tests (playwright)
- `npm run test:ci` - Run all tests

### Data Scraping
- `npm run scrape:mc` - Scrape Pokemon/item data from GameWith into `data/gamewith-mc.json`
- `npm run fetch-icons` - Find and download missing item sprites into `images/items/`
- `node scripts/scrape-yakkun-champions.js` - Scrape Pokemon data from Yakkun into `data/pokemon-champions.json`
- `node scripts/scrape-pokedb-champions.ps1` - Scrape Pokemon usage data from pokedb.tokyo
- `node scripts/scrape-pokedb-teams.js` - Scrape top-ranked team builds from pokedb.tokyo into `data/pokedb-teams.js`
- `node scripts/merge-gamewith-moves.js` - Merge GameWith move data into Pokemon data

### Icon Fetching Workflow
When new items are added to `data/items-champions.js` with an empty `iconUrl`:
1. Ensure the item's GameWith article URL is in `ITEM_URLS` in `scripts/scrape-gamewith-mc.js`
2. Run `npm run fetch-icons` to automatically find and download sprites
3. The script updates `items-champions.js` with the `iconUrl` value

If an item is not in `ITEM_URLS`, the script attempts to find it via the GameWith item list page,
then falls back to Yakkun.

## File Structure
- `data/` - JSON/JS data files (pokemon, items, moves, pokedb teams)
- `scripts/` - Scraping and data processing scripts
- `images/items/` - Item sprite files (PNG)
- `images/pokemon/` - Pokemon sprite files (GIF)
- `tests/unit/` - Jest unit tests
- `tests/ui/` - Playwright UI tests

## Sprite Conventions
- Regular items: `images/items/i_item{number}.png` (from GameWith, same numbering as Yakkun SV)
- Mega stones: `images/items/i_item_m{number}.png`
- Item numbers follow Yakkun SV / GameWith numbering (not Yakkun CH numbers)

## Team Builds Screen
The index.html has a tab bar below the hero section with "パーティ構築" and "上位構築" tabs.
The "上位構築" tab shows season-specific top-ranked team builds from pokedb.tokyo.
The data is stored in `data/pokedb-teams.js` as `window.POKEDB_TEAMS_DATA`.

## Analytics Screen
The "データ分析" tab fetches live Pokemon battle data from championsbattledata.com API.
Users select a Pokemon and battle format (Singles/Doubles) to view:
- **技 (Moves)**: Top moves by usage %
- **持ち物 (Items)**: Top held items by usage %
- **特性 (Abilities)**: Ability usage %
- **性格 (Natures)**: Nature usage % with stat up/down effects
- **EV配分 (EV Spreads)**: Top EV distributions with individual stat values
- **相棋者 (Teammates)**: Pokemon that commonly appear on the same team

Data is fetched live from:
- Index: `https://championsbattledata.com/api` (Pokemon list with sprites/types)
- Battle: `https://championsbattledata.com/api/battle/{Singles|Doubles}/{showdownId}` (usage statistics)

To regenerate:
1. Run `node scripts/scrape-pokedb-teams.js` (requires Node.js)
2. If Node.js is unavailable, use the C# program in `C:\Users\admin\AppData\Local\Temp\kilo\temp_project`

## Coding Rules

### Login and Data Persistence
- The static server runs on port **3001** by default (set in `static-server.js`)
- API endpoints: `GET/POST /api/user/:userId` for user data persistence
- User data is stored in `os.homedir()/.pokemon-champions-data/users/` (local) or `os.tmpdir()/.pokemon-champions-data/users/` (Vercel)
- The `account` field contains the user's credentials hash
- Frontend helpers: `safeUserId()`, `userApiUrl()`, `fetchFromApi()`, `saveAllToServer()`, `loadAllFromServer()`
- Login status uses `#loginScreen` (not `#loginModalOverlay`) and `#logoutUser` button
- After successful login, user status shows as `ユーザー名：<username>`

### Analytics Search
- `#userStatus` shows `ユーザー名：<username>` when logged in, `オフライン` when offline
- Search uses `toHiragana()` to convert katakana to hiragana for matching
- The `pokemon` array comes from `window.POKEMON_DATA` (loaded from `data/pokemon-champions.js`)
- `.suggestion` elements are inside `#suggestions` container

### Testing
- Unit tests: `npm test` (Jest)
- UI tests: `npm run test:ui` (Playwright, requires server running on port 3001)
- UI test files should use `#loginScreen` (not `#loginModalOverlay`) for modal checks
- Use `Date.now()` in test usernames to avoid conflicts
