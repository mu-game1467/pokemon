const { test, expect } = require('@playwright/test');

async function dismissLoginModal(page) {
  const skipBtn = await page.$('#skipLogin');
  if (skipBtn) {
    const isHidden = await skipBtn.evaluate(el => el.closest('#loginModalOverlay')?.classList.contains('hidden'));
    if (!isHidden) {
      await skipBtn.click();
    }
  }
}

async function addPokemonBySearch(page, query) {
  await dismissLoginModal(page);
  await page.fill('#search', query);
  await page.waitForSelector('.suggestion');
  await page.click('.suggestion');
  const abilityPicker = await page.$('#abilityPicker');
  if (abilityPicker) {
    const isHidden = await abilityPicker.evaluate(el => el.classList.contains('hidden'));
    if (!isHidden) {
      await page.click('.ability-option');
    }
  }
}

async function getPartyCount(page) {
  const countLabel = await page.textContent('#countLabel');
  const match = countLabel?.match(/(\d+)\s*\/\s*6/);
  return match ? Number(match[1]) : 0;
}

test.describe('Frontend: Page Load', () => {
  test('page has correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('CHAMPIONS / PARTY LAB');
  });

  test('POKEMON_DATA is loaded in browser', async ({ page }) => {
    await page.goto('/');
    const dataLoaded = await page.evaluate(() => {
      return window.POKEMON_DATA && window.POKEMON_DATA.pokemon && window.POKEMON_DATA.pokemon.length > 0;
    });
    expect(dataLoaded).toBe(true);
  });

  test('Pokemon count is reflected in data', async ({ page }) => {
    await page.goto('/');
    const count = await page.evaluate(() => window.POKEMON_DATA.count);
    expect(count).toBeGreaterThanOrEqual(345);
  });

  test('MOVE_DATA is loaded in browser', async ({ page }) => {
    await page.goto('/');
    const moveDataLoaded = await page.evaluate(() => {
      return window.MOVE_DATA && Object.keys(window.MOVE_DATA).length > 0;
    });
    expect(moveDataLoaded).toBe(true);
  });

  test('ITEM_DATA is loaded in browser', async ({ page }) => {
    await page.goto('/');
    const itemDataLoaded = await page.evaluate(() => {
      return window.ITEM_DATA && window.ITEM_DATA.items && window.ITEM_DATA.items.length > 0;
    });
    expect(itemDataLoaded).toBe(true);
  });
});

test.describe('Frontend: Search & Filter', () => {
  test('search input filters Pokemon', async ({ page }) => {
    await page.goto('/');
    await page.fill('#search', 'プクリン');
    const suggestions = await page.$$('.suggestion');
    expect(suggestions.length).toBeGreaterThan(0);
    const suggestionText = await suggestions[0].innerText();
    expect(suggestionText).toContain('プクリン');
  });

  test('search returns no results for non-matching query', async ({ page }) => {
    await page.goto('/');
    await page.fill('#search', 'xyznonexistent12345');
    const suggestions = await page.$$('.suggestion');
    expect(suggestions.length).toBe(0);
  });
});

test.describe('Frontend: Party Building', () => {
  test('party counter shows 0/6 initially', async ({ page }) => {
    await page.goto('/');
    const countLabel = await page.textContent('#countLabel');
    expect(countLabel).toContain('0');
  });

  test('clicking a Pokemon adds it to party', async ({ page }) => {
    await page.goto('/');
    await addPokemonBySearch(page, 'フシギバナ');
    const countLabel = await page.textContent('#countLabel');
    expect(countLabel).toBe('1 / 6');
  });

  test('clicking add again fills another slot', async ({ page }) => {
    await page.goto('/');
    await addPokemonBySearch(page, 'フシギバナ');
    await addPokemonBySearch(page, 'カメックス');
    const countLabel = await page.textContent('#countLabel');
    expect(countLabel).toBe('2 / 6');
  });

  test('exceeding 6 Pokemon shows error or prevents', async ({ page }) => {
    await page.goto('/');
    const searchQueries = ['フシギバナ', 'リザードン', 'カメックス', 'ピカチュウ', 'ピクシー', 'ライチュウ'];
    for (const query of searchQueries) {
      await addPokemonBySearch(page, query);
    }
    const countLabel = await page.textContent('#countLabel');
    expect(countLabel).toBe('6 / 6');
    // Try adding a 7th
    await addPokemonBySearch(page, 'スピアー');
    const finalCount = await page.textContent('#countLabel');
    expect(finalCount).toBe('6 / 6');
  });
});

