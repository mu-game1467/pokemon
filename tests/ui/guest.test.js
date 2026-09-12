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

test('guest login allows party building after refresh', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  // Verify login modal is visible
  const modalVisible = await page.evaluate(() => {
    const modal = document.getElementById('loginModalOverlay');
    return !modal?.classList.contains('hidden');
  });
  expect(modalVisible).toBe(true);

  // Click "Continue without login"
  await page.click('#skipLogin');
  await page.waitForTimeout(500);

  // Verify login modal is hidden
  const modalHidden = await page.evaluate(() => {
    const modal = document.getElementById('loginModalOverlay');
    return modal?.classList.contains('hidden');
  });
  expect(modalHidden).toBe(true);

  // Verify user status shows offline
  const userStatus = await page.textContent('#userStatus');
  expect(userStatus).toBe('オフライン');

  // Add a Pokemon
  await page.fill('#search', 'フシギバナ');
  await page.waitForSelector('.suggestion');
  await page.click('.suggestion');
  const abilityPicker = await page.$('#abilityPicker');
  if (abilityPicker) {
    const isHidden = await abilityPicker.evaluate(el => el.classList.contains('hidden'));
    if (!isHidden) {
      await page.click('.ability-option');
    }
  }
  await page.waitForTimeout(500);

  // Verify party count
  const count = await page.textContent('#countLabel');
  expect(count).toBe('1 / 6');

  // Reload the page
  await page.reload();
  await page.waitForTimeout(1000);

  // After refresh, login modal should show (guest has no saved session)
  const modalVisibleAfter = await page.evaluate(() => {
    const modal = document.getElementById('loginModalOverlay');
    return !modal?.classList.contains('hidden');
  });
  expect(modalVisibleAfter).toBe(true);
});
