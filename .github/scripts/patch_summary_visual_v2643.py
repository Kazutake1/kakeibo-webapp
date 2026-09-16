from pathlib import Path

VERSION='2.6.43'

def replace_once(path, old, new):
    file=Path(path)
    text=file.read_text(encoding='utf-8')
    assert text.count(old)==1, f'{path}: expected one match for {old[:70]!r}; got {text.count(old)}'
    file.write_text(text.replace(old,new,1),encoding='utf-8')

app=Path('app.js')
s=app.read_text(encoding='utf-8')
old="['balance','収支',balance,balance>=0?'黒字':'赤字'],"
assert s.count(old)==1
s=s.replace(old,"['balance','収支',balance,balance>=0?'黒字':''],",1)
old='''    const budgetBar=key==='variable'&&budgetVar>0?`<div class="variable-budget-bar ${variableLevel}" role="img" aria-label="変動費の予算消化 ${variablePct}%"><span style="width:${variableWidth}%"></span></div>`:'';
    return `<div class="metric"><div class="label">${l}</div><div class="value ${valueClass}">${money(v)}</div>${sub}${budgetBar}</div>`'''
new='''    const budgetBar=key==='variable'&&budgetVar>0?`<div class="variable-budget-bar ${variableLevel}" role="img" aria-label="変動費の予算消化 ${variablePct}%"><span style="width:${variableWidth}%"></span></div>`:'';
    const icon=key==='variable'?'':`<span class="metric-icon" aria-hidden="true">${summaryCardIcon(key)}</span>`;
    return `<div class="metric"><div class="metric-heading">${icon}<div class="label">${l}</div></div><div class="value ${valueClass}">${money(v)}</div>${sub}${budgetBar}</div>`'''
assert s.count(old)==1, 'renderSummary return not found'
s=s.replace(old,new,1)
anchor='function renderBudgetOverview(){'
assert s.count(anchor)==1
icons='''// Decorative summary icons only. No chart-style three-bar icon is included.
function summaryCardIcon(key){
  const icons={
    income:'<ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v13c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 9c0 1.7 3.1 3 7 3s7-1.3 7-3M5 14c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
    expense:'<path d="M6 18 18 6M9 6h9v9"/>',
    balance:'<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 10h18M16 15h5M6 6V4a1 1 0 0 1 1-1h11"/>',
    fixed:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">${icons[key]||''}</svg>`;
}
'''
s=s.replace(anchor,icons+anchor,1)
app.write_text(s,encoding='utf-8')

css=Path('style.css')
s=css.read_text(encoding='utf-8')
assert '/* v2.6.43: approved summary card refinement */' not in s
s+='''

/* v2.6.43: approved summary card refinement — only the overview metric cards.
   Keep card grid/ordering, figures, existing controls and budget calculation intact. */
.summary>.metric:nth-child(-n+4){
  height:160px;
  min-height:160px;
  display:flex;
  flex-direction:column;
  justify-content:flex-start;
  min-width:0;
}
.summary .metric-heading{display:flex;align-items:center;gap:9px;min-height:38px}
.summary .metric-heading .label{font-size:13px;line-height:1.3}
.summary .metric-icon{
  width:38px;height:38px;flex:0 0 38px;
  display:flex;align-items:center;justify-content:center;
  border-radius:50%;background:#e8f2ff;color:#246ad3;
}
.summary .metric-icon svg{width:21px;height:21px;display:block}
.summary>.metric:nth-child(-n+4) .value{margin-top:9px;overflow-wrap:anywhere}
.summary>.metric:nth-child(-n+4) .sub{margin-top:auto}
/* Deficit: only border and amount are red; never tint the card background. */
body:not(.dark-mode) .summary>.metric:nth-child(3):has(.value.neg){
  background:#fff!important;border-color:#dc2626!important;
}
body:not(.dark-mode) .summary>.metric:nth-child(3) .value.neg{color:#dc2626!important;text-shadow:none!important}
body.dark-mode .summary .metric-icon{background:#203b60;color:#8dc7ff}
body.dark-mode .summary>.metric:nth-child(3):has(.value.neg){
  background:var(--card)!important;border-color:#ff6b6b!important;
}
body.dark-mode .summary>.metric:nth-child(3) .value.neg{color:#ff6b6b!important;text-shadow:none!important}
@media(max-width:700px){
  .summary>.metric:nth-child(-n+4){height:164px;min-height:164px}
  .summary .metric-heading{gap:7px;min-height:36px}
  .summary .metric-icon{width:36px;height:36px;flex-basis:36px}
  .summary .metric-heading .label{font-size:12px}
  .summary>.metric:nth-child(-n+4) .value{font-size:clamp(17px,4.6vw,21px)}
}
'''
css.write_text(s,encoding='utf-8')

index=Path('index.html')
s=index.read_text(encoding='utf-8')
assert s.count('style.css?v=2.6.41')==1 and s.count('app.js?v=2.6.41')==1
assert s.count('v2.6.41 Stable')==1
s=s.replace('style.css?v=2.6.41','style.css?v='+VERSION).replace('app.js?v=2.6.41','app.js?v='+VERSION)
s=s.replace('v2.6.41 Stable','v'+VERSION+' Stable')
index.write_text(s,encoding='utf-8')
sw=Path('sw.js')
s=sw.read_text(encoding='utf-8')
assert s.count('2.6.41')==3
sw.write_text(s.replace('2.6.41',VERSION),encoding='utf-8')

readme=Path('README.md')
s=readme.read_text(encoding='utf-8')
assert s.startswith('# 家計簿Webアプリ v2.6.41 Stable')
s=s.replace('# 家計簿Webアプリ v2.6.41 Stable','# 家計簿Webアプリ v'+VERSION+' Stable',1)
marker='## v2.6.41 Stable'
assert marker in s
s=s.replace(marker,'''## v2.6.43 Stable
- 承認済みの概要デザインに合わせ、収入・支出・収支・固定費カードに4種類のアイコンを追加（棒3本のアイコンは追加しない）
- 4枚のカードの高さをそろえ、項目・金額を読みやすく配置
- 赤字時は収支カードの背景色を変えず、枠線と金額のみ赤色にし「赤字」補足は非表示
- 既存の変動費総予算バー、データ集計、同期、ほかのページおよび各カードの並び順は維持

'''+marker,1)
readme.write_text(s,encoding='utf-8')

tests=Path('tests/ui-regression.spec.js')
s=tests.read_text(encoding='utf-8')
s=s.replace("await expect(balance.locator('.sub')).toHaveText('赤字');","await expect(balance.locator('.sub')).toHaveCount(0);")
s=s.replace("await expect(page.locator('#summaryCards .metric').nth(2).locator('.sub')).toHaveText('赤字');","await expect(page.locator('#summaryCards .metric').nth(2).locator('.sub')).toHaveCount(0);")
s=s.replace("await expect(cards.nth(2).locator('.sub')).toBeVisible();","await expect(cards.nth(2).locator('.sub')).toHaveCount(0);")
s=s.replace('release assets use v2.6.41 cache-busting URLs','release assets use v'+VERSION+' cache-busting URLs')
s=s.replace('style.css?v=2.6.41','style.css?v='+VERSION).replace('app.js?v=2.6.41','app.js?v='+VERSION)
assert 'release assets use v'+VERSION in s
s+='''

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
'''
tests.write_text(s,encoding='utf-8')
print('Patched only app.js summary render, scoped summary CSS, release references, README and focused tests.')
