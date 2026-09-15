from pathlib import Path

# v2.6.39: remove overview explanation controls and show only total variable-budget usage visually.

index = Path('index.html')
s = index.read_text(encoding='utf-8')
assert 'style.css?v=2.6.38' in s and 'app.js?v=2.6.38' in s, 'v2.6.38 asset refs not found'
assert 'v2.6.38 Stable' in s, 'v2.6.38 badge not found'

old_full = '''      <div class="mobile-full-entry" id="mobileFullEntry">
        <div class="mobile-full-head"><div class="mobile-full-title-row"><strong>詳細入力</strong><button class="mobile-full-info-btn overview-info-btn" id="mobileFullInfoBtn" type="button" aria-label="詳細入力の説明を表示">i</button></div><span class="mobile-full-badge">全項目</span></div>
        <div class="mobile-full-body">
          <p class="mobile-full-note">収入・社会保険／税金・貯蓄・自己投資・固定費・特別費・変動費は、ここから入力できます。</p>
          <button class="secondary full-entry-btn" id="quickFullBtn" type="button">詳細入力を開く</button>
        </div>
      </div>'''
new_full = '''      <div class="mobile-full-entry" id="mobileFullEntry">
        <div class="mobile-full-head"><strong>詳細入力</strong><span class="mobile-full-badge">全項目</span></div>
        <div class="mobile-full-body">
          <button class="secondary full-entry-btn" id="quickFullBtn" type="button">詳細入力を開く</button>
        </div>
      </div>'''
assert old_full in s, 'v2.6.38 mobile full entry block not found'
s = s.replace(old_full, new_full, 1)

start = s.find('<dialog id="overviewInfoDialog"')
assert start != -1, 'overview info dialog not found'
end_marker = '</dialog>\n\n'
end = s.find(end_marker, start)
assert end != -1, 'overview info dialog end not found'
s = s[:start] + s[end + len(end_marker):]

s = s.replace('style.css?v=2.6.38', 'style.css?v=2.6.39', 1)
s = s.replace('app.js?v=2.6.38', 'app.js?v=2.6.39', 1)
s = s.replace('v2.6.38 Stable', 'v2.6.39 Stable')
index.write_text(s, encoding='utf-8')

app = Path('app.js')
s = app.read_text(encoding='utf-8')
start = s.find('const OVERVIEW_INFO={')
end = s.find('\nfunction renderBudgetOverview(){', start)
assert start != -1 and end != -1, 'v2.6.38 overview info/renderSummary block not found'
new_summary = r'''function renderSummary(){
  const income=typeSum('income');
  const expense=sum(['tax','saving','self','fixed','special','variable'].map(effectiveTypeSum));
  const fixedBudget=budgetTypeSum('fixed');
  const variable=typeSum('variable');
  const budgetVar=budgetTypeSum('variable');
  const balance=income-expense;
  const variablePct=budgetVar>0?Math.round(variable/budgetVar*100):0;
  const variableWidth=budgetVar>0?Math.min(100,Math.max(0,variable/budgetVar*100)):0;
  const variableLevel=variablePct>=100?'over':variablePct>=90?'danger':variablePct>=70?'warn':'normal';
  const data=[
    ['income','収入',income,''],
    ['expense','支出',expense,''],
    ['balance','収支',balance,balance>=0?'黒字':'赤字'],
    ['fixed','固定費',fixedBudget,''],
    ['variable','変動費',variable,`予算残り ${money(budgetVar-variable)}`]
  ];
  const root=document.querySelector('#summaryCards');
  root.innerHTML=data.map(([key,l,v,s])=>{
    const valueClass=l==='収支'?(v>=0?'pos':'neg'):(l==='変動費'&&budgetVar>0&&v>budgetVar?'neg':'');
    const sub=s?`<div class="sub">${s}</div>`:'';
    const budgetBar=key==='variable'&&budgetVar>0?`<div class="variable-budget-bar ${variableLevel}" role="img" aria-label="変動費の予算消化 ${variablePct}%"><span style="width:${variableWidth}%"></span></div>`:'';
    return `<div class="metric"><div class="label">${l}</div><div class="value ${valueClass}">${money(v)}</div>${sub}${budgetBar}</div>`
  }).join('');
}'''
s = s[:start] + new_summary + s[end:]

old_init = 'initNav();populateType();initQuickEntry();initTheme();initMobileDaily();initOverviewInfo();\nrender();'
new_init = 'initNav();populateType();initQuickEntry();initTheme();initMobileDaily();\nrender();'
assert old_init in s, 'v2.6.38 init sequence not found'
s = s.replace(old_init, new_init, 1)
app.write_text(s, encoding='utf-8')

style = Path('style.css')
s = style.read_text(encoding='utf-8')
marker = '/* v2.6.38: smartphone overview info sheets */'
start = s.find(marker)
assert start != -1, 'v2.6.38 style block not found'
s = s[:start].rstrip() + r'''


/* v2.6.39: total variable-budget usage bar */
.variable-budget-bar{
  height:8px;
  margin-top:10px;
  overflow:hidden;
  border-radius:999px;
  background:var(--line-soft);
}
.variable-budget-bar span{
  display:block;
  height:100%;
  border-radius:999px;
  background:var(--accent);
  transition:width .2s ease;
}
.variable-budget-bar.warn span{background:#d99a32}
.variable-budget-bar.danger span,.variable-budget-bar.over span{background:#dc2626}
body.dark-mode .variable-budget-bar{background:#26384c}
body.dark-mode .variable-budget-bar span{background:#55a8ff}
body.dark-mode .variable-budget-bar.warn span{background:#e2b56b}
body.dark-mode .variable-budget-bar.danger span,body.dark-mode .variable-budget-bar.over span{background:#ff6b6b}
'''
style.write_text(s, encoding='utf-8')

