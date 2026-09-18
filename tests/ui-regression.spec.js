const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const APP_VERSION = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')).version;

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
  await expect(balance.locator('.sub')).toHaveCount(0);
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
  await expect(page.locator('#summaryCards .metric').nth(2).locator('.sub')).toHaveCount(0);
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


test('desktop overview uses equal main columns and keeps the narrow layout stacked', async ({ page }) => {
  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await openApp(page);
    const geometry = await page.locator('section[data-panel="dashboard"] > .grid').evaluate(grid => {
      const cards = [...grid.children].slice(0, 2);
      const gridRect = grid.getBoundingClientRect();
      const leftRect = cards[0].getBoundingClientRect();
      const rightRect = cards[1].getBoundingClientRect();
      return {
        columns: getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length,
        leftWidth: leftRect.width,
        rightWidth: rightRect.width,
        splitCenter: (leftRect.right + rightRect.left) / 2,
        gridCenter: gridRect.left + gridRect.width / 2,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    expect(geometry.columns).toBe(2);
    expect(Math.abs(geometry.leftWidth - geometry.rightWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.splitCenter - geometry.gridCenter)).toBeLessThanOrEqual(1);
    expect(geometry.overflow).toBeLessThanOrEqual(1);
  }

  await page.setViewportSize({ width: 1000, height: 900 });
  await openApp(page);
  const narrowColumns = await page.locator('section[data-panel="dashboard"] > .grid').evaluate(
    grid => getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length
  );
  expect(narrowColumns).toBe(1);
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

test('Design1 donut styling is shared by mobile, iPad and desktop', async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 }
  ]) {
    await page.setViewportSize(viewport);
    await openApp(page);
    const card=page.locator('.card').filter({has:page.locator('#donutChart')}).first();
    await expect(card.locator('.donut-mode-toggle')).toHaveCount(1);
    await expect(card.locator('.donut-legend-row')).not.toHaveCount(0);
    await expect(card.locator('.donut-legend-name .dot').first()).toBeVisible();
    const styles=await card.evaluate(el=>{
      const toggle=el.querySelector('.donut-mode-toggle');
      const row=el.querySelector('.donut-legend-row');
      const dot=el.querySelector('.donut-legend-name .dot');
      return {
        toggleRadius:getComputedStyle(toggle).borderRadius,
        toggleBorder:getComputedStyle(toggle).borderTopWidth,
        rowBorder:getComputedStyle(row).borderBottomWidth,
        dotRadius:getComputedStyle(dot).borderRadius,
        clientWidth:el.clientWidth,
        scrollWidth:el.scrollWidth
      };
    });
    expect(styles.toggleRadius).toBe('999px');
    expect(styles.toggleBorder).toBe('0px');
    expect(styles.rowBorder).toBe('1px');
    expect(styles.dotRadius).toBe('50%');
    expect(styles.scrollWidth).toBeLessThanOrEqual(styles.clientWidth+1);
  }
});

test('iPad and desktop donut cards align with six visible variable legend rows', async ({ page }) => {
  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 1440, height: 900 }
  ]) {
    await page.setViewportSize(viewport);
    await openApp(page);
    await expect(page.locator('#donutLegend .donut-mode-toggle')).toHaveCount(1);
    await expect(page.locator('#variableLegend .donut-mode-toggle')).toHaveCount(1);
    await expect(page.locator('#donutLegend .donut-legend-row')).toHaveCount(6);
    await expect(page.locator('#variableLegend .donut-legend-row')).toHaveCount(10);
    await expect(page.locator('#donutChart')).toBeVisible();
    await expect(page.locator('#variableDonut')).toBeVisible();

    const metrics=await page.evaluate(() => {
      const expenseCard=document.querySelector('.card:has(#donutChart)');
      const variableCard=document.querySelector('.card:has(#variableDonut)');
      const expenseCanvas=document.querySelector('#donutChart').getBoundingClientRect();
      const variableCanvas=document.querySelector('#variableDonut').getBoundingClientRect();
      const expenseToggle=document.querySelector('#donutLegend .donut-mode-toggle').getBoundingClientRect();
      const variableToggle=document.querySelector('#variableLegend .donut-mode-toggle').getBoundingClientRect();
      const expenseList=document.querySelector('#donutLegend .donut-legend-list');
      const variableList=document.querySelector('#variableLegend .donut-legend-list');
      const expenseCardRect=expenseCard.getBoundingClientRect();
      const variableCardRect=variableCard.getBoundingClientRect();
      const expenseListRect=expenseList.getBoundingClientRect();
      const variableListRect=variableList.getBoundingClientRect();
      const visibleVariableRows=[...variableList.children].filter(row=>{
        const rect=row.getBoundingClientRect();
        return rect.top>=variableListRect.top-1&&rect.bottom<=variableListRect.bottom+1;
      }).length;
      return {
        expenseCardHeight:expenseCardRect.height,
        variableCardHeight:variableCardRect.height,
        expenseCanvasTop:expenseCanvas.top-expenseCardRect.top,
        variableCanvasTop:variableCanvas.top-variableCardRect.top,
        expenseCanvasSize:[expenseCanvas.width,expenseCanvas.height],
        variableCanvasSize:[variableCanvas.width,variableCanvas.height],
        expenseToggleTop:expenseToggle.top-expenseCardRect.top,
        variableToggleTop:variableToggle.top-variableCardRect.top,
        expenseListTop:expenseListRect.top-expenseCardRect.top,
        variableListTop:variableListRect.top-variableCardRect.top,
        expenseListHeight:expenseList.clientHeight,
        variableListHeight:variableList.clientHeight,
        variableScrollHeight:variableList.scrollHeight,
        variableOverflowY:getComputedStyle(variableList).overflowY,
        variableTabIndex:variableList.tabIndex,
        visibleVariableRows,
        expenseBottomGap:expenseCardRect.bottom-Math.max(expenseCanvas.bottom,expenseListRect.bottom),
        variableBottomGap:variableCardRect.bottom-Math.max(variableCanvas.bottom,variableListRect.bottom)
      };
    });

    expect(Math.abs(metrics.expenseCardHeight-metrics.variableCardHeight)).toBeLessThanOrEqual(1);
    expect(Math.abs(metrics.expenseCanvasTop-metrics.variableCanvasTop)).toBeLessThanOrEqual(2);
    expect(Math.abs(metrics.expenseCanvasSize[0]-metrics.variableCanvasSize[0])).toBeLessThanOrEqual(1);
    expect(Math.abs(metrics.expenseCanvasSize[1]-metrics.variableCanvasSize[1])).toBeLessThanOrEqual(1);
    expect(Math.abs(metrics.expenseToggleTop-metrics.variableToggleTop)).toBeLessThanOrEqual(2);
    expect(Math.abs(metrics.expenseListTop-metrics.variableListTop)).toBeLessThanOrEqual(2);
    expect(metrics.expenseListHeight).toBe(228);
    expect(metrics.variableListHeight).toBe(228);
    expect(metrics.variableScrollHeight).toBeGreaterThan(metrics.variableListHeight);
    expect(metrics.variableOverflowY).toBe('auto');
    expect(metrics.variableTabIndex).toBe(0);
    expect(metrics.visibleVariableRows).toBe(6);
    expect(metrics.expenseBottomGap).toBeLessThanOrEqual(48);
    expect(metrics.variableBottomGap).toBeLessThanOrEqual(48);
  }
});

test('iPhone keeps every variable legend row visible without an inner scroll viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  const metrics=await page.locator('#variableLegend .donut-legend-list').evaluate(list=>({
    clientHeight:list.clientHeight,
    scrollHeight:list.scrollHeight,
    overflowY:getComputedStyle(list).overflowY,
    rows:list.children.length
  }));
  expect(metrics.rows).toBe(10);
  expect(metrics.clientHeight).toBe(metrics.scrollHeight);
  expect(metrics.overflowY).toBe('visible');
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
  await page.addInitScript(() => {
    const showModal = HTMLDialogElement.prototype.showModal;
    HTMLDialogElement.prototype.showModal = function () {
      if (this.id === 'txDialog') {
        window.txDateDisabledWhenDialogOpened = document.getElementById('txDate')?.disabled;
      }
      return showModal.call(this);
    };
  });
  await openApp(page);
  await page.locator('#tabs [data-tab="expense"]').click();
  const cell = page.locator('#expenseCalendarWrap .cal-cell[onclick*="quickAddType"]').first();
  await cell.click();
  await expect(page.locator('#txDialog')).toBeVisible();
  const date = page.locator('#txDate');
  expect(await page.evaluate(() => window.txDateDisabledWhenDialogOpened)).toBe(true);
  await expect(date).toBeEnabled();
  expect(await date.getAttribute('tabindex')).toBe('-1');
  const activeId = await page.evaluate(() => document.activeElement?.id || '');
  expect(activeId).not.toBe('txDate');
  await date.focus();
  await expect(date).toBeFocused();
});



