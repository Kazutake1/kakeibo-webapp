from pathlib import Path


def replace_once(source, old, new, label):
    count = source.count(old)
    assert count == 1, f'{label}: expected one match, found {count}'
    return source.replace(old, new, 1)


js_path = Path('app.js')
js = js_path.read_text(encoding='utf-8')
js = replace_once(js, "let incomeGraphPeriod='month';\nlet incomeDetailCategory=null;", "let incomeGraphPeriod='month';\nlet incomeGraphAnchor=null;\nlet incomeGraphSelected=null;\nlet incomeDetailCategory=null;", 'graph state')
old_total = """function incomePeriodTotal(date,period){
  const key=period==='year'?String(date.getFullYear()):ym(date);
  return sum(state.transactions.filter(t=>t.type==='income'&&t.date.startsWith(key)).map(t=>t.amount));
}
"""
new_total = old_total + """// Keep the nine graph positions anchored to the daily view's month. Selecting a bar
// changes only the graph/summary scope, not the app month or the daily-entry date.
function selectedIncomePeriod(){
  const anchor=ym();
  if(incomeGraphAnchor!==anchor){
    incomeGraphAnchor=anchor;
    incomeGraphSelected=incomeGraphPeriod==='year'?String(current.getFullYear()):anchor;
  }
  return incomeGraphSelected;
}
function selectedIncomePeriodLabel(){
  const key=selectedIncomePeriod();
  return incomeGraphPeriod==='year'?`${key}年`:`${Number(key.slice(0,4))}年${Number(key.slice(5,7))}月`;
}
function selectedIncomeTransactions(){
  const key=selectedIncomePeriod();
  return state.transactions.filter(t=>t.type==='income'&&t.date.startsWith(key));
}
"""
js = replace_once(js, old_total, new_total, 'period helpers')
start = js.index('function renderMobileIncomeOverview(){')
end = js.index('\nfunction openIncomeFromCard(', start)
original = js[start:end]
assert "offset=index-5" in original and "monthTx().filter(t=>t.type==='income')" in original and "incomeMonthCategories" in original, 'income overview baseline changed'
new_overview = r'''function renderMobileIncomeOverview(){
  const root=document.getElementById('incomeMobileOverview');
  if(!root)return;
  const year=current.getFullYear(),month=current.getMonth();
  const annual=incomeGraphPeriod==='year';
  const selectedKey=selectedIncomePeriod();
  const selectedDate=annual?new Date(Number(selectedKey),0,1):dateFromPickerValue(selectedKey+'-01');
  const selectedLabel=selectedIncomePeriodLabel();
  const total=incomePeriodTotal(selectedDate,incomeGraphPeriod);
  const previousDate=annual?new Date(selectedDate.getFullYear()-1,0,1):new Date(selectedDate.getFullYear(),selectedDate.getMonth()-1,1);
  const previous=incomePeriodTotal(previousDate,incomeGraphPeriod);
  document.getElementById('incomeGraphTitle').textContent=annual?`${selectedKey}年の収入`:(selectedKey===ym(new Date())?'今月の収入':`${selectedLabel}の収入`);
  document.getElementById('incomeGraphTotal').textContent=money(total);
  const difference=previous?`${total>=previous?'+':''}${Math.round((total-previous)/previous*100)}%`:'― ―';
  document.getElementById('incomeGraphCompare').textContent=`${annual?'前年比':'前月比'} ${difference}`;
  document.getElementById('incomeGraphPeriod').value=incomeGraphPeriod;
  // Always build the same axis around the daily view's month. The selected bar
  // remains in its original position after a tap instead of recentering.
  const periods=Array.from({length:9},(_,index)=>{
    const offset=index-5;
    const date=annual?new Date(year+offset,month,1):new Date(year,month+offset,1);
    const key=annual?String(date.getFullYear()):ym(date);
    return {date,key,amount:incomePeriodTotal(date,incomeGraphPeriod),selected:key===selectedKey};
  });
  const max=Math.max(1,...periods.map(p=>p.amount));
  document.getElementById('incomeGraphBars').innerHTML=periods.map(p=>{
    const fraction=p.amount/max;
    const height=p.amount?Math.max(4,Math.round(82*fraction)):0;
    const caption=annual?`${p.date.getFullYear()}年`:`${p.date.getMonth()+1}月`;
    const value=p.amount?money(p.amount):'¥0';
    return `<button type="button" class="income-chart-column${p.selected?' selected':''}" data-income-period="${p.key}" aria-label="${caption}の収入 ${value}${p.selected?'、選択中':''}"><span class="income-chart-track"><span class="income-chart-bar" style="height:${height}%"></span>${p.selected?`<span class="income-chart-tag" style="bottom:calc(${height}% + 6px)">${value}</span>`:''}</span><span class="income-chart-label">${caption}</span></button>`;
  }).join('');
  // The total, category amounts and drill-down use the SAME period as the graph.
  const periodItems=selectedIncomeTransactions();
  document.getElementById('incomeMiniTotal').textContent=money(sum(periodItems.map(t=>t.amount)));
  document.getElementById('incomeMiniCount').textContent=`${periodItems.length}件の入金`;
  const categories=catsFor('income');
  const icons=[
    '<rect x="4" y="7" width="16" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M4 12h16M10 12v2h4v-2"/>',
    '<rect x="4" y="9" width="16" height="12" rx="2"/><path d="M12 9v12M4 13h16M12 9c-4 0-6-2-5-4 1-3 5-1 5 4Zm0 0c4 0 6-2 5-4 1-3-5-1-5 4Z"/>',
    '<path d="M3 18h18M5 14l5-5 4 3 5-7M15 5h4v4"/>',
    '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
  ];
  document.getElementById('incomeMonthCategories').innerHTML=categories.map((category,index)=>{
    const rows=periodItems.filter(t=>t.category===category);
    const amount=sum(rows.map(t=>t.amount));
    const icon=icons[Math.min(index,3)];
    const encoded=encodeArg(category);
    return `<button type="button" class="income-category-row" onclick="openIncomeMonthDetail('${encoded}')"><span class="income-category-symbol color-${index%4}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icon}</svg></span><span class="income-category-name"><strong>${escapeHtml(category)}</strong><small>${selectedLabel}の合計 ${money(amount)}</small></span><span class="income-category-count">${rows.length}件</span><span class="income-category-arrow" aria-hidden="true">›</span></button>`;
  }).join('');
}'''
# Restore the gift symbol path exactly as the current release; this is not an icon change.
new_overview = new_overview.replace('c-4 0-6-2-5-4 1-3 5-1 5 4Z', 'c-4 0-6-2-5-4 1-3 5-1 5 4Z')
assert "'<rect x=\"4\" y=\"9\"" in new_overview
js = js[:start] + new_overview + js[end:]

