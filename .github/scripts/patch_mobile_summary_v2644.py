from pathlib import Path

version_from='2.6.43'
version_to='2.6.44'

css=Path('style.css')
style=css.read_text(encoding='utf-8')
assert '/* v2.6.43: approved summary card refinement' in style
assert '/* v2.6.44: compact iPhone summary cards */' not in style
style+='''

/* v2.6.44: compact iPhone summary cards only. Tablet and desktop untouched. */
@media (max-width:700px){
  .summary>.metric:nth-child(-n+4){
    box-sizing:border-box;
    height:80px;
    min-height:80px;
    max-height:80px;
    padding:8px 12px!important;
    gap:0;
  }
  .summary>.metric:nth-child(-n+4) .metric-heading{
    min-height:28px;
    height:28px;
    gap:6px;
    flex:0 0 28px;
  }
  .summary>.metric:nth-child(-n+4) .metric-icon{
    width:28px;
    height:28px;
    flex:0 0 28px;
  }
  .summary>.metric:nth-child(-n+4) .metric-icon svg{width:17px;height:17px}
  .summary>.metric:nth-child(-n+4) .metric-heading .label{font-size:12px;line-height:1.15}
  .summary>.metric:nth-child(-n+4) .value{
    margin-top:1px;
    font-size:clamp(15px,4.2vw,20px);
    line-height:1.12;
    white-space:nowrap;
    overflow-wrap:normal;
  }
  .summary>.metric:nth-child(-n+4) .sub{
    margin-top:0;
    font-size:10px;
    line-height:10px;
  }
  .summary>.metric:nth-child(5){
    box-sizing:border-box;
    height:160px;
    min-height:160px;
    max-height:160px;
    padding:16px!important;
    display:grid;
    grid-template-columns:minmax(0,1fr) auto;
    grid-template-rows:auto minmax(0,1fr) auto;
    gap:8px;
  }
  .summary>.metric:nth-child(5) .metric-heading{grid-column:1/-1;grid-row:1}
  .summary>.metric:nth-child(5) .value{
    grid-column:1;
    grid-row:2;
    align-self:center;
    min-width:0;
    margin-top:0;
  }
  .summary>.metric:nth-child(5) .sub{
    grid-column:2;
    grid-row:2;
    align-self:center;
    justify-self:end;
    margin:0;
    font-size:clamp(9px,2.75vw,12px);
    white-space:nowrap;
    text-align:right;
  }
  .summary>.metric:nth-child(5) .variable-budget-bar{
    grid-column:1/-1;
    grid-row:3;
    width:100%;
    margin-top:0;
  }
}
'''
css.write_text(style,encoding='utf-8')

index=Path('index.html')
s=index.read_text(encoding='utf-8')
assert s.count('style.css?v='+version_from)==1 and s.count('app.js?v='+version_from)==1
assert s.count('v'+version_from+' Stable')==1
s=s.replace('style.css?v='+version_from,'style.css?v='+version_to).replace('app.js?v='+version_from,'app.js?v='+version_to).replace('v'+version_from+' Stable','v'+version_to+' Stable')
index.write_text(s,encoding='utf-8')

worker=Path('sw.js')
s=worker.read_text(encoding='utf-8')
assert s.count(version_from)==3
worker.write_text(s.replace(version_from,version_to),encoding='utf-8')

readme=Path('README.md')
s=readme.read_text(encoding='utf-8')
assert s.startswith('# 家計簿Webアプリ v'+version_from+' Stable')
s=s.replace('# 家計簿Webアプリ v'+version_from+' Stable','# 家計簿Webアプリ v'+version_to+' Stable',1)
anchor='Excel家計簿をベースにした iPhone / iPad / Mac 対応のレスポンシブPWAです。\n\n'
assert anchor in s
s=s.replace(anchor,anchor+'## v'+version_to+' Stable\n- iPhone版の概要の4カード（収入・支出・収支・固定費）を80pxに固定し、不要な余白を削減\n- 変動費カードだけ160pxに固定し、残り予算額を使用額の右側に配置して右端を進捗バーと揃える\n- 右側に余白を追加しない。iPad/PCや集計・保存・同期などその他の仕様は変更なし\n\n',1)
readme.write_text(s,encoding='utf-8')

tests=Path('tests/ui-regression.spec.js')
s=tests.read_text(encoding='utf-8')
assert "release assets use v2.6.43 cache-busting URLs" in s
s=s.replace('release assets use v2.6.43 cache-busting URLs','release assets use v2.6.44 cache-busting URLs').replace('style.css?v=2.6.43','style.css?v=2.6.44').replace('app.js?v=2.6.43','app.js?v=2.6.44')
s+='''

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
'''
tests.write_text(s,encoding='utf-8')
print('Prepared v2.6.44 iPhone-only changes and regression tests')