test('expense history shows non-variable expenses and supports edit delete and fixed budget link', async ({ page }) => {
  const date=currentDateKey();
  await openApp(page,{transactions:[
    {id:'tax-history',date,type:'tax',category:'所得税',item:'源泉税',amount:8000,amountExpression:'8000',memo:''},
    {id:'self-history',date,type:'self',category:'書籍',item:'ビジネス書',amount:1500,amountExpression:'1500',memo:''},
    {id:'special-history',date,type:'special',category:'特別支出',item:'家電',amount:12800,amountExpression:'12800',memo:''},
    {id:'variable-history',date,type:'variable',category:'セブンイレブン',item:'コンビニ',amount:500,amountExpression:'500',memo:''}
  ]});
  await page.locator('#tabs [data-tab="expense"]').click();
  const card=page.locator('.expense-history-card');
  await expect(card).toBeVisible();
  await expect(card.locator('.expense-history-filter.active')).toHaveText('変動費以外');
  await expect(card.locator('[data-expense-id="tax-history"]')).toBeVisible();
  await expect(card.locator('[data-expense-id="self-history"]')).toBeVisible();
  await expect(card.locator('[data-expense-id="special-history"]')).toBeVisible();
  await expect(card.locator('[data-expense-id="variable-history"]')).toHaveCount(0);
  await expect(card.locator('[data-expense-type="fixed"]')).toBeVisible();

  await card.locator('[data-expense-id="tax-history"] .expense-history-edit').click();
  await expect(page.locator('#txDialog')).toBeVisible();
  await expect(page.locator('#txType')).toHaveValue('tax');
  await page.locator('#txCancel').click();

  page.once('dialog',dialog=>dialog.accept());
  await card.locator('[data-expense-id="self-history"] .expense-history-delete').click();
  await expect(card.locator('[data-expense-id="self-history"]')).toHaveCount(0);

  await card.getByRole('button',{name:'変動費',exact:true}).click();
  await expect(card.locator('[data-expense-id="variable-history"]')).toBeVisible();
  await expect(card.locator('[data-expense-id="tax-history"]')).toHaveCount(0);

  await card.getByRole('button',{name:'固定費',exact:true}).click();
  await card.getByRole('button',{name:'予算設定へ'}).click();
  await expect(page.locator('section[data-panel="budget"]')).toHaveClass(/active/);
});


test('mobile expense history gap matches calendar gap', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  await page.locator('#mobileNav [data-tab="expense"]').click();
  const spacing = await page.evaluate(() => {
    const calendar = document.getElementById('expenseMonthCalendar');
    const history = document.querySelector('.expense-history-card');
    return {
      calendarBottom: getComputedStyle(calendar).marginBottom,
      historyTop: getComputedStyle(history).marginTop
    };
  });
  expect(spacing.calendarBottom).toBe('12px');
  expect(spacing.historyTop).toBe(spacing.calendarBottom);
});


test('donut canvases stay perfectly square on smartphone and iPad', async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await openApp(page);
    await page.waitForFunction(() => ['donutChart','variableDonut'].every(id => {
      const el=document.getElementById(id);
      if(!el)return false;
      const rect=el.getBoundingClientRect();
      return Math.abs(rect.width-rect.height)<=1 && el.width>0 && el.height>0 && el.width===el.height;
    }));
    for (const id of ['donutChart','variableDonut']) {
      const dims = await page.locator(`#${id}`).evaluate(el => {
        const rect = el.getBoundingClientRect();
        return { cssWidth: rect.width, cssHeight: rect.height, backingWidth: el.width, backingHeight: el.height };
      });
      expect(Math.abs(dims.cssWidth - dims.cssHeight)).toBeLessThanOrEqual(1);
      expect(dims.backingWidth).toBe(dims.backingHeight);
    }
  }
});


test('desktop expense weekly total row matches item row height and shows week sum', async ({ page }) => {
  const date=currentDateKey();
  await openApp(page,{transactions:[
    {id:'week-total-test',date,type:'variable',category:'セブンイレブン',item:'test',amount:4321,amountExpression:'4321',memo:''}
  ]});
  await page.locator('#tabs [data-tab="expense"]').click();

  const totalRows=page.locator('#expenseCalendarWrap .expense-week-total-row');
  expect(await totalRows.count()).toBeGreaterThan(0);

  const heights=await totalRows.evaluateAll(rows=>rows.map(row=>({
    total:row.getBoundingClientRect().height,
    previous:row.previousElementSibling?.getBoundingClientRect().height||0
  })));
  for(const pair of heights){
    expect(Math.abs(pair.total-pair.previous)).toBeLessThanOrEqual(1);
  }

  const weekTotals=page.locator('#expenseCalendarWrap .expense-week-total-row .expense-week-total-cell:last-child');
  await expect(weekTotals.filter({hasText:'¥4,321'})).toHaveCount(1);
});



test(`release assets use v${APP_VERSION} cache-busting URLs`, async ({ page }) => {
  await openApp(page);
  await expect(page.locator('link[rel="stylesheet"]')).toHaveAttribute('href', `style.css?v=${APP_VERSION}`);
  const appScripts = ['app-data.js', 'app-sync.js', 'app-charts.js', 'app-ui.js'];
  const sources = await page.locator('script[src^="app-"]').evaluateAll(scripts => scripts.map(script => script.getAttribute('src')));
  expect(sources).toEqual(appScripts.map(script => `${script}?v=${APP_VERSION}`));
});



test('release version metadata stays synchronized with package.json', async () => {
  const index = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
  const serviceWorker = fs.readFileSync(path.resolve(__dirname, '../sw.js'), 'utf8');
  const readme = fs.readFileSync(path.resolve(__dirname, '../README.md'), 'utf8');

  expect(index).toContain(`style.css?v=${APP_VERSION}`);
  for (const script of ['app-data.js', 'app-sync.js', 'app-charts.js', 'app-ui.js']) {
    expect(index).toContain(`${script}?v=${APP_VERSION}`);
    expect(serviceWorker).toContain(`${script}?v=${APP_VERSION}`);
  }
  expect(index).toContain(`v${APP_VERSION} Stable`);
  expect(serviceWorker).toContain(`kakeibo-v${APP_VERSION}-stable`);
  expect(serviceWorker).toContain(`style.css?v=${APP_VERSION}`);
  expect(readme).toMatch(new RegExp(`^# 家計簿Webアプリ v${APP_VERSION.replaceAll('.', '\\.')} Stable`, 'm'));
  expect(readme).toContain(`## v${APP_VERSION} Stable`);
});



test('service worker activation deletes only old kakeibo caches', async () => {
  const source=fs.readFileSync(path.resolve(__dirname,'../sw.js'),'utf8');
  const handlers={};
  const deleted=[];
  const context={
    self:{
      addEventListener:(name,handler)=>{handlers[name]=handler},
      skipWaiting:async()=>{},
      clients:{claim:async()=>{}},
      location:{origin:'https://kazutake1.github.io'}
    },
    caches:{
      open:async()=>({addAll:async()=>{},put:async()=>{}}),
      keys:async()=>[`kakeibo-v${APP_VERSION}-stable`,'kakeibo-v0.0.0-stable','forum-calendar-v1','another-app-v3'],
      delete:async key=>{deleted.push(key);return true},
      match:async()=>undefined
    },
    fetch:async()=>{throw new Error('fetch is not used by activation')},
    URL
  };
  vm.runInNewContext(source,context);
  let activation;
  handlers.activate({waitUntil:promise=>{activation=promise}});
  await activation;
  expect(deleted).toEqual(['kakeibo-v0.0.0-stable']);
});



test('budget-only and category-only changes count as meaningful local sync data', async ({ page }) => {
  await openApp(page);
  const result=await page.evaluate(()=>{
    state=normalizeState({});
    ensureBudgetMonth(ym());
    const untouchedDefaults=hasMeaningfulLocalData();
    state.budgets[ym()].variable['外食']=1234;
    const budgetOnly=hasMeaningfulLocalData();
    state=normalizeState({});
    state.categories.variable.push('追加項目');
    const categoryOnly=hasMeaningfulLocalData();
    return {untouchedDefaults,budgetOnly,categoryOnly}
  });
  expect(result).toEqual({untouchedDefaults:false,budgetOnly:true,categoryOnly:true});
});



test('cloud sync detects a newer version before overwriting it', async ({ page }) => {
  await openApp(page);
  const result=await page.evaluate(async()=>{
    syncUser={id:'sync-version-user',email:'sync@example.com'};
    syncCloudVersion=4;
    syncBusy=false;
    syncPending=false;
    state.transactions=[{id:'local-new',date:'2026-09-18',type:'variable',category:'外食',item:'local',amount:800,amountExpression:'800',memo:''}];
    const calls=[];
    let patchCount=0;
    let conflictMessage='';
    supabaseFetch=async(requestPath,options)=>{
      const body=JSON.parse(options.body);
      calls.push({path:requestPath,method:options.method,body});
      patchCount+=1;
      if(patchCount===1)return {ok:true,status:200,json:async()=>[]};
      return {ok:true,status:200,json:async()=>[{state:body.state,updated_at:'2026-09-18T01:00:00Z',sync_version:6}]}
    };
    fetchCloudState=async()=>({state:{transactions:[{id:'cloud-new',date:'2026-09-18',type:'variable',category:'外食',item:'cloud',amount:900,amountExpression:'900',memo:''}],budgets:{},categories:{}},updated_at:'2026-09-18T00:59:00Z',sync_version:5});
    chooseSyncSource=async message=>{conflictMessage=message;return 'local'};
    const ok=await uploadCloudState();
    return {ok,calls,conflictMessage,version:syncCloudVersion}
  });
  expect(result.ok).toBe(true);
  expect(result.calls).toHaveLength(2);
  expect(result.calls.every(call=>call.method==='PATCH')).toBe(true);
  expect(result.calls[0].path).toContain('sync_version=eq.4');
  expect(result.calls[0].body.sync_version).toBe(5);
  expect(result.calls[1].path).toContain('sync_version=eq.5');
  expect(result.calls[1].body.sync_version).toBe(6);
  expect(result.conflictMessage).toContain('別の端末');
  expect(result.version).toBe(6);
});



