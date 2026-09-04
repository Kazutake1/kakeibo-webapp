const { test, expect } = require('@playwright/test');

async function openApp(page, { theme = 'light', transactions = [] } = {}) {
  await page.addInitScript(({ theme, transactions }) => {
    localStorage.setItem('kakeibo-theme', theme);
    localStorage.setItem('kakeibo-v1', JSON.stringify({ transactions, budgets: {}, categories: {} }));
  }, { theme, transactions });
  await page.goto('/');
  await expect(page.locator('#summaryCards .metric')).toHaveCount(5);
}

function currentDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

test('light mode: balance card uses normal card background and red negative amount', async ({ page }) => {
  await openApp(page, { theme: 'light' });
  const balance = page.locator('#summaryCards .metric').nth(2);
  const value = balance.locator('.value');
  const styles = await page.evaluate(() => {
    const cards = document.querySelectorAll('#summaryCards .metric');
    const first = getComputedStyle(cards[0]);
    const balance = getComputedStyle(cards[2]);
    const value = getComputedStyle(cards[2].querySelector('.value'));
    return { firstBg: first.backgroundColor, balanceBg: balance.backgroundColor, borderWidth: balance.borderTopWidth, valueColor: value.color };
  });
  expect(styles.balanceBg).toBe(styles.firstBg);
  expect(styles.borderWidth).toBe('2px');
  expect(styles.valueColor).toBe('rgb(220, 38, 38)');
  await expect(value).toHaveClass(/neg/);
  await expect(balance.locator('.sub')).toHaveText('赤字');
});

test('dark mode: balance card stays neutral and negative amount is red', async ({ page }) => {
  await openApp(page, { theme: 'dark' });
  await expect(page.locator('body')).toHaveClass(/dark-mode/);
  const styles = await page.evaluate(() => {
    const cards = document.querySelectorAll('#summaryCards .metric');
    const first = getComputedStyle(cards[0]);
    const balance = getComputedStyle(cards[2]);
    const value = getComputedStyle(cards[2].querySelector('.value'));
    return { firstBg: first.backgroundColor, balanceBg: balance.backgroundColor, borderWidth: balance.borderTopWidth, valueColor: value.color };
  });
  expect(styles.balanceBg).toBe(styles.firstBg);
  expect(styles.borderWidth).toBe('2px');
  expect(styles.valueColor).toBe('rgb(255, 107, 107)');
  await expect(page.locator('#summaryCards .metric').nth(2).locator('.sub')).toHaveText('赤字');
});

test('positive balance is recognized as positive', async ({ page }) => {
  await openApp(page, {
    transactions: [{ id: 'income-test', date: currentDateKey(), type: 'income', category: '給与', item: 'test', amount: 300000, amountExpression: '300000', memo: '' }]
  });
  const balance = page.locator('#summaryCards .metric').nth(2);
  await expect(balance.locator('.value')).toHaveClass(/pos/);
  await expect(balance.locator('.sub')).toHaveText('黒字');
});

test('over-budget variable expense is shown in red', async ({ page }) => {
  await openApp(page, {
    transactions: [{ id: 'over-budget-test', date: currentDateKey(), type: 'variable', category: 'セブンイレブン', item: 'test', amount: 25000, amountExpression: '25000', memo: '' }]
  });
  const row = page.locator('.budget-section[data-budget-section="variable"] .row').filter({ hasText: 'セブンイレブン' }).first();
  const actual = row.locator('.actual');
  await expect(actual).toHaveClass(/neg/);
  expect(await actual.evaluate(el => getComputedStyle(el).color)).toBe('rgb(220, 38, 38)');
});

test('zero-value categories remain visible in legends', async ({ page }) => {
  await openApp(page);
  const variableRows = page.locator('#variableLegend .donut-legend-row');
  await expect(variableRows).toHaveCount(10);
  await expect(variableRows.first()).toContainText('セブンイレブン');
  await expect(variableRows.first()).toContainText('0%');
  await expect(variableRows.first()).toContainText('¥0');
  const expenseRows = page.locator('#donutLegend .donut-legend-row');
  await expect(expenseRows).toHaveCount(6);
  await expect(expenseRows.first()).toContainText('社会保険・税金');
  await expect(expenseRows.first()).toContainText('0%');
});

test('mobile bottom navigation opens the main pages', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  for (const key of ['expense', 'income', 'budget', 'settings', 'dashboard']) {
    await page.locator(`#mobileNav [data-tab="${key}"]`).click();
    await expect(page.locator(`section[data-panel="${key}"]`)).toHaveClass(/active/);
  }
});
