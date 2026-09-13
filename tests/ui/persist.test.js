const { test, expect } = require('@playwright/test');

async function dismissLoginModal(page) {
  const skipBtn = await page.$('#skipLogin');
  if (skipBtn) {
    const isHidden = await skipBtn.evaluate(el => el.closest('#loginScreen')?.classList.contains('hidden'));
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

test('login persists after refresh with party data', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  const uniqueUser = `persist_test_${Date.now()}`;

  // Register a new user
  await page.click('#registerTab');
  await page.fill('#registerUsername', uniqueUser);
  await page.fill('#registerPassword', 'password123');
  await page.fill('#registerPassword2', 'password123');
  await page.click('#registerSubmit');
  await page.waitForTimeout(500);

  // Login
  await page.click('#loginTab');
  await page.fill('#loginUsername', uniqueUser);
  await page.fill('#loginPassword', 'password123');
  await page.click('#loginSubmit');
  await page.waitForTimeout(1000);

  // Verify logged in
  const modalHidden = await page.evaluate(() => {
    const modal = document.getElementById('loginScreen');
    return modal?.classList.contains('hidden');
  });
  expect(modalHidden).toBe(true);

  // Verify user status is updated
  const userStatus = await page.textContent('#userStatus');
   expect(userStatus).toBe(`ユーザー名：${uniqueUser}`);

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
  const countBefore = await page.textContent('#countLabel');
  expect(countBefore).toBe('1 / 6');

  // Reload the page
  await page.reload();
  await page.waitForTimeout(1000);

  // Verify login persists after refresh
  const modalHiddenAfter = await page.evaluate(() => {
    const modal = document.getElementById('loginScreen');
    return modal?.classList.contains('hidden');
  });
  expect(modalHiddenAfter).toBe(true);

  // Verify user status is still set
  const userStatusAfter = await page.textContent('#userStatus');
   expect(userStatusAfter).toBe(`ユーザー名：${uniqueUser}`);

  // Verify party data persists
  const countAfter = await page.textContent('#countLabel');
  expect(countAfter).toBe('1 / 6');
});