test('cloud sync direction uses dedicated two-choice dialog', async ({ page }) => {
  await openApp(page);
  const resultPromise=page.evaluate(() => chooseSyncSource('どちらのデータを最新データとして使用するか選んでください。'));
  const dialog=page.locator('#syncChoiceDialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('同期するデータを選んでください');
  await expect(dialog).toContainText('クラウドのデータを使う');
  await expect(dialog).toContainText('この端末のデータを使う');
  await expect(dialog).toContainText('この端末の現在のデータは上書きされます');
  await expect(dialog).toContainText('クラウドの現在のデータは上書きされます');
  await expect(dialog.locator('button')).toHaveCount(2);
  await dialog.locator('#syncUseCloudBtn').click();
  expect(await resultPromise).toBe('cloud');

  const localPromise=page.evaluate(() => chooseSyncSource());
  await expect(dialog).toBeVisible();
  await dialog.locator('#syncUseLocalBtn').click();
  expect(await localPromise).toBe('local');
});



test('existing signed-in session can use sync choice dialog during startup', async ({ page }) => {
  await openApp(page);
  const date=currentDateKey();
  await page.evaluate(({date})=>{
    document.getElementById('syncUseCloudBtn').onclick=null;
    document.getElementById('syncUseLocalBtn').onclick=null;
    state.transactions=[{id:'local-startup',date,type:'variable',category:'セブンイレブン',item:'local',amount:100,amountExpression:'100',memo:''}];
    localStorage.setItem('kakeibo-v1',JSON.stringify(state));
    localStorage.setItem('kakeibo-sync-session-v1',JSON.stringify({access_token:'test-access',refresh_token:'test-refresh'}));
    fetchSyncUser=async()=>{
      syncUser={id:'startup-sync-user',email:'test@example.com'};
      return syncUser;
    };
    fetchCloudState=async()=>({state:{transactions:[],budgets:{},categories:{}},updated_at:'2026-09-06T00:00:00Z',sync_version:1});
    window.__startupSyncInit=initCloudSync();
  },{date});

  const dialog=page.locator('#syncChoiceDialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('#syncUseCloudBtn').click();
  await expect(dialog).not.toBeVisible();
  await page.evaluate(()=>window.__startupSyncInit);
  await expect(page.locator('#syncStatusTitle')).toHaveText('同期済み');
  await expect(page.locator('#syncStatusDetail')).toHaveText('クラウドのデータを読み込みました');
});



test('light mode daily-history delete button is red', async ({ page }) => {
  const date=currentDateKey();
  await openApp(page, { transactions: [
    {id:'delete-red-test',date,type:'variable',category:'セブンイレブン',item:'test',amount:213,amountExpression:'213',memo:''}
  ]});
  await page.evaluate(({date})=>{
    const [y,m,d]=date.split('-').map(Number);
    mobileDailyDate=new Date(y,m-1,d);
    dailyHistoryType='variable';
    dailyHistoryCategory='セブンイレブン';
    renderDailyHistory();
    dailyHistoryDialog.showModal();
  },{date});
  const button=page.locator('#dailyHistoryDialog .history-delete');
  await expect(button).toBeVisible();
  const styles=await button.evaluate(el=>{
    const s=getComputedStyle(el);
    return {color:s.color,borderColor:s.borderColor,background:s.backgroundColor};
  });
  expect(styles.color).toBe('rgb(220, 38, 38)');
  expect(styles.borderColor).toBe('rgb(254, 202, 202)');
  expect(styles.background).toBe('rgb(255, 241, 242)');
});



test('donut legends use ordered gradients and weekly chart uses the cool page palette', async ({ page }) => {
  await openApp(page);
  const colors=await page.evaluate(()=>{
    const weeklyLight=Array.from({length:10},(_,i)=>chartColor(i));
    document.body.classList.add('dark-mode');
    const weeklyDark=Array.from({length:10},(_,i)=>chartColor(i));
    document.body.classList.remove('dark-mode');
    return {
      expense:Array.from({length:6},(_,i)=>donutColor('donutChart',i,6)),
      variable:Array.from({length:10},(_,i)=>donutColor('variableDonut',i,10)),
      weeklyLight,
      weeklyDark
    };
  });

  expect(colors.expense[0]).toBe('hsl(216, 82%, 34%)');
  expect(colors.expense.at(-1)).toBe('hsl(216, 82%, 76%)');
  expect(new Set(colors.expense).size).toBe(colors.expense.length);
  expect(colors.variable[0]).toBe('hsl(145, 62%, 28%)');
  expect(colors.variable.at(-1)).toBe('hsl(145, 62%, 76%)');
  expect(new Set(colors.variable).size).toBe(colors.variable.length);
  expect(colors.weeklyLight).toEqual(['#1769d2','#18a6c9','#438ee8','#2ab7a9','#5aaef2','#557dc5','#45c5d0','#7399df','#7bb9da','#8ed9df']);
  expect(colors.weeklyDark).toEqual(['#5fa8ff','#45d2ec','#7bb5ff','#55d7c4','#8bc8ff','#91aef4','#75e0e9','#a3baff','#9ed4ed','#b0edf0']);
  expect(new Set(colors.weeklyLight).size).toBe(10);
  expect(new Set(colors.weeklyDark).size).toBe(10);
  expect(colors.weeklyLight).not.toContain('#ef4444');
  expect(colors.weeklyDark).not.toContain('#ef4444');

  const expenseDots=page.locator('#donutLegend .donut-legend-name .dot');
  const variableDots=page.locator('#variableLegend .donut-legend-name .dot');
  await expect(expenseDots).toHaveCount(6);
  await expect(variableDots).toHaveCount(10);
  const expenseComputed=await expenseDots.evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).backgroundColor));
  const variableComputed=await variableDots.evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).backgroundColor));
  expect(new Set(expenseComputed).size).toBe(6);
  expect(new Set(variableComputed).size).toBe(10);
});



test('desktop expense daily and weekly totals turn red only above limits', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    current = new Date(2026, 8, 1);
    state.transactions = [
      {id:'limit-2000',date:'2026-09-01',type:'variable',category:'セブンイレブン',item:'boundary',amount:2000,amountExpression:'2000',memo:''},
      {id:'limit-2001',date:'2026-09-02',type:'variable',category:'セブンイレブン',item:'over',amount:2001,amountExpression:'2001',memo:''},
      {id:'week-over',date:'2026-09-03',type:'variable',category:'セブンイレブン',item:'week over',amount:10000,amountExpression:'10000',memo:''},
      {id:'week-boundary',date:'2026-09-07',type:'variable',category:'セブンイレブン',item:'week boundary',amount:14000,amountExpression:'14000',memo:''}
    ];
    renderCalendar();
  });

  const rows = page.locator('#expenseCalendarWrap .expense-week-total-row');
  await expect(rows).toHaveCount(5);

  const firstWeek = rows.nth(0);
  const dayAt2000 = firstWeek.locator('td').nth(2).locator('b');
  const dayAt2001 = firstWeek.locator('td').nth(3).locator('b');
  const firstWeekTotal = firstWeek.locator('td').last().locator('b');

  await expect(dayAt2000).toHaveText('¥2,000');
  await expect(dayAt2000).not.toHaveClass(/expense-limit-over/);
  await expect(dayAt2001).toHaveText('¥2,001');
  await expect(dayAt2001).toHaveClass(/expense-limit-over/);
  await expect(firstWeekTotal).toHaveText('¥14,001');
  await expect(firstWeekTotal).toHaveClass(/expense-limit-over/);

  const red = await dayAt2001.evaluate(el => getComputedStyle(el).color);
  expect(red).toBe('rgb(220, 38, 38)');

  const secondWeekTotal = rows.nth(1).locator('td').last().locator('b');
  await expect(secondWeekTotal).toHaveText('¥14,000');
  await expect(secondWeekTotal).not.toHaveClass(/expense-limit-over/);
});

test('PC and iPad expense calendar includes variable, self-investment, and special expenses only', async ({ page }) => {
  const date='2026-09-17';
  const transactions=[
    {id:'calendar-variable',date,type:'variable',category:'セブンイレブン',item:'variable',amount:100,amountExpression:'100',memo:''},
    {id:'calendar-self',date,type:'self',category:'書籍',item:'self',amount:200,amountExpression:'200',memo:''},
    {id:'calendar-special',date,type:'special',category:'特別支出',item:'special',amount:300,amountExpression:'300',memo:''},
    {id:'calendar-fixed',date,type:'fixed',category:'通信費',item:'fixed',amount:400,amountExpression:'400',memo:''},
    {id:'calendar-tax',date,type:'tax',category:'所得税',item:'tax',amount:500,amountExpression:'500',memo:''}
  ];
  for(const viewport of [{width:820,height:900},{width:1440,height:900}]){
    await page.setViewportSize(viewport);
    await openApp(page,{transactions});
    await page.locator('#tabs [data-tab="expense"]').click();
    await page.evaluate(()=>{current=new Date(2026,8,1);renderCalendar()});

    await expect(page.locator('#expenseCalendarWrap tr[data-calendar-type="variable"]')).toHaveCount(50);
    await expect(page.locator('#expenseCalendarWrap tr[data-calendar-type="self"]')).toHaveCount(20);
    await expect(page.locator('#expenseCalendarWrap tr[data-calendar-type="special"]')).toHaveCount(5);
    await expect(page.locator('#expenseCalendarWrap tr[data-calendar-type="fixed"]')).toHaveCount(0);
    await expect(page.locator('#expenseCalendarWrap tr[data-calendar-type="tax"]')).toHaveCount(0);
    await expect(page.locator('#expenseCalendarWrap .cal-cat-type')).toHaveCount(0);
    const selfItemLabels=await page.locator('#expenseCalendarWrap tr[data-calendar-type="self"]',{hasText:'書籍'}).locator('.cal-cat').allTextContents();
    expect(selfItemLabels).toEqual(Array(5).fill('書籍'));
    expect(selfItemLabels.join('')).not.toContain('自己投資');
    await expect(page.locator('#expenseCalendarWrap tr[data-calendar-type="self"]', {hasText:'¥200'})).toHaveCount(1);
    await expect(page.locator('#expenseCalendarWrap tr[data-calendar-type="special"]', {hasText:'¥300'})).toHaveCount(1);
    await expect(page.locator('#expenseCalendarWrap .expense-week-total-row', {hasText:'¥600'})).toHaveCount(1);

    const learningRow=page.locator('#expenseCalendarWrap tr[data-calendar-type="self"]',{hasText:'学習'}).filter({has:page.locator('td[onclick*="2026-09-17"]')});
    await learningRow.locator('td[onclick*="2026-09-17"]').click();
    await expect(page.locator('#txDialog')).toBeVisible();
    await expect(page.locator('#txType')).toHaveValue('self');
    await expect(page.locator('#txCategory')).toHaveValue('学習');
    await page.locator('#txCancel').click();
  }
});