old_open = """function openIncomeFromCard(category=''){
  openTx();
  txDialogTitle.textContent='収入を追加';
  txType.value='income';
  updateCats();
  txDate.value=localDateKey(mobileDailyDate);
  if(category&&catsFor('income').includes(category))txCategory.value=category;
}
"""
new_open = """function openIncomeFromCard(category=''){
  openTx();
  txDialogTitle.textContent='収入を追加';
  txType.value='income';
  updateCats();
  // Default the new entry to the selected graph period without moving the
  // existing day editor. Clamp the day for shorter months (e.g. January 31).
  const key=selectedIncomePeriod();
  const first=incomeGraphPeriod==='year'?new Date(Number(key),mobileDailyDate.getMonth(),1):dateFromPickerValue(key+'-01');
  if(first){
    const day=Math.min(mobileDailyDate.getDate(),new Date(first.getFullYear(),first.getMonth()+1,0).getDate());
    txDate.value=localDateKey(new Date(first.getFullYear(),first.getMonth(),day));
  }
  if(category&&catsFor('income').includes(category))txCategory.value=category;
}
"""
js = replace_once(js,old_open,new_open,'income add target date')
js = replace_once(js,"const rows=monthTx().filter(t=>t.type==='income'&&(category===null||t.category===category))", "const rows=selectedIncomeTransactions().filter(t=>category===null||t.category===category)", 'detail selected transactions')
js = replace_once(js, "document.getElementById('incomeMonthMeta').textContent=`${current.getFullYear()}年${current.getMonth()+1}月 ・ ${rows.length}件 ・ 合計 ${money(sum(rows.map(t=>t.amount)))}`;", "document.getElementById('incomeMonthMeta').textContent=`${selectedIncomePeriodLabel()} ・ ${rows.length}件 ・ 合計 ${money(sum(rows.map(t=>t.amount)))}`;", 'detail period label')
js = replace_once(js, "join(''):'<div class=\"daily-history-empty\">この月の収入はありません</div>';", "join(''):`<div class=\"daily-history-empty\">${incomeGraphPeriod==='year'?'この年':'この月'}の収入はありません</div>`;", 'detail empty label')
js = replace_once(js, "if(!monthTx().some(t=>t.type==='income'&&t.id===id))return;", "if(!selectedIncomeTransactions().some(t=>t.id===id))return;", 'detail edit guard')
js = replace_once(js, "const index=state.transactions.findIndex(t=>t.id===id&&t.type==='income'&&t.date.startsWith(ym()));", "const index=state.transactions.findIndex(t=>t.id===id&&t.type==='income'&&t.date.startsWith(selectedIncomePeriod()));", 'detail delete guard')
js = replace_once(js, "period.onchange=()=>{incomeGraphPeriod=period.value==='year'?'year':'month';renderMobileIncomeOverview()};", "period.onchange=()=>{incomeGraphPeriod=period.value==='year'?'year':'month';incomeGraphSelected=incomeGraphPeriod==='year'?String(current.getFullYear()):ym();renderMobileIncomeOverview()};", 'graph mode selection')
old_click = """    const value=button.dataset.incomePeriod;
    const date=incomeGraphPeriod==='year'?new Date(Number(value),current.getMonth(),Math.min(mobileDailyDate.getDate(),28)):dateFromPickerValue(value+'-01');
    if(date)setMobileDailyDate(date);
"""
new_click = """    incomeGraphSelected=button.dataset.incomePeriod;
    renderMobileIncomeOverview();
"""
js = replace_once(js,old_click,new_click,'bar selection without date navigation')
assert "if(date)setMobileDailyDate(date);" not in js[js.index('function initIncomeMobileOverview(){'):js.index('\nfunction renderMobileDaily(){')]
js_path.write_text(js,encoding='utf-8')

