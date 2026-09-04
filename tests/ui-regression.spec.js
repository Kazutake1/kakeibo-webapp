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


test('iPad: variable category card does not clip and tabs stay visible while scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openApp(page);

  const variableCard = page.locator('.card').filter({ has: page.locator('#variableDonut') }).first();
  const layout = variableCard.locator('.donut-layout');
  const geometry = await variableCard.evaluate(card => ({
    clientWidth: card.clientWidth,
    scrollWidth: card.scrollWidth
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);

  const columns = await layout.evaluate(el => getComputedStyle(el).gridTemplateColumns);
  expect(columns.trim().split(/\s+/).length).toBeGreaterThanOrEqual(2);

  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(100);
  const tabs = page.locator('#tabs');
  await expect(tabs).toBeVisible();
  const box = await tabs.boundingBox();
  expect(box).not.toBeNull();
  expect(box.y).toBeGreaterThanOrEqual(55);
  expect(box.y).toBeLessThan(110);
});


test('donut legends switch between percentage and amount', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openApp(page);

  for (const legendId of ['donutLegend','variableLegend']) {
    const legend=page.locator(`#${legendId}`);
    await expect(legend.locator('.donut-mode-btn')).toHaveCount(2);
    await expect(legend.locator('.donut-mode-btn[data-mode="percent"]')).toHaveClass(/active/);
    await expect(legend.locator('.donut-value-percent').first()).toBeVisible();
    await expect(legend.locator('.donut-value-amount').first()).toBeHidden();

    await legend.locator('.donut-mode-btn[data-mode="amount"]').click();
    await expect(legend.locator('.donut-mode-btn[data-mode="amount"]')).toHaveClass(/active/);
    await expect(legend.locator('.donut-value-percent').first()).toBeHidden();
    await expect(legend.locator('.donut-value-amount').first()).toBeVisible();
  }

  const variableCard=page.locator('.card').filter({has:page.locator('#variableDonut')}).first();
  const geometry=await variableCard.evaluate(card=>({clientWidth:card.clientWidth,scrollWidth:card.scrollWidth}));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth+1);
});


test('iPad donut cards use full width with side-by-side legend', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openApp(page);
  for (const canvasId of ['donutChart','variableDonut']) {
    const card=page.locator('.card').filter({has:page.locator(`#${canvasId}`)}).first();
    const layout=card.locator('.donut-layout');
    const columns=await layout.evaluate(el=>getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length);
    expect(columns).toBeGreaterThanOrEqual(2);
    const geometry=await card.evaluate(el=>({clientWidth:el.clientWidth,scrollWidth:el.scrollWidth}));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth+1);
  }
});


test('budget page hides income and tax budget sections', async ({ page }) => {
  await openApp(page);
  await page.locator('[data-tab="budget"]').first().click();
  const budgetEditor=page.locator('#budgetEditor');
  await expect(budgetEditor).toBeVisible();
  await expect(budgetEditor).not.toContainText('収入');
  await expect(budgetEditor).not.toContainText('社会保険・税金');
  await expect(budgetEditor).toContainText('貯蓄');
  await expect(budgetEditor).toContainText('固定費');
  await expect(budgetEditor).toContainText('変動費');

  await budgetEditor.getByRole('button',{name:'予算を編集'}).click();
  const dialog=page.locator('#budgetDialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toContainText('社会保険・税金');
  await expect(dialog.locator('[data-budget-type="income"]')).toHaveCount(0);
  await expect(dialog.locator('[data-budget-type="tax"]')).toHaveCount(0);
  await expect(dialog.locator('[data-budget-type="fixed"]')).not.toHaveCount(0);
});


test('smartphone expense composition matches variable category donut layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);

  for (const canvasId of ['donutChart', 'variableDonut']) {
    const card = page.locator('.card').filter({ has: page.locator(`#${canvasId}`) }).first();
    const layout = card.locator('.donut-layout');
    const columns = await layout.evaluate(el => getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length);
    expect(columns).toBe(1);
    const geometry = await card.evaluate(el => ({ clientWidth: el.clientWidth, scrollWidth: el.scrollWidth }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  }
});


test('iPad: calendar entry dialog does not auto-focus date input', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openApp(page);
  await page.locator('#tabs [data-tab="expense"]').click();
  const cell = page.locator('#expenseCalendarWrap .cal-cell[onclick*="quickAddType"]').first();
  await cell.click();
  await expect(page.locator('#txDialog')).toBeVisible();
  const activeId = await page.evaluate(() => document.activeElement?.id || '');
  expect(activeId).not.toBe('txDate');
});


test('iPad: transaction date cannot be automatic dialog focus target', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openApp(page);
  await page.locator('#tabs [data-tab="expense"]').click();
  const cell = page.locator('#expenseCalendarWrap .cal-cell[onclick*="quickAddType"]').first();
  await cell.click();
  await expect(page.locator('#txDialog')).toBeVisible();
  const date = page.locator('#txDate');
  await expect(date).toBeEnabled();
  expect(await date.getAttribute('tabindex')).toBe('-1');
  const activeId = await page.evaluate(() => document.activeElement?.id || '');
  expect(activeId).not.toBe('txDate');
});