test('weekly chart keeps stable canvas size after hidden-panel redraws on iPad and PC', async ({ page }) => {
  for (const viewport of [
    { width: 900, height: 768, expectedHeight: 350 },
    { width: 1024, height: 768, expectedHeight: 400 },
    { width: 1440, height: 900, expectedHeight: 400 }
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openApp(page);
    await page.waitForTimeout(250);

    const before = await page.locator('#weeklyChart').evaluate(el => {
      const rect = el.getBoundingClientRect();
      return { cssWidth: rect.width, cssHeight: rect.height, backingWidth: el.width, backingHeight: el.height, dpr: devicePixelRatio || 1 };
    });
    expect(Math.abs(before.cssHeight - viewport.expectedHeight)).toBeLessThanOrEqual(1);
    expect(Math.abs(before.backingWidth - Math.round(before.cssWidth * before.dpr))).toBeLessThanOrEqual(1);
    expect(Math.abs(before.backingHeight - Math.round(before.cssHeight * before.dpr))).toBeLessThanOrEqual(1);

    await page.locator('#tabs [data-tab="expense"]').click();
    const hiddenDrawResult = await page.evaluate(() => drawCharts());
    expect(hiddenDrawResult).toBe(false);
    const hiddenBacking = await page.locator('#weeklyChart').evaluate(el => ({ width: el.width, height: el.height }));
    expect(hiddenBacking.width).toBe(before.backingWidth);
    expect(hiddenBacking.height).toBe(before.backingHeight);

    await page.evaluate(() => render());
    await page.waitForTimeout(180);
    const afterHiddenRender = await page.locator('#weeklyChart').evaluate(el => ({ width: el.width, height: el.height }));
    expect(afterHiddenRender.width).toBe(before.backingWidth);
    expect(afterHiddenRender.height).toBe(before.backingHeight);

    await page.locator('#tabs [data-tab="dashboard"]').click();
    await page.waitForTimeout(250);
    const after = await page.locator('#weeklyChart').evaluate(el => {
      const rect = el.getBoundingClientRect();
      return { cssWidth: rect.width, cssHeight: rect.height, backingWidth: el.width, backingHeight: el.height, dpr: devicePixelRatio || 1 };
    });
    expect(Math.abs(after.cssHeight - viewport.expectedHeight)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.backingWidth - Math.round(after.cssWidth * after.dpr))).toBeLessThanOrEqual(1);
    expect(Math.abs(after.backingHeight - Math.round(after.cssHeight * after.dpr))).toBeLessThanOrEqual(1);

    await page.evaluate(() => { scheduleChartDraw(); scheduleChartDraw(); scheduleChartDraw(); });
    await page.waitForTimeout(250);
    const repeated = await page.locator('#weeklyChart').evaluate(el => ({
      cssWidth: el.getBoundingClientRect().width,
      cssHeight: el.getBoundingClientRect().height,
      backingWidth: el.width,
      backingHeight: el.height
    }));
    expect(Math.abs(repeated.cssWidth - after.cssWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(repeated.cssHeight - after.cssHeight)).toBeLessThanOrEqual(1);
    expect(repeated.backingWidth).toBe(after.backingWidth);
    expect(repeated.backingHeight).toBe(after.backingHeight);
  }
});

test('weekly chart draws the budget overlay after the stacked bars', async () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../app-charts.js'), 'utf8');
  const start = source.indexOf('function drawWeekly()');
  const end = source.indexOf('const CHART_COLORS_LIGHT', start);
  const drawWeeklySource = source.slice(start, end);
  const barDraw = drawWeeklySource.indexOf('ctx.fillRect(x,yBottom,barW,bh)');
  const budgetLineDraw = drawWeeklySource.indexOf("ctx.strokeStyle='#ef4444'");

  expect(barDraw).toBeGreaterThan(-1);
  expect(budgetLineDraw).toBeGreaterThan(barDraw);
});

test('weekly budget line stays visible above bars on iPad and PC', async ({ page }) => {
  for (const viewport of [
    { width: 900, height: 768 },
    { width: 1440, height: 900 }
  ]) {
    await page.setViewportSize(viewport);
    await openApp(page);

    const result = await page.evaluate(() => {
      current = new Date(2026, 8, 1);
      state.transactions = [{
        id: 'weekly-line-overlay',
        date: '2026-09-01',
        type: 'variable',
        category: 'セブンイレブン',
        item: 'line overlay',
        amount: 16800,
        amountExpression: '16800',
        memo: ''
      }];
      render();
      drawWeekly();

      const canvas = document.getElementById('weeklyChart');
      const context = canvas.getContext('2d');
      const rect = canvas.getBoundingClientRect();
      const dpr = devicePixelRatio || 1;
      const left = 54, right = 14, top = 26, bottom = 40;
      const plotWidth = rect.width - left - right;
      const plotHeight = rect.height - top - bottom;
      const max = 16800;
      const budgetY = top + plotHeight - (14000 / max * plotHeight);
      const slot = plotWidth / 5;
      const barWidth = Math.min(58, slot * .58);
      const barX = left + (slot - barWidth) / 2;
      const image = context.getImageData(
        Math.floor((barX + 2) * dpr),
        Math.floor((budgetY - 2) * dpr),
        Math.max(1, Math.floor((barWidth - 4) * dpr)),
        Math.max(1, Math.ceil(5 * dpr))
      );
      let redPixels = 0;
      for (let i = 0; i < image.data.length; i += 4) {
        if (image.data[i] > 210 && image.data[i + 1] < 110 && image.data[i + 2] < 110 && image.data[i + 3] > 180) {
          redPixels++;
        }
      }
      return { redPixels, canvasWidth: rect.width, canvasHeight: rect.height };
    });

    expect(result.canvasWidth).toBeGreaterThan(100);
    expect(result.canvasHeight).toBeGreaterThan(100);
    expect(result.redPixels).toBeGreaterThan(4);
  }
});



test('smartphone separates variable quick entry from full entry', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);

  const quick=page.locator('#mobileQuickEntry');
  const full=page.locator('#mobileFullEntry');
  await expect(quick).toBeVisible();
  await expect(full).toBeVisible();
  await expect(quick).toContainText('今日の変動費を入力');
  await expect(quick.locator('#quickSaveBtn')).toHaveText('今日の変動費を保存');
  await expect(quick.locator('#quickFullBtn')).toHaveCount(0);
  await expect(full.locator('.mobile-full-head strong')).toHaveText('全項目を入力');
  await expect(full.locator('.mobile-full-badge')).toHaveCount(0);
  await expect(full.locator('#quickFullBtn')).toHaveText('入力画面を開く');

  await full.locator('#quickFullBtn').click();
  await expect(page.locator('#txDialog')).toBeVisible();
  const typeLabels=await page.locator('#txType option').allTextContents();
  expect(typeLabels).toContain('収入');
  expect(typeLabels).toContain('固定費');
  expect(typeLabels).toContain('変動費');

  await page.locator('#txCancel').click();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(full).toBeHidden();
});



test('overview keeps explanations removed and shows only total variable budget usage bar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const date=currentDateKey();
  await openApp(page,{transactions:[
    {id:'variable-budget-bar-test',date,type:'variable',category:'セブンイレブン',item:'test',amount:25000,amountExpression:'25000',memo:''}
  ]});

  const cards=page.locator('#summaryCards .metric');
  await expect(cards).toHaveCount(5);
  await expect(page.locator('.overview-info-btn')).toHaveCount(0);
  await expect(page.locator('#overviewInfoDialog')).toHaveCount(0);
  await expect(page.locator('#mobileFullEntry .mobile-full-note')).toHaveCount(0);

  await expect(cards.nth(0).locator('.sub')).toHaveCount(0);
  await expect(cards.nth(1).locator('.sub')).toHaveCount(0);
  await expect(cards.nth(3).locator('.sub')).toHaveCount(0);
  await expect(cards.nth(2).locator('.sub')).toHaveCount(0);
  await expect(cards.nth(4).locator('.sub')).toBeVisible();

  await expect(page.locator('#summaryCards .variable-budget-bar')).toHaveCount(1);
  const bar=cards.nth(4).locator('.variable-budget-bar');
  await expect(bar).toHaveAttribute('aria-label','変動費の予算消化 50%');
  const width=await bar.locator('span').evaluate(el=>parseFloat(getComputedStyle(el).width));
  const total=await bar.evaluate(el=>parseFloat(getComputedStyle(el).width));
  expect(Math.abs(width/total-0.5)).toBeLessThan(0.03);
});