test.describe('Frontend: Pokemon Details', () => {
  test('added Pokemon shows icon and name', async ({ page }) => {
    await page.goto('/');
    await addPokemonBySearch(page, 'フシギバナ');
    const slotName = await page.textContent('.slot.filled .slot-name');
    expect(slotName).toContain('フシギバナ');
  });

  test('added Pokemon shows base stats', async ({ page }) => {
    await page.goto('/');
    await addPokemonBySearch(page, 'フシギバナ');
    const statsText = await page.textContent('.slot.filled .slot-stats');
    expect(statsText).toContain('種');
  });

  test('edit button opens editor', async ({ page }) => {
    await page.goto('/');
    await addPokemonBySearch(page, 'フシギバナ');
    await page.click('.edit-button');
    await expect(page.locator('#editor')).not.toHaveClass(/hidden/);
  });
});

test.describe('Frontend: Mega Form Cycling', () => {
  test('mega Pokemon can cycle through forms including Z variant', async ({ page }) => {
    await page.goto('/');
    await addPokemonBySearch(page, 'アブソル');
    await page.click('.edit-button');
    await expect(page.locator('#editor')).not.toHaveClass(/hidden/);
    const slotName = await page.textContent('.slot.filled .slot-name');
    expect(slotName).toContain('アブソル');
    await page.click('[data-form-index="0"]');
    const nextSlotName = await page.textContent('.slot.filled .slot-name');
    expect(['メガアブソル', 'メガアブソルZ'].some(name => nextSlotName.includes(name))).toBe(true);
  });

  test('mega form editor shows correct mega stone', async ({ page }) => {
    await page.goto('/');
    await addPokemonBySearch(page, 'アブソル');
    await page.click('.edit-button');
    await page.click('[data-form-index="0"]');
    await page.click('[data-form-index="0"]');
    await page.click('.edit-button');
    const itemOptions = await page.$$eval('#editItem option', opts => opts.map(o => o.textContent));
    const slotName = await page.textContent('.slot.filled .slot-name');
    if (slotName.includes('メガアブソルZ')) {
      expect(itemOptions).toContain('アブソルナイトZ');
      expect(itemOptions).not.toContain('アブソルナイト');
    } else if (slotName.includes('メガアブソル')) {
      expect(itemOptions).toContain('アブソルナイト');
      expect(itemOptions).not.toContain('アブソルナイトZ');
    }
  });
});

test.describe('Frontend: Damage Calculator', () => {
  test('damage calculator modal opens', async ({ page }) => {
    await page.goto('/');
    await dismissLoginModal(page);
    await page.click('#openDamageCalc');
    await expect(page.locator('#damageCalcModal')).not.toHaveClass(/hidden/);
  });

  test('damage calculator has attacker and defender selects', async ({ page }) => {
    await page.goto('/');
    await dismissLoginModal(page);
    await page.click('#openDamageCalc');
    const attackerSelect = await page.$('#dcAttacker');
    const defenderSelect = await page.$('#dcDefender');
    expect(attackerSelect).not.toBeNull();
    expect(defenderSelect).not.toBeNull();
  });
});

test.describe('Frontend: Type Filter', () => {
  test('type filter chips are rendered', async ({ page }) => {
    await page.goto('/');
    const chips = await page.$$('.type-filter-chip');
    expect(chips.length).toBeGreaterThan(0);
  });
});