index=Path('index.html')
s=index.read_text(encoding='utf-8')
assert s.count('2.6.48')==3, f'index release refs {s.count("2.6.48")}'
index.write_text(s.replace('2.6.48','2.6.49'),encoding='utf-8')
sw=Path('sw.js')
s=sw.read_text(encoding='utf-8')
assert s.count('2.6.48')==3, f'service worker refs {s.count("2.6.48")}'
sw.write_text(s.replace('2.6.48','2.6.49'),encoding='utf-8')
readme=Path('README.md')
s=readme.read_text(encoding='utf-8')
s=replace_once(s,'# 家計簿Webアプリ v2.6.48 Stable','# 家計簿Webアプリ v2.6.49 Stable','README heading')
s=replace_once(s,'## v2.6.48 Stable',"""## v2.6.49 Stable
- iPhone収入グラフの棒をタップしても9本の位置を固定し、選択位置・収入額・前月比／前年比だけを更新する
- グラフ操作で日別入力の日付やアプリの表示月を変更しない。月送り操作時はグラフの基準月を更新
- グラフ、収入合計、カテゴリ別金額・件数、明細の集計期間を月間／年間の選択と一致させる
- 収入追加時の日付も選択期間に合わせ、日別入力の日付や他画面・クラウド同期は維持

## v2.6.48 Stable""",'README release')
readme.write_text(s,encoding='utf-8')

test_path=Path('tests/ui-regression.spec.js')
s=test_path.read_text(encoding='utf-8')
assert s.count('2.6.48')==3, f'test release refs {s.count("2.6.48")}'
s=s.replace('2.6.48','2.6.49')
old_assert = """  await columns.nth(4).click();
  await expect(page.locator('#incomeMiniTotal')).toHaveText('¥80,000');
  await expect(page.locator('#monthLabel')).toContainText(`${previous.getFullYear()}年${previous.getMonth()+1}月`);
"""
new_assert = """  const keysBefore=await columns.evaluateAll(items=>items.map(el=>el.dataset.incomePeriod));
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
"""
s=replace_once(s,old_assert,new_assert,'existing graph test regression expectation')

s += r'''

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
'''
test_path.write_text(s,encoding='utf-8')
print('Prepared scoped v2.6.49 chart interaction fix and 42 focused/full regression tests.')