test('reference visual theme applies on phone, tablet and PC', async ({ page }) => {
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({width,height:900});
    await openApp(page);
    const look=await page.evaluate(() => ({
      cardBg:getComputedStyle(document.querySelector('#summaryCards .metric')).backgroundColor,
      accent:getComputedStyle(document.body).getPropertyValue('--accent').trim(),
      cardBgAll:getComputedStyle(document.querySelector('.grid>.card')).backgroundColor,
      buttonBg:getComputedStyle(document.querySelector('#addTxBtn')).backgroundImage,
      bodyBg:getComputedStyle(document.body).backgroundImage,
      theme:getComputedStyle(document.body).getPropertyValue('--card').trim()
    }));
    expect(look.cardBg).toBe('rgb(255, 255, 255)');
    expect(look.cardBgAll).toBe('rgb(255, 255, 255)');
    expect(look.theme).toBe('#ffffff');
    expect(look.accent).toBe('#277be8');
    expect(look.buttonBg).toContain('linear-gradient');
    expect(look.bodyBg).toContain('linear-gradient');
    await expect(page.locator('#summaryCards .metric')).toHaveCount(5);
    await expect(page.locator('#summaryCards .metric:visible')).toHaveCount(width<=700?5:4);
    await expect(page.locator('#mobileFullEntry #quickFullBtn')).toHaveText('入力画面を開く');
  }
});

test('reference visual theme preserves dark mode and red deficit', async ({ page }) => {
  await page.setViewportSize({width:1024,height:900});
  await openApp(page,{theme:'dark'});
  const look=await page.evaluate(() => ({
    card:getComputedStyle(document.querySelector('#summaryCards .metric')).backgroundColor,
    balance:getComputedStyle(document.querySelector('#summaryCards .metric:nth-child(3)')).backgroundColor,
    deficit:getComputedStyle(document.querySelector('#summaryCards .metric:nth-child(3) .value')).color
  }));
  expect(look.card).toBe('rgb(23, 40, 62)');
  expect(look.balance).toBe(look.card);
  expect(look.deficit).toBe('rgb(255, 107, 107)');
});


test('approved summary design: four cards have equal heights and no bar-chart decorations', async ({ page }) => {
  for(const width of [390,430,820,1440]){
    await page.setViewportSize({width,height:900});
    await openApp(page);
    const cards=page.locator('#summaryCards .metric');
    const heights=await cards.evaluateAll(items=>items.slice(0,4).map(el=>el.getBoundingClientRect().height));
    expect(Math.max(...heights)-Math.min(...heights)).toBeLessThanOrEqual(1);
    await expect(cards.locator('.metric-icon')).toHaveCount(5);
    await expect(cards.locator('.metric-icon svg')).toHaveCount(5);
    await expect(page.locator('#summaryCards .metric-heading .three-bars')).toHaveCount(0);
    await expect(cards.nth(2).locator('.sub')).toHaveCount(0);
    await expect(cards.nth(4).locator('.variable-budget-bar')).toHaveCount(1);
  }
});

test('approved summary design: deficit has red border and amount but neutral background', async ({page})=>{
  for(const theme of ['light','dark']){
    await page.setViewportSize({width:390,height:844});
    await openApp(page,{theme});
    const visual=await page.locator('#summaryCards .metric').nth(2).evaluate(el=>({
      background:getComputedStyle(el).backgroundColor,
      comparison:getComputedStyle(el.previousElementSibling).backgroundColor,
      border:getComputedStyle(el).borderTopColor,
      amount:getComputedStyle(el.querySelector('.value')).color,
      text:el.textContent
    }));
    expect(visual.background).toBe(visual.comparison);
    expect(visual.border).toBe(theme==='light'?'rgb(220, 38, 38)':'rgb(255, 107, 107)');
    expect(visual.amount).toBe(visual.border);
    expect(visual.text).not.toContain('赤字');
  }
});


test('iPhone overview cards are all exactly 80px with aligned variable remaining budget', async ({page})=>{
  for(const width of [320,375,390,430]){
    await page.setViewportSize({width,height:844});
    await openApp(page);
    const geometry=await page.locator('#summaryCards').evaluate(root=>{
      const cards=[...root.querySelectorAll('.metric')];
      const fifth=cards[4];
      const amount=fifth.querySelector('.value').getBoundingClientRect();
      const remaining=fifth.querySelector('.sub').getBoundingClientRect();
      const bar=fifth.querySelector('.variable-budget-bar').getBoundingClientRect();
      return {
        heights:cards.map(el=>el.getBoundingClientRect().height),
        rightGap:bar.right-remaining.right,
        rowGap:Math.abs((amount.top+amount.bottom)/2-(remaining.top+remaining.bottom)/2),
        cardRight:fifth.getBoundingClientRect().right,
        barRight:bar.right,
        valueBottoms:cards.slice(0,4).map(el=>({bottom:el.querySelector('.value').getBoundingClientRect().bottom,card:el.getBoundingClientRect().bottom})),
        summaryOverflow:root.scrollWidth-root.clientWidth,
        variableTop:fifth.getBoundingClientRect().top,
        variableBottom:fifth.getBoundingClientRect().bottom,
        titleTop:fifth.querySelector('.metric-heading').getBoundingClientRect().top,
        barTop:bar.top,
        barBottom:bar.bottom,
        amountBottom:amount.bottom,
        remainingBottom:remaining.bottom
      };
    });
    for(const h of geometry.heights.slice(0,4))expect(Math.abs(h-80)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.heights[4]-80)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.rightGap)).toBeLessThanOrEqual(1);
    expect(geometry.rowGap).toBeLessThanOrEqual(3);
    expect(geometry.summaryOverflow).toBeLessThanOrEqual(1);
    for(const entry of geometry.valueBottoms)expect(entry.bottom).toBeLessThanOrEqual(entry.card-4);
    expect(geometry.barRight).toBeLessThan(geometry.cardRight);
    expect(geometry.titleTop).toBeGreaterThanOrEqual(geometry.variableTop);
    expect(geometry.barTop).toBeGreaterThan(geometry.amountBottom);
    expect(geometry.barTop).toBeGreaterThan(geometry.remainingBottom);
    expect(geometry.barBottom).toBeLessThanOrEqual(geometry.variableBottom-4);
  }
});

test('iPad and desktop show four equal overview cards and hide the variable card',async ({page})=>{
  for(const width of [820,1024,1440]){
    await page.setViewportSize({width,height:900});
    await openApp(page);
    const cardGeometry=await page.locator('#summaryCards .metric').evaluateAll(items=>items.slice(0,4).map(el=>{
      const card=el.getBoundingClientRect();
      const value=el.querySelector('.value').getBoundingClientRect();
      return {height:card.height,bottomGap:card.bottom-value.bottom};
    }));
    const heights=cardGeometry.map(card=>card.height);
    for(const card of cardGeometry){
      expect(card.height).toBeLessThan(130);
      expect(card.bottomGap).toBeGreaterThanOrEqual(14);
      expect(card.bottomGap).toBeLessThanOrEqual(22);
    }
    await expect(page.locator('#summaryCards .metric:visible')).toHaveCount(4);
    await expect(page.locator('#summaryCards .metric[data-summary-key="variable"]')).toBeHidden();
    const geometry=await page.locator('#summaryCards').evaluate(root=>{
      const visible=[...root.querySelectorAll('.metric')].filter(card=>getComputedStyle(card).display!=='none');
      return {
        columns:getComputedStyle(root).gridTemplateColumns.split(' ').length,
        widths:visible.map(card=>card.getBoundingClientRect().width),
        tops:visible.map(card=>card.getBoundingClientRect().top),
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
      };
    });
    expect(geometry.columns).toBe(4);
    expect(Math.max(...geometry.widths)-Math.min(...geometry.widths)).toBeLessThanOrEqual(1);
    expect(Math.max(...geometry.tops)-Math.min(...geometry.tops)).toBeLessThanOrEqual(1);
    expect(geometry.overflow).toBeLessThanOrEqual(1);
  }
});


test('iPhone four compact summary cards have breathing room between title and amount', async ({page})=>{
  for(const theme of ['light','dark']){
    for(const width of [320,375,390,430]){
      await page.setViewportSize({width,height:844});
      await openApp(page,{theme});
      const geometry=await page.locator('#summaryCards .metric').evaluateAll(cards=>cards.map(card=>{
        const rect=card.getBoundingClientRect();
        const heading=card.querySelector('.metric-heading').getBoundingClientRect();
        const amount=card.querySelector('.value').getBoundingClientRect();
        const sub=card.querySelector('.sub')?.getBoundingClientRect();
        const style=getComputedStyle(card);
        return {height:rect.height,paddingTop:style.paddingTop,amountMargin:getComputedStyle(card.querySelector('.value')).marginTop,headingGap:amount.top-heading.bottom,amountBottom:amount.bottom,subBottom:sub?.bottom??0,cardBottom:rect.bottom};
      }));
      for(const card of geometry.slice(0,4)){
        expect(Math.abs(card.height-80)).toBeLessThanOrEqual(1);
        expect(card.paddingTop).toBe('6px');
        expect(card.amountMargin).toBe('6px');
        expect(card.headingGap).toBeGreaterThanOrEqual(5);
        expect(card.amountBottom).toBeLessThanOrEqual(card.cardBottom-2);
        if(card.subBottom)expect(card.subBottom).toBeLessThanOrEqual(card.cardBottom-2);
      }
      expect(Math.abs(geometry[4].height-80)).toBeLessThanOrEqual(1);
    }
  }
  for(const width of [820,1440]){
    await page.setViewportSize({width,height:900});
    await openApp(page);
    const card=page.locator('#summaryCards .metric').first();
    expect(await card.locator('.value').evaluate(el=>getComputedStyle(el).marginTop)).toBe('9px');
  }
});