sw = Path('sw.js')
s = sw.read_text(encoding='utf-8')
assert "kakeibo-v2.6.38-stable" in s, 'v2.6.38 cache name not found'
assert "./style.css?v=2.6.38" in s and "./app.js?v=2.6.38" in s, 'v2.6.38 APP_SHELL refs not found'
s = s.replace("kakeibo-v2.6.38-stable", "kakeibo-v2.6.39-stable", 1)
s = s.replace("./style.css?v=2.6.38", "./style.css?v=2.6.39", 1)
s = s.replace("./app.js?v=2.6.38", "./app.js?v=2.6.39", 1)
sw.write_text(s, encoding='utf-8')

readme = Path('README.md')
s = readme.read_text(encoding='utf-8')
assert s.startswith('# 家計簿Webアプリ v2.6.38 Stable'), 'README version heading unexpected'
marker = '## v2.6.38 Stable\n'
pos = s.find(marker)
assert pos != -1, 'v2.6.38 release section not found'
release = '''# 家計簿Webアプリ v2.6.39 Stable\n\nExcel家計簿をベースにした iPhone / iPad / Mac 対応のレスポンシブPWAです。\n\n## v2.6.39 Stable\n- 概要の「変動費」カードに、変動費合計が総予算に対してどこまで到達しているかを示す細い予算消化バーを追加\n- カテゴリ別バーは追加せず、変動費合計に対する1本だけの表示に限定\n- 先に追加した概要カードと詳細入力の情報ボタン・説明ボトムシートを削除\n- 収入・支出・固定費の補足説明文も削除し、収支の「黒字／赤字」と変動費の「予算残り」は状態表示として維持\n- 入力・集計・保存仕様、週間比較、円グラフなどその他の機能は変更なし\n\n'''
s = release + s[pos:]
readme.write_text(s, encoding='utf-8')

test = Path('tests/ui-regression.spec.js')
s = test.read_text(encoding='utf-8')
s = s.replace('release assets use v2.6.38 cache-busting URLs', 'release assets use v2.6.39 cache-busting URLs')
s = s.replace('style.css?v=2.6.38', 'style.css?v=2.6.39')
s = s.replace('app.js?v=2.6.38', 'app.js?v=2.6.39')
legacy_explanations = '''  await expect(full).toContainText('収入');\n  await expect(full).toContainText('固定費');\n  await expect(full).toContainText('変動費');\n'''
assert legacy_explanations in s, 'v2.6.37 detailed-entry explanation expectations not found'
s = s.replace(legacy_explanations, '', 1)
old_test = r'''test('smartphone overview hides explanatory copy behind info sheets', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);

  const cards=page.locator('#summaryCards .metric');
  await expect(cards).toHaveCount(5);
  await expect(page.locator('#summaryCards .summary-info-btn')).toHaveCount(5);
  for (const index of [0,1,3]) {
    await expect(cards.nth(index).locator('.summary-explainer')).toBeHidden();
  }
  await expect(cards.nth(2).locator('.summary-status')).toBeVisible();
  await expect(cards.nth(4).locator('.summary-status')).toBeVisible();

  await cards.nth(0).locator('.summary-info-btn').click();
  const dialog=page.locator('#overviewInfoDialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#overviewInfoTitle')).toHaveText('収入');
  await expect(page.locator('#overviewInfoText')).toContainText('当月に登録された収入の実績');
  await page.locator('#overviewInfoClose').click();
  await expect(dialog).not.toBeVisible();

  const full=page.locator('#mobileFullEntry');
  await expect(full.locator('.mobile-full-note')).toBeHidden();
  await expect(full.locator('#mobileFullInfoBtn')).toBeVisible();
  await full.locator('#mobileFullInfoBtn').click();
  await expect(dialog).toBeVisible();
  await expect(page.locator('#overviewInfoTitle')).toHaveText('詳細入力');
  await expect(page.locator('#overviewInfoText')).toContainText('すべての項目を入力できます');
  await page.locator('#overviewInfoClose').click();

  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.locator('#summaryCards .summary-info-btn').first()).toBeHidden();
  await expect(cards.nth(0).locator('.summary-explainer')).toBeVisible();
});'''
assert old_test in s, 'v2.6.38 overview info regression test not found'
new_test = r'''test('overview keeps explanations removed and shows only total variable budget usage bar', async ({ page }) => {
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
  await expect(cards.nth(2).locator('.sub')).toBeVisible();
  await expect(cards.nth(4).locator('.sub')).toBeVisible();

  await expect(page.locator('#summaryCards .variable-budget-bar')).toHaveCount(1);
  const bar=cards.nth(4).locator('.variable-budget-bar');
  await expect(bar).toHaveAttribute('aria-label','変動費の予算消化 50%');
  const width=await bar.locator('span').evaluate(el=>parseFloat(getComputedStyle(el).width));
  const total=await bar.evaluate(el=>parseFloat(getComputedStyle(el).width));
  expect(Math.abs(width/total-0.5)).toBeLessThan(0.03);
});'''
s = s.replace(old_test, new_test, 1)
test.write_text(s, encoding='utf-8')
