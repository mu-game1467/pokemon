# Fetch Missing Item Icons

Automatically finds and downloads sprites for Pokemon Champions items that are missing `iconUrl` values in `data/items-champions.js`.

## When to use

- After adding new items to `data/items-champions.js` with empty `iconUrl`
- When new items are added to the game and need sprites
- Before committing changes to ensure no icon URLs are broken

## How to run

```bash
npm run fetch-icons
```

## How it works

1. Reads `data/items-champions.js` and finds items with empty `iconUrl`
2. For each missing item, fetches the GameWith article page
3. Extracts the sprite URL from the page sidebar (pattern: `i_item{number}.png` or `i_item_m{number}.png`)
4. Downloads the sprite to `images/items/`
5. Updates `items-champions.js` with the `iconUrl` value

## Adding support for new items

When you add a new item to `data/items-champions.js`, it will be automatically found by the script if:

1. The item name is in `ITEM_URLS` in `scripts/scrape-gamewith-mc.js` — the script will use that article URL directly
2. **OR** the item has a GameWith article page — the script will search the [item list page](https://gamewith.jp/pokemon-champions/546487) to discover its URL

If neither method works (item not on GameWith), add an entry to `ITEM_URLS`:

```js
{ name: 'アイテム名', url: 'https://gamewith.jp/pokemon-champions/123456' },
```

## Sprite convention

- Regular items: `images/items/i_item{number}.png` (GameWith/SV numbering)
- Mega stones: `images/items/i_item_m{number}.png`
- Collisions are resolved with `_2`, `_3` suffixes