test('selected shopping bag icon appears only as the fifth new icon without disrupting cards', async ({page})=>{
  for(const theme of ['light','dark']){
    for(const width of [320,390,430,820,1440]){
      await page.setViewportSize({width,height:900});
      await openApp(page,{theme});
      const cards=page.locator('#summaryCards .metric');
      await expect(cards.locator('.metric-icon')).toHaveCount(5);
      const variable=cards.nth(4);
      const icon=variable.locator('.metric-icon');
      const bag=icon.locator('svg path');
      if(width<=700)await expect(icon).toBeVisible();
      else await expect(variable).toBeHidden();
      await expect(bag).toHaveAttribute('d','M5 9h14l1 12H4L5 9ZM9 10V7a3 3 0 0 1 6 0v3');
      const geometry=await variable.evaluate(el=>{
        const card=el.getBoundingClientRect();
        const heading=el.querySelector('.metric-heading').getBoundingClientRect();
        const icon=el.querySelector('.metric-icon').getBoundingClientRect();
        const amount=el.querySelector('.value').getBoundingClientRect();
        const remainder=el.querySelector('.sub').getBoundingClientRect();
        const progress=el.querySelector('.variable-budget-bar').getBoundingClientRect();
        return {height:card.height,iconTop:icon.top,iconBottom:icon.bottom,headingTop:heading.top,headingBottom:heading.bottom,barTop:progress.top,barBottom:progress.bottom,amountBottom:amount.bottom,remainderBottom:remainder.bottom,rightGap:progress.right-remainder.right,cardBottom:card.bottom};
      });
      expect(geometry.iconTop).toBeGreaterThanOrEqual(geometry.headingTop-1);
      expect(geometry.iconBottom).toBeLessThanOrEqual(geometry.headingBottom+1);
      if(width<=700){
        expect(Math.abs(geometry.height-80)).toBeLessThanOrEqual(1);
        expect(geometry.barTop).toBeGreaterThan(geometry.amountBottom);
        expect(geometry.barTop).toBeGreaterThan(geometry.remainderBottom);
        expect(geometry.barBottom).toBeLessThanOrEqual(geometry.cardBottom-4);
        expect(Math.abs(geometry.rightGap)).toBeLessThanOrEqual(1);
      }
      await expect(variable.locator('.variable-budget-bar')).toHaveCount(1);
    }
  }
});


test('iPhone income redesign shows graph, action, total, exactly four default categories and keeps day editor',async({page})=>{
  for(const width of [320,375,390,430]){
    await page.setViewportSize({width,height:844});
    await openApp(page);
    await page.locator('#mobileNav [data-tab="income"]').click();
    await expect(page.locator('#incomeMonthCalendar')).toHaveCount(0);
    await expect(page.locator('#incomeMobileOverview')).toBeVisible();
    await expect(page.locator('#incomeDesktopOverview')).toBeHidden();
    await expect(page.locator('#incomeGraphBars .income-chart-column')).toHaveCount(9);
    await expect(page.locator('#incomeAddCard')).toBeVisible();
    await expect(page.locator('#incomeMiniTotal')).toHaveText('¥0');
    await expect(page.locator('#incomeMonthCategories .income-category-row')).toHaveCount(4);
    const names=await page.locator('#incomeMonthCategories .income-category-name strong').allTextContents();
    expect(names).toEqual(['給与','ボーナス','配当収入','その他の収入']);
    await expect(page.locator('#incomeDayTotal')).toBeVisible();
    await expect(page.locator('#incomeDatePicker')).toBeAttached();
    await expect(page.locator('#incomeCategoryList .day-cat-row')).toHaveCount(4);
    await expect(page.locator('.income-panel')).not.toContainText('1件あたりの平均収入');
    await expect(page.locator('.income-panel')).not.toContainText('収入履歴');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});

test('income chart uses actual amounts and updates selected period and month',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const now=new Date();
  const monthKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const previous=new Date(now.getFullYear(),now.getMonth()-1,1);
  const previousKey=`${previous.getFullYear()}-${String(previous.getMonth()+1).padStart(2,'0')}`;
  await openApp(page,{transactions:[
    {id:'income-this',date:monthKey+'-05',type:'income',category:'給与',item:'salary',amount:120000,amountExpression:'120000',memo:''},
    {id:'income-prev',date:previousKey+'-02',type:'income',category:'ボーナス',item:'bonus',amount:80000,amountExpression:'80000',memo:''}
  ]});
  await page.locator('#mobileNav [data-tab="income"]').click();
  await expect(page.locator('#incomeMiniTotal')).toHaveText('¥120,000');
  await expect(page.locator('#incomeMiniCount')).toHaveText('1件の入金');
  await expect(page.locator('#incomeGraphTotal')).toHaveText('¥120,000');
  await expect(page.locator('#incomeGraphCompare')).toHaveText('前月比 +50%');
  await expect(page.locator('#incomeGraphBars .selected')).toHaveAttribute('aria-label',new RegExp('120,000'));
  const columns=page.locator('#incomeGraphBars .income-chart-column');
  const index=await columns.evaluateAll(items=>items.findIndex(el=>el.classList.contains('selected')));
  expect(index).toBe(5);
  const zeros=await columns.evaluateAll(items=>items.filter(el=>el.getAttribute('aria-label').includes('¥0')).every(el=>el.querySelector('.income-chart-bar').style.height==='0%'));
  expect(zeros).toBe(true);
  await page.locator('#incomeGraphPeriod').selectOption('year');
  await expect(page.locator('#incomeGraphTotal')).toHaveText('¥200,000');
  await page.locator('#incomeGraphPeriod').selectOption('month');
  const keysBefore=await columns.evaluateAll(items=>items.map(el=>el.dataset.incomePeriod));
  const barHeightsBefore=await columns.evaluateAll(items=>items.map(el=>el.querySelector('.income-chart-bar').style.height));
  const dateBefore=await page.locator('#incomeDatePicker').inputValue();
  const headerBefore=await page.locator('#monthLabel').innerText();
  await columns.nth(4).click();
  await expect(columns.nth(4)).toHaveClass(/selected/);
  await expect(page.locator('#incomeGraphBars .selected')).toHaveCount(1);
  expect(await columns.evaluateAll(items=>items.map(el=>el.dataset.incomePeriod))).toEqual(keysBefore);
  expect(await columns.evaluateAll(items=>items.map(el=>el.querySelector('.income-chart-bar').style.height))).toEqual(barHeightsBefore);
  await expect(page.locator('#incomeGraphTotal')).toHaveText('¥80,000');
  await expect(page.locator('#incomeMiniTotal')).toHaveText('¥80,000');
  await expect(page.locator('#incomeMonthCategories .income-category-row').nth(1)).toContainText('¥80,000');
  await expect(page.locator('#monthLabel')).toHaveText(headerBefore);
  await expect(page.locator('#incomeDatePicker')).toHaveValue(dateBefore);
  await expect(page.locator('#expenseDatePicker')).toHaveValue(dateBefore);
  await expect(page.locator('#incomeGraphTitle')).toHaveText(`${previous.getFullYear()}年${previous.getMonth()+1}月の収入`);
});

test('income add button saves to income; category detail edits and deletes only selected income',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await openApp(page);
  await page.locator('#mobileNav [data-tab="income"]').click();
  await page.locator('#incomeAddCard').click();
  await expect(page.locator('#txDialog')).toBeVisible();
  await expect(page.locator('#txType')).toHaveValue('income');
  await page.locator('#txCategory').selectOption({label:'給与'});
  await page.locator('#txAmount').fill('10000+2000');
  await page.locator('#txForm button[type="submit"],#txForm .dialog-actions .primary').click();
  await expect(page.locator('#incomeMiniTotal')).toHaveText('¥12,000');
  await expect(page.locator('#incomeMonthCategories .income-category-row').first()).toContainText('¥12,000');
  await page.locator('#incomeMonthCategories .income-category-row').first().click();
  await expect(page.locator('#incomeMonthDialog')).toBeVisible();
  await expect(page.locator('#incomeMonthRows .income-month-row')).toHaveCount(1);
  await page.locator('#incomeMonthRows .income-month-actions button').first().click();
  await expect(page.locator('#txDialog')).toBeVisible();
  await page.locator('#txAmount').fill('15000');
  await page.locator('#txForm .dialog-actions .primary').click();
  await expect(page.locator('#incomeMiniTotal')).toHaveText('¥15,000');
  await page.locator('#incomeMonthCategories .income-category-row').first().click();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#incomeMonthRows .income-month-delete').click();
  await expect(page.locator('#incomeMiniTotal')).toHaveText('¥0');
  await expect(page.locator('#incomeMonthRows .income-month-row')).toHaveCount(0);
  await page.locator('#incomeMonthClose').click();
  await expect(page.locator('#incomeMonthDialog')).toBeHidden();
});

test('existing mobile income daily editing remains available and legacy category names survive normalization',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const now=currentDateKey();
  await openApp(page,{transactions:[{id:'old-income',date:now,type:'income',category:'ボーナス',item:'old',amount:23000,amountExpression:'23000',memo:''}]});
  await page.locator('#mobileNav [data-tab="income"]').click();
  const day=page.locator('#incomeCategoryList .day-cat-row').filter({hasText:'ボーナス'});
  await day.click();
  await expect(page.locator('#dailyHistoryDialog')).toBeVisible();
  await expect(page.locator('#dailyHistoryList .daily-history-row')).toHaveCount(1);
  await expect(page.locator('#dailyHistoryList .daily-history-row button')).toHaveCount(2);
  await page.locator('#dailyHistoryList button').first().click();
  await expect(page.locator('#dailyEntryDialog')).toBeVisible();
  await page.locator('#dailyEntryAmount').fill('25000');
  await page.locator('#dailyEntrySave').click();
  await expect(page.locator('#incomeMiniTotal')).toHaveText('¥25,000');
  await expect(page.locator('#dailyHistoryDialog')).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#dailyHistoryList .history-delete').click();
  await expect(page.locator('#incomeMiniTotal')).toHaveText('¥0');
  await page.evaluate(()=>{
    state=normalizeState({transactions:[],budgets:{},categories:{income:['給与','ボーナス','配当収入']}});
  });
  expect(await page.evaluate(()=>catsFor('income'))).toEqual(['給与','ボーナス','配当収入','その他の収入']);
});

