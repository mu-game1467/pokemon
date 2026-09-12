# Mega Form Logic Knowledge Base

## Overview
This document describes the mega evolution system in the Pokémon Champions app, including
form cycling, mega stone assignment, and the data structure relationships.

## Key Concepts

### megaMap (index.html)
Maps each mega form name to its base form name. Used by `getBaseForm()` and `getMegaForms()`.

**Important**: ALL mega forms (including Z variants like メガアブソルZ) must have entries
in this map for form cycling to work correctly.

```javascript
const megaMap = {
  'メガアブソル': 'アブソル',
  'メガアブソルZ': 'アブソル',  // <-- Must include Z forms!
  'メガガブリアス': 'ガブリアス',
  'メガガブリアスZ': 'ガブリアス',
  // ... etc
};
```

### megaStoneMap (index.html)
Built from items data. Maps base form name → first matching mega stone name.
This is a FALLBACK only — prefer `p.megaStone` from data.

```javascript
const megaStoneMap = {};
items.forEach(item => {
  if (item.name.includes('ナイト') && item.description) {
    const m = item.description.match(/^(.+?)がバトル中メガシンカ可能になる。$/);
    if (m) {
      let bn = m[1];
      if (megaMap[bn]) bn = megaMap[bn];
      megaStoneMap[bn] = item.name;  // Overwrites! Only keeps last stone per base.
    }
  }
});
```

### megaStonesByBase (index.html)
Maps base form name → array of ALL mega stone items for that base.
Used as a fallback for item filtering when `p.megaStone` is not available.

### p.megaStone (data property)
Each mega form in `data/pokemon-champions.js` has a `megaStone` property that specifies
the EXACT mega stone item this form requires. This is the source of truth.

## Form Cycling Logic (form button click handler)
When the user clicks the form button (⇄) on a Pokemon slot:

1. Get all forms for the base: `getMegaForms(baseForm)` returns all mega forms from `megaMap`
2. Cycle to the next form
3. Auto-assign item: Use `newP.megaStone` from the data file (NOT `megaStoneMap[baseName]`)

```javascript
const nextItem = nextIsMega ? (newP.megaStone || megaStoneMap[nextBase] || p.item) : p.item;
```

## Editor Item Filtering Logic (openEditor)
When opening the editor for a mega Pokemon:

1. Check `p.megaStone` (form-specific stone from data) FIRST
2. Fall back to `megaStoneMap[baseName]` (single stone per base)
3. Filter item dropdown to show ONLY the matching mega stone

```javascript
const megaStone = isMega ? p.megaStone || megaStoneMap[baseName] : null;
const itemList = isMega && megaStone
  ? sortedItems.filter(item => item.name === megaStone || item.name === p.item)
  : sortedItems;
```

## Data Structure Requirements

### Pokemon Entries (data/pokemon-champions.js)
Each mega form MUST have:
- `"isMega": true`
- `"baseForm": "ベースポケモン名"`
- `"megaStone": "ナイット名"` (the EXACT stone this form requires)

### Item Entries (data/pokemon-champions.js)
Each mega stone item MUST have:
- `"name": "ナイット名"`
- `"description": "ポケモン名がバトル中メガシンカ可能になる。"`

### Non-Z vs Z Mega Forms
For Pokemon with both regular and Z mega forms:
- Create BOTH `アブソルナイト` and `アブソルナイトZ` items in data
- Assign `"megaStone": "アブソルナイト"` to `メガアブソル`
- Assign `"megaStone": "アブソルナイトZ"` to `メガアブソルZ`
- Add BOTH to `megaMap`: `'メガアブソル': 'アブソル'`, `'メガアブソルZ': 'アブソル'`

## Common Bugs to Avoid

### Bug 1: Missing Z form in megaMap
If `'メガアブソルZ'` is not in `megaMap`, `getMegaForms('アブソル')` won't return it,
so the form button can't cycle to it.

### Bug 2: Using megaStoneMap instead of p.megaStone
`megaStoneMap` only stores ONE stone per base Pokemon (overwrites on collision).
If both `アブソルナイト` and `アブソルナイトZ` exist, only the last one is stored.

**Fix**: Always check `p.megaStone` first, which is form-specific.

### Bug 3: Missing megaStone property in data
If a mega form entry lacks `"megaStone"` in the data file, the editor will fall back
to `megaStoneMap` which may show the wrong stone.

**Fix**: Ensure every mega form entry has the correct `megaStone` property.

### Bug 4: Duplicate item names confusing the editor
If only one of `アブソルナイト`/`アブソルナイトZ` exists in items, both forms will show
the same stone. Ensure both items exist in the data.
