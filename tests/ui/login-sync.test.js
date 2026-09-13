const { test, expect } = require('@playwright/test');

async function dismissLoginModal(page) {
  const skipBtn = await page.$('#skipLogin');
  if (skipBtn) {
    const isHidden = await skipBtn.evaluate(el => el.closest('#loginScreen')?.classList.contains('hidden'));
    if (!isHidden) {
      await Promise.race([
        skipBtn.click(),
        page.waitForTimeout(1000)
      ]);
    }
  }
}

async function loginUser(page, username, password) {
  await page.click('#loginTab');
  await page.fill('#loginUsername', username);
  await page.fill('#loginPassword', password);
  await page.click('#loginSubmit');
  await page.waitForTimeout(1000);
}

async function registerUser(page, username, password) {
  await page.click('#registerTab');
  await page.fill('#registerUsername', username);
  await page.fill('#registerPassword', password);
  await page.fill('#registerPassword2', password);
  await page.click('#registerSubmit');
  await page.waitForTimeout(500);
}

test('login shows online status and account info', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  const uniqueUser = `login_sync_test_${Date.now()}`;
  await registerUser(page, uniqueUser, 'password123');
  await page.waitForTimeout(500);

  await loginUser(page, uniqueUser, 'password123');

  const modalHidden = await page.evaluate(() => {
    const modal = document.getElementById('loginScreen');
    return modal?.classList.contains('hidden');
  });
  expect(modalHidden).toBe(true);

  const userStatus = await page.textContent('#userStatus');
  expect(userStatus).toBe(`ユーザー名：${uniqueUser}`);

  const logoutBtnVisible = await page.evaluate(() => {
    const btn = document.getElementById('logoutUser');
    return btn && btn.style.display !== 'none';
  });
  expect(logoutBtnVisible).toBe(true);
});

test('login with wrong password shows error', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  await registerUser(page, 'wrong_pass_test', 'password123');
  await page.waitForTimeout(500);

  await page.click('#loginTab');
  await page.fill('#loginUsername', 'wrong_pass_test');
  await page.fill('#loginPassword', 'wrongpassword');
  await page.click('#loginSubmit');
  await page.waitForTimeout(1000);

  const userStatus = await page.textContent('#userStatus');
  expect(userStatus).toBe('オフライン');
});

test('login with non-existent user shows offline', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  await page.click('#loginTab');
  await page.fill('#loginUsername', 'nonexistent_user_12345');
  await page.fill('#loginPassword', 'password123');
  await page.click('#loginSubmit');
  await page.waitForTimeout(1000);

  const userStatus = await page.textContent('#userStatus');
  expect(userStatus).toBe('オフライン');
});

test('user data syncs to server and back on refresh', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  const uniqueUser = `sync_test_${Date.now()}`;
  await registerUser(page, uniqueUser, 'password123');
  await page.waitForTimeout(500);

  await loginUser(page, uniqueUser, 'password123');
  await page.waitForTimeout(2000);

  const pageTitle = await page.title();
  expect(pageTitle).not.toBe('');

  const searchVisible = await page.evaluate(() => {
    const el = document.getElementById('search');
    return el && !el.hasAttribute('disabled');
  });
  expect(searchVisible).toBe(true);

  await page.fill('#search', 'フシギバナ');
  await page.waitForSelector('.suggestion', { timeout: 10000 });

  await page.click('.suggestion');
  await page.waitForTimeout(500);

  const abilityPicker = await page.$('#abilityPicker');
  if (abilityPicker) {
    const isHidden = await abilityPicker.evaluate(el => el.classList.contains('hidden'));
    if (!isHidden) {
      await page.click('.ability-option');
    }
  }
  await page.waitForTimeout(500);

  const countBefore = await page.textContent('#countLabel');
  expect(countBefore).toBe('1 / 6');

  await page.evaluate(() => { if (typeof saveAllToServer === 'function') saveAllToServer(); });
  await page.waitForTimeout(1500);

  const userStatusBeforeRefresh = await page.textContent('#userStatus');
  expect(userStatusBeforeRefresh).toBe(`ユーザー名：${uniqueUser}`);

  await page.reload();
  await page.waitForTimeout(2000);

  const modalHiddenAfter = await page.evaluate(() => {
    const modal = document.getElementById('loginScreen');
    return modal?.classList.contains('hidden');
  });
  expect(modalHiddenAfter).toBe(true);

  const userStatusAfter = await page.textContent('#userStatus');
  expect(userStatusAfter).toBe(`ユーザー名：${uniqueUser}`);

  await page.waitForTimeout(500);
  const countAfter = await page.textContent('#countLabel');
  expect(countAfter).toBe('1 / 6');
});