test('iPad and PC use the approved income dashboard instead of the daily calendar',async({page})=>{
  const now=new Date();
  const monthKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const previous=new Date(now.getFullYear(),now.getMonth()-1,1);
  const previousKey=`${previous.getFullYear()}-${String(previous.getMonth()+1).padStart(2,'0')}`;
  const transactions=[
    {id:'desktop-salary',date:monthKey+'-15',type:'income',category:'給与',item:'会社給与',amount:280000,amountExpression:'280000',memo:''},
    {id:'desktop-side',date:monthKey+'-10',type:'income',category:'その他の収入',item:'副業',amount:30000,amountExpression:'30000',memo:''},
    {id:'desktop-dividend',date:monthKey+'-05',type:'income',category:'配当収入',item:'配当金',amount:15000,amountExpression:'15000',memo:''},
    {id:'desktop-previous',date:previousKey+'-12',type:'income',category:'給与',item:'前月給与',amount:300000,amountExpression:'300000',memo:''}
  ];
  for(const width of [820,1440]){
    await page.setViewportSize({width,height:900});
    await openApp(page,{transactions});
    await page.locator('#tabs [data-tab="income"]').click();
    await expect(page.locator('#incomeCalendarWrap')).toHaveCount(0);
    await expect(page.locator('#incomeDesktopOverview')).toBeVisible();
    await expect(page.locator('#incomeMobileOverview')).toBeHidden();
    await expect(page.locator('#mobileIncome')).toBeHidden();
    const monthBars=page.locator('#incomeDesktopGraphBars .income-desktop-chart-column');
    await expect(monthBars).toHaveCount(12);
    await expect(page.locator('#incomeDesktopGraphBars .selected')).toHaveAttribute('aria-label',/325,000/);
    await expect(page.locator('#incomeDesktopGraphBars .income-desktop-chart-value').filter({hasText:'¥325,000'})).toHaveCount(1);
    await expect(page.locator('#incomeDesktopGraphBars .income-desktop-chart-value').filter({hasText:'¥300,000'})).toHaveCount(0);
    const monthKeys=await monthBars.evaluateAll(items=>items.map(item=>item.dataset.incomeDesktopKey));
    expect(monthKeys.at(-1)).toBe(monthKey);
    const firstMonth=new Date(now.getFullYear(),now.getMonth()-11,1);
    expect(monthKeys[0]).toBe(`${firstMonth.getFullYear()}-${String(firstMonth.getMonth()+1).padStart(2,'0')}`);
    await expect(page.locator('#incomeDesktopTotal')).toHaveText('¥325,000');
    await expect(page.locator('#incomeDesktopCount')).toHaveText('3件の入金');
    await expect(page.locator('#incomeDesktopCompareLabel')).toHaveText('前月比');
    await expect(page.locator('#incomeDesktopCompare')).toHaveText('+8%');
    await expect(page.locator('#incomeDesktopCategories .income-desktop-category-row')).toHaveCount(4);
    await expect(page.locator('#incomeDesktopCategories .income-desktop-category-row',{hasText:'給与'})).toContainText('¥280,000');
    await expect(page.locator('#incomeDesktopCategories .income-desktop-category-row',{hasText:'ボーナス'})).toContainText('¥0');
    await expect(page.locator('#incomeDesktopRecentRows .income-desktop-recent-row')).toHaveCount(3);
    await expect(page.locator('#incomeDesktopRecentRows')).toContainText('会社給与');
    await expect(page.locator('[data-income-desktop-period="month"]')).toHaveClass(/active/);

    const layout=await page.evaluate(()=>{
      const graph=document.querySelector('.income-desktop-graph').getBoundingClientRect();
      const side=document.querySelector('.income-desktop-side').getBoundingClientRect();
      const categories=document.querySelector('.income-desktop-categories').getBoundingClientRect();
      const recent=document.querySelector('.income-desktop-recent').getBoundingClientRect();
      const bar=document.querySelector('.income-desktop-chart-bar').getBoundingClientRect();
      const column=document.querySelector('.income-desktop-chart-column').getBoundingClientRect();
      return {
        topGap:Math.abs(graph.top-side.top),
        bottomGap:Math.abs(categories.top-recent.top),
        sideBeforeGraph:side.right<=graph.left,
        barRatio:bar.width/column.width,
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
      };
    });
    expect(layout.topGap).toBeLessThanOrEqual(1);
    expect(layout.bottomGap).toBeLessThanOrEqual(1);
    expect(layout.sideBeforeGraph).toBe(true);
    expect(layout.barRatio).toBeLessThanOrEqual(.43);
    expect(layout.overflow).toBeLessThanOrEqual(1);

    await page.locator('[data-income-desktop-period="year"]').click();
    await expect(page.locator('[data-income-desktop-period="year"]')).toHaveClass(/active/);
    await expect(page.locator('#incomeDesktopCompareLabel')).toHaveText('前年比');
    await expect(page.locator('#incomeDesktopGraphBars .income-desktop-chart-column')).toHaveCount(6);
    await page.locator('[data-income-desktop-period="month"]').click();
    await page.locator('#incomeDesktopAdd').click();
    await expect(page.locator('#txDialog')).toBeVisible();
    await expect(page.locator('#txType')).toHaveValue('income');
    await page.locator('#txCancel').click();
    await page.locator('#incomeDesktopRecentRows .income-desktop-recent-row').first().locator('button').click();
    await expect(page.locator('#txDialog')).toBeVisible();
    await expect(page.locator('#txId')).toHaveValue('desktop-salary');
    await page.locator('#txCancel').click();
    await page.locator('#incomeDesktopViewAll').click();
    await expect(page.locator('#incomeMonthDialog')).toBeVisible();
    await expect(page.locator('#incomeMonthRows .income-month-row')).toHaveCount(3);
    await page.locator('#incomeMonthClose').click();
  }
});


test('iPhone graph taps keep the daily editor on January 31 and clamp new-entry dates to selected months',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await openApp(page,{transactions:[
    {id:'jan',date:'2026-01-02',type:'income',category:'給与',item:'salary',amount:10000,amountExpression:'10000',memo:''},
    {id:'dec',date:'2025-12-05',type:'income',category:'ボーナス',item:'bonus',amount:23000,amountExpression:'23000',memo:''},
    {id:'feb',date:'2026-02-01',type:'income',category:'配当収入',item:'dividend',amount:50000,amountExpression:'50000',memo:''}
  ]});
  await page.locator('#mobileNav [data-tab="income"]').click();
  await page.evaluate(()=>setMobileDailyDate(new Date(2026,0,31)));
  const bars=page.locator('#incomeGraphBars .income-chart-column');
  const originalKeys=await bars.evaluateAll(items=>items.map(el=>el.dataset.incomePeriod));
  await expect(page.locator('#incomeDatePicker')).toHaveValue('2026-01-31');
  await bars.nth(4).click();
  await expect(bars.nth(4)).toHaveClass(/selected/);
  await expect(page.locator('#incomeGraphTotal')).toHaveText('¥23,000');
  await expect(page.locator('#incomeMiniTotal')).toHaveText('¥23,000');
  await expect(page.locator('#monthLabel')).toHaveText('2026年1月');
  await expect(page.locator('#incomeDatePicker')).toHaveValue('2026-01-31');
  expect(await bars.evaluateAll(items=>items.map(el=>el.dataset.incomePeriod))).toEqual(originalKeys);
  await page.locator('#incomeAddCard').click();
  await expect(page.locator('#txDate')).toHaveValue('2025-12-31');
  await page.locator('#txCancel').click();
  await bars.nth(6).click();
  await expect(page.locator('#incomeMiniTotal')).toHaveText('¥50,000');
  await expect(page.locator('#incomeDatePicker')).toHaveValue('2026-01-31');
  await page.locator('#incomeAddCard').click();
  await expect(page.locator('#txDate')).toHaveValue('2026-02-28');
  await page.locator('#txCategory').selectOption({label:'その他の収入'});
  await page.locator('#txAmount').fill('5000');
  await page.locator('#txForm .dialog-actions .primary').click();
  await expect(page.locator('#incomeMiniTotal')).toHaveText('¥55,000');
  await expect(page.locator('#incomeDatePicker')).toHaveValue('2026-01-31');
  expect(await page.evaluate(()=>state.transactions.find(t=>t.type==='income'&&t.category==='その他の収入')?.date)).toBe('2026-02-28');
  await page.locator('#incomeNextBtn').click();
  await expect(page.locator('#incomeDatePicker')).toHaveValue('2026-02-01');
  await expect(page.locator('#monthLabel')).toHaveText('2026年2月');
  await expect(page.locator('#incomeGraphBars .income-chart-column').nth(5)).toHaveClass(/selected/);
});

