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



test('release assets use v2.6.44 cache-busting URLs', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('link[rel="stylesheet"]')).toHaveAttribute('href', 'style.css?v=2.6.44');
  const appSrc = await page.locator('script[src*="app.js"]').getAttribute('src');
  expect(appSrc).toBe('app.js?v=2.6.44');
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
    fetchCloudState=async()=>({state:{transactions:[],budgets:{},categories:{}},updated_at:'2026-09-06T00:00:00Z'});
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



test('donut legends use ordered blue and green gradients', async ({ page }) => {
  await openApp(page);
  const colors=await page.evaluate(()=>({
    expense:Array.from({length:6},(_,i)=>donutColor('donutChart',i,6)),
    variable:Array.from({length:10},(_,i)=>donutColor('variableDonut',i,10)),
    weeklyFirst:chartColor(0),
    weeklySecond:chartColor(1)
  }));

  expect(colors.expense[0]).toBe('hsl(216, 82%, 34%)');
  expect(colors.expense.at(-1)).toBe('hsl(216, 82%, 76%)');
  expect(new Set(colors.expense).size).toBe(colors.expense.length);
  expect(colors.variable[0]).toBe('hsl(145, 62%, 28%)');
  expect(colors.variable.at(-1)).toBe('hsl(145, 62%, 76%)');
  expect(new Set(colors.variable).size).toBe(colors.variable.length);
  expect(colors.weeklyFirst).not.toBe(colors.weeklySecond);

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
    await expect(cards.locator('.metric-icon')).toHaveCount(4);
    await expect(cards.locator('.metric-icon svg')).toHaveCount(4);
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


test('iPhone overview cards are exactly 80px and variable card is 160px with aligned remaining budget', async ({page})=>{
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
        summaryOverflow:root.scrollWidth-root.clientWidth
      };
    });
    for(const h of geometry.heights.slice(0,4))expect(Math.abs(h-80)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.heights[4]-160)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.rightGap)).toBeLessThanOrEqual(1);
    expect(geometry.rowGap).toBeLessThanOrEqual(3);
    expect(geometry.summaryOverflow).toBeLessThanOrEqual(1);
    for(const entry of geometry.valueBottoms)expect(entry.bottom).toBeLessThanOrEqual(entry.card-4);
    expect(geometry.barRight).toBeLessThan(geometry.cardRight);
  }
});

test('iPad and desktop overview card dimensions remain at the previous 160px design',async ({page})=>{
  for(const width of [820,1024,1440]){
    await page.setViewportSize({width,height:900});
    await openApp(page);
    const heights=await page.locator('#summaryCards .metric').evaluateAll(items=>items.slice(0,4).map(el=>el.getBoundingClientRect().height));
    for(const height of heights)expect(Math.abs(height-160)).toBeLessThanOrEqual(1);
    const remaining=page.locator('#summaryCards .metric').nth(4).locator('.sub');
    await expect(remaining).toContainText('予算残り');
  }
});
