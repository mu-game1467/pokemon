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

test('login is shown as a full-page screen, not a modal', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  const state = await page.evaluate(() => {
    const loginScreen = document.getElementById('loginScreen');
    const appContent = document.getElementById('appContent');
    const chatFab = document.getElementById('chatFab');
    const style = getComputedStyle(loginScreen);
    const rect = loginScreen.getBoundingClientRect();
    return {
      loginVisible: !loginScreen.classList.contains('hidden'),
      loginInsideApp: !!loginScreen.closest('main.app'),
      loginPosition: style.position,
      loginBackground: style.backgroundColor,
      loginCoversViewport: rect.width >= window.innerWidth && rect.height >= window.innerHeight,
      appContentHidden: appContent.classList.contains('hidden'),
      chatFabHidden: chatFab.classList.contains('hidden')
    };
  });

  // ログイン画面は画面全体を覆う不透明な画面（背景が透けていない＝モーダルではない）
  expect(state.loginVisible).toBe(true);
  expect(state.loginPosition).toBe('fixed');
  expect(state.loginCoversViewport).toBe(true);
  expect(state.loginBackground).not.toBe('rgba(0, 0, 0, 0)');
  expect(state.loginBackground).not.toBe('transparent');
  // ログイン画面はアプリ本体の外側にあり、アプリ側は非表示
  expect(state.loginInsideApp).toBe(false);
  expect(state.appContentHidden).toBe(true);
  expect(state.chatFabHidden).toBe(true);
});

test('after login the party building screen is shown', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  const uniqueUser = `enter_app_test_${Date.now()}`;

  await page.click('#registerTab');
  await page.fill('#registerUsername', uniqueUser);
  await page.fill('#registerPassword', 'password123');
  await page.fill('#registerPassword2', 'password123');
  await page.click('#registerSubmit');
  await page.waitForTimeout(500);

  await page.click('#loginTab');
  await page.fill('#loginUsername', uniqueUser);
  await page.fill('#loginPassword', 'password123');
  await page.click('#loginSubmit');
  await page.waitForTimeout(2000);

  const state = await page.evaluate(() => {
    const vis = id => {
      const el = document.getElementById(id);
      return !!el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none';
    };
    return {
      loginHidden: !vis('loginScreen'),
      appContentVisible: vis('appContent'),
      partyWorkspaceVisible: vis('partyWorkspace'),
      activeTab: (document.querySelector('.tab-btn.active') || {}).textContent || '',
      countLabel: document.getElementById('countLabel').textContent,
      chatFabVisible: vis('chatFab'),
      userStatus: document.getElementById('userStatus').textContent
    };
  });

  expect(state.loginHidden).toBe(true);
  expect(state.appContentVisible).toBe(true);
  expect(state.partyWorkspaceVisible).toBe(true);
  expect(state.activeTab).toBe('パーティ構築');
  expect(state.countLabel).toBe('0 / 6');
  expect(state.chatFabVisible).toBe(true);
  expect(state.userStatus).toBe(`ユーザー名：${uniqueUser}`);

  // パーティ構築画面がそのまま操作できる（ポケモンを追加できる）
  await page.fill('#search', 'フシギバナ');
  await page.waitForSelector('.suggestion', { timeout: 10000 });
  await page.click('.suggestion');
  const abilityPicker = await page.$('#abilityPicker');
  if (abilityPicker) {
    const isHidden = await abilityPicker.evaluate(el => el.classList.contains('hidden'));
    if (!isHidden) await page.click('.ability-option');
  }
  await page.waitForTimeout(500);
  expect(await page.textContent('#countLabel')).toBe('1 / 6');
});

test('session restore also opens the party building screen', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  const uniqueUser = `restore_app_test_${Date.now()}`;

  await page.click('#registerTab');
  await page.fill('#registerUsername', uniqueUser);
  await page.fill('#registerPassword', 'password123');
  await page.fill('#registerPassword2', 'password123');
  await page.click('#registerSubmit');
  await page.waitForTimeout(500);

  await page.click('#loginTab');
  await page.fill('#loginUsername', uniqueUser);
  await page.fill('#loginPassword', 'password123');
  await page.click('#loginSubmit');
  await page.waitForTimeout(2000);

  await page.reload();
  await page.waitForTimeout(2000);

  const state = await page.evaluate(() => ({
    loginHidden: document.getElementById('loginScreen').classList.contains('hidden'),
    appContentVisible: !document.getElementById('appContent').classList.contains('hidden'),
    partyWorkspaceVisible: !document.getElementById('partyWorkspace').classList.contains('hidden'),
    activeTab: (document.querySelector('.tab-btn.active') || {}).textContent || ''
  }));

  expect(state.loginHidden).toBe(true);
  expect(state.appContentVisible).toBe(true);
  expect(state.partyWorkspaceVisible).toBe(true);
  expect(state.activeTab).toBe('パーティ構築');
});