test('iPhone annual selection keeps day fixed and aligns graph, total, categories and edit/delete detail to the same year',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const year=new Date().getFullYear();
  const last=year-1;
  await openApp(page,{transactions:[
    {id:'year-salary',date:`${year}-01-05`,type:'income',category:'給与',item:'salary',amount:100000,amountExpression:'100000',memo:''},
    {id:'year-bonus',date:`${year}-06-03`,type:'income',category:'ボーナス',item:'bonus',amount:30000,amountExpression:'30000',memo:''},
    {id:'prior-dividend',date:`${last}-12-03`,type:'income',category:'配当収入',item:'dividend',amount:70000,amountExpression:'70000',memo:''},
    {id:'not-income',date:`${last}-12-04`,type:'variable',category:'セブンイレブン',item:'expense',amount:1000,amountExpression:'1000',memo:''}
  ]});
  await page.locator('#mobileNav [data-tab="income"]').click();
  const originalDate=await page.locator('#incomeDatePicker').inputValue();
  const originalMonth=await page.locator('#monthLabel').innerText();
  await page.locator('#incomeGraphPeriod').selectOption('year');
  await expect(page.locator('#incomeGraphTotal')).toHaveText('¥130,000');
  await expect(page.locator('#incomeMiniTotal')).toHaveText('¥130,000');
  await expect(page.locator('#incomeMiniCount')).toHaveText('2件の入金');
  const bars=page.locator('#incomeGraphBars .income-chart-column');
  const axisBefore=await bars.evaluateAll(items=>items.map(el=>el.dataset.incomePeriod));
  await bars.nth(4).click();
  expect(await bars.evaluateAll(items=>items.map(el=>el.dataset.incomePeriod))).toEqual(axisBefore);
  await expect(bars.nth(4)).toHaveClass(/selected/);
  await expect(page.locator('#incomeGraphTitle')).toHaveText(`${last}年の収入`);
  await expect(page.locator('#incomeGraphTotal')).toHaveText('¥70,000');
  await expect(page.locator('#incomeMiniTotal')).toHaveText('¥70,000');
  await expect(page.locator('#incomeMiniCount')).toHaveText('1件の入金');
  await expect(page.locator('#incomeMonthCategories .income-category-row').nth(2)).toContainText(`${last}年の合計 ¥70,000`);
  await expect(page.locator('#incomeDatePicker')).toHaveValue(originalDate);
  await expect(page.locator('#monthLabel')).toHaveText(originalMonth);
  await page.locator('#incomeMonthCategories .income-category-row').nth(2).click();
  await expect(page.locator('#incomeMonthMeta')).toContainText(`${last}年 ・ 1件`);
  await expect(page.locator('#incomeMonthRows .income-month-row')).toHaveCount(1);
  await page.locator('#incomeMonthRows .income-month-actions button').first().click();
  await expect(page.locator('#txDialog')).toBeVisible();
  await expect(page.locator('#txDate')).toHaveValue(`${last}-12-03`);
  await page.locator('#txAmount').fill('75000');
  await page.locator('#txForm .dialog-actions .primary').click();
  await expect(page.locator('#incomeMiniTotal')).toHaveText('¥75,000');
  await page.locator('#incomeMonthCategories .income-category-row').nth(2).click();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#incomeMonthRows .income-month-delete').click();
  await expect(page.locator('#incomeMiniTotal')).toHaveText('¥0');
  await expect(page.locator('#incomeMonthRows .income-month-row')).toHaveCount(0);
  await page.locator('#incomeMonthClose').click();
  expect(await page.evaluate(()=>state.transactions.map(t=>t.id).sort())).toEqual(['not-income','year-bonus','year-salary']);
  await expect(page.locator('#incomeDatePicker')).toHaveValue(originalDate);
  await page.locator('#incomeGraphPeriod').selectOption('month');
  await expect(page.locator('#incomeGraphBars .income-chart-column').nth(5)).toHaveClass(/selected/);
  await expect(page.locator('#incomeDatePicker')).toHaveValue(originalDate);
});

test('iPhone graph selection survives data redraw and day changes inside the month, but month navigation resets its anchor',async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await openApp(page);
  await page.locator('#mobileNav [data-tab="income"]').click();
  await page.evaluate(()=>setMobileDailyDate(new Date(2026,4,15)));
  const bars=page.locator('#incomeGraphBars .income-chart-column');
  await bars.nth(4).click();
  await expect(bars.nth(4)).toHaveClass(/selected/);
  const selectedKey=await bars.nth(4).getAttribute('data-income-period');
  await page.evaluate(()=>render());
  await expect(bars.nth(4)).toHaveAttribute('data-income-period',selectedKey);
  await expect(bars.nth(4)).toHaveClass(/selected/);
  await page.locator('#incomeNextBtn').click();
  await expect(page.locator('#incomeDatePicker')).toHaveValue('2026-05-16');
  await expect(bars.nth(4)).toHaveClass(/selected/);
  await page.evaluate(()=>setMobileDailyDate(new Date(2026,5,1)));
  await expect(page.locator('#incomeDatePicker')).toHaveValue('2026-06-01');
  await expect(bars.nth(5)).toHaveAttribute('data-income-period','2026-06');
  await expect(bars.nth(5)).toHaveClass(/selected/);
  await expect(page.locator('#incomeGraphBars .selected')).toHaveCount(1);
});


test('iPhone expense calendar aligns dates regardless of whether an expense amount exists', async ({page})=>{
  const month=currentDateKey().slice(0,7);
  const spentDate=`${month}-05`;
  const emptyDate=`${month}-06`;
  const transactions=[{
    id:'expense-date-alignment',date:spentDate,type:'variable',category:'セブンイレブン',
    item:'calendar test',amount:850,amountExpression:'850',memo:''
  }];
  for(const theme of ['light','dark']){
    for(const width of [320,375,390,430]){
      await page.setViewportSize({width,height:844});
      await openApp(page,{theme,transactions});
      await page.locator('#mobileNav [data-tab="expense"]').click();
      const spent=page.locator(`#expenseMonthCalendar [data-expense-date="${spentDate}"]`);
      const empty=page.locator(`#expenseMonthCalendar [data-expense-date="${emptyDate}"]`);
      await expect(spent.locator('.mobile-cal-money')).toHaveText('¥850');
      await expect(empty.locator('.mobile-cal-money')).toHaveCount(0);
      const positions=await page.locator(`#expenseMonthCalendar [data-expense-date="${spentDate}"], #expenseMonthCalendar [data-expense-date="${emptyDate}"]`).evaluateAll(cells=>cells.map(cell=>{
        const cellRect=cell.getBoundingClientRect();
        const dateRect=cell.querySelector('.mobile-cal-date').getBoundingClientRect();
        const amount=cell.querySelector('.mobile-cal-money');
        const amountRect=amount?.getBoundingClientRect();
        return {dateTop:dateRect.top-cellRect.top,dateBottom:dateRect.bottom,amountTop:amountRect?.top??null,cellHeight:cellRect.height,display:getComputedStyle(cell).display};
      }));
      expect(positions).toHaveLength(2);
      expect(positions[0].display).toBe('flex');
      expect(positions[1].display).toBe('flex');
      expect(Math.abs(positions[0].dateTop-positions[1].dateTop)).toBeLessThanOrEqual(1);
      expect(Math.abs(positions[0].dateTop-7)).toBeLessThanOrEqual(1);
      expect(positions[0].amountTop).toBeGreaterThan(positions[0].dateBottom);
      expect(positions[0].cellHeight).toBeGreaterThanOrEqual(64);
      expect(positions[1].cellHeight).toBeGreaterThanOrEqual(64);
      await empty.click();
      await expect(page.locator('#expenseDateLabel')).toContainText('6日');
      await expect(page.locator('#expenseDayTotal')).toHaveText('¥0');
      await expect(spent.locator('.mobile-cal-money')).toHaveText('¥850');
    }
  }
  // No desktop/tablet layout rules were altered by the phone-only selector.
  for(const width of [820,1440]){
    await page.setViewportSize({width,height:900});
    await openApp(page,{transactions});
    await page.locator('#tabs [data-tab="expense"]').click();
    await expect(page.locator('#expenseMonthCalendar')).toBeHidden();
    await expect(page.locator('#expenseCalendarWrap .cal-table')).toBeVisible();
  }
});

test('iPhone expense calendar and summaries include self-investment and special expenses only', async ({page})=>{
  const date='2026-09-17';
  await page.setViewportSize({width:390,height:844});
  await openApp(page,{transactions:[
    {id:'iphone-variable',date,type:'variable',category:'セブンイレブン',item:'variable',amount:100,amountExpression:'100',memo:''},
    {id:'iphone-self',date,type:'self',category:'書籍',item:'self',amount:200,amountExpression:'200',memo:''},
    {id:'iphone-special',date,type:'special',category:'特別支出',item:'special',amount:300,amountExpression:'300',memo:''},
    {id:'iphone-fixed',date,type:'fixed',category:'通信費',item:'fixed',amount:400,amountExpression:'400',memo:''},
    {id:'iphone-tax',date,type:'tax',category:'所得税',item:'tax',amount:500,amountExpression:'500',memo:''}
  ]});
  await page.locator('#mobileNav [data-tab="expense"]').click();
  await page.evaluate(()=>setMobileDailyDate(new Date(2026,8,17)));

  await expect(page.locator('#expenseMonthCalendar [data-expense-date="2026-09-17"] .mobile-cal-money')).toHaveText('¥600');
  await expect(page.locator('#expenseDayTotal')).toHaveText('¥600');
  await expect(page.locator('#expenseSummaryDay')).toHaveText('¥600');
  await expect(page.locator('#expenseSummaryWeek')).toHaveText('¥600');
  await expect(page.locator('#expenseSummaryMonth')).toHaveText('¥600');
  await expect(page.locator('#expenseCategoryList [data-category-type="variable"]')).toContainText('変動費');
  await expect(page.locator('#expenseCategoryList [data-category-type="self"]')).toContainText('自己投資');
  await expect(page.locator('#expenseCategoryList [data-category-type="special"]')).toContainText('特別費');
  await expect(page.locator('#expenseCategoryList [data-calendar-type="self"]',{hasText:'書籍'})).toContainText('¥200');
  await expect(page.locator('#expenseCategoryList [data-calendar-type="special"]',{hasText:'特別支出'})).toContainText('¥300');

  await page.locator('#expenseCategoryList [data-calendar-type="self"]',{hasText:'学習'}).click();
  await expect(page.locator('#dailyEntryDialog')).toBeVisible();
  await expect(page.locator('#dailyEntryMeta')).toContainText('自己投資 ・ 学習');
});