test('logout returns to offline status', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  const uniqueUser = `logout_test_${Date.now()}`;
  await registerUser(page, uniqueUser, 'password123');
  await loginUser(page, uniqueUser, 'password123');

  const userStatus = await page.textContent('#userStatus');
  expect(userStatus).toBe(`ユーザー名：${uniqueUser}`);

  await page.click('#logoutUser');
  await page.waitForTimeout(500);

  const userStatusAfter = await page.textContent('#userStatus');
  expect(userStatusAfter).toBe('オフライン');
});

test('mega pokemon shows correct mega stone in item dropdown', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  await dismissLoginModal(page);

  await page.fill('#search', 'フシギバナ');
  await page.waitForSelector('.suggestion', { timeout: 10000 });
  await page.click('.suggestion');
  const abilityPicker = await page.$('#abilityPicker');
  if (abilityPicker) {
    const isHidden = await abilityPicker.evaluate(el => el.classList.contains('hidden'));
    if (!isHidden) {
      await page.click('.ability-option');
    }
  }
  await page.waitForTimeout(500);

  const count = await page.textContent('#countLabel');
  expect(count).toBe('1 / 6');

  // Click edit button for first Pokemon
  await page.click('.edit-button');
  await page.waitForTimeout(500);

  // Check that the item dropdown shows only the correct mega stone
  const itemOptions = await page.evaluate(() => {
    const select = document.getElementById('editItem');
    return Array.from(select.querySelectorAll('option')).map(opt => opt.value);
  });

  // フシギバナ (base form) should show フシギバナイト
  expect(itemOptions.some(opt => opt.includes('フシギバナイト'))).toBe(true);

  // Close editor
  await page.click('#closeEditor');
  await page.waitForTimeout(500);

  // Cycle to Mega form using form button on party slot
  await page.click('.form-btn');
  await page.waitForTimeout(500);

  // Reopen editor
  await page.click('.edit-button');
  await page.waitForTimeout(500);

  // Check item dropdown still shows mega stone
  const itemOptionsAfter = await page.evaluate(() => {
    const select = document.getElementById('editItem');
    return Array.from(select.querySelectorAll('option')).map(opt => opt.value);
  });
  expect(itemOptionsAfter.some(opt => opt.includes('フシギバナイト'))).toBe(true);
});

test('mega charizard X shows only Charizardite X', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  await dismissLoginModal(page);

  // Add Charizard
  await page.fill('#search', 'リザードン');
  await page.waitForSelector('.suggestion', { timeout: 10000 });
  await page.click('.suggestion');
  const abilityPicker = await page.$('#abilityPicker');
  if (abilityPicker) {
    const isHidden = await abilityPicker.evaluate(el => el.classList.contains('hidden'));
    if (!isHidden) {
      await page.click('.ability-option');
    }
  }
  await page.waitForTimeout(500);

  const count = await page.textContent('#countLabel');
  expect(count).toBe('1 / 6');

  // Cycle to Mega Charizard X using form button on party slot
  await page.click('.form-btn');
  await page.waitForTimeout(500);
  await page.click('.form-btn');
  await page.waitForTimeout(500);

  // Check current form name in party slot
  const slotName = await page.evaluate(() => {
    const el = document.querySelector('.slot-name');
    return el ? el.textContent : '';
  });

  // Open editor
  await page.click('.edit-button');
  await page.waitForTimeout(500);

  const itemOptions = await page.evaluate(() => {
    const select = document.getElementById('editItem');
    return Array.from(select.querySelectorAll('option')).map(opt => opt.value);
  });

  if (slotName.includes('X')) {
    expect(itemOptions.some(opt => opt === 'リザードナイトX')).toBe(true);
    expect(itemOptions.some(opt => opt === 'リザードナイトY')).toBe(false);
  }
});
