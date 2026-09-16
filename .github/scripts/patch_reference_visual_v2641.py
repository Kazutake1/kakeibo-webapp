from pathlib import Path

# Design-only update. Do not change application logic, DOM structure, spacing,
# grid/layout rules, button positions, existing labels, or chart calculations.
style = Path('style.css')
s = style.read_text(encoding='utf-8')
assert '/* v2.6.39: total variable-budget usage bar */' in s
assert '/* v2.6.41: reference-inspired visual skin only */' not in s
s += r'''


/* v2.6.41: reference-inspired visual skin only.
   Intentionally limited to colors, fills, borders, shadows and corner shapes.
   No changes to geometry, grid, order, sizing, visibility, or behavior. */
body:not(.dark-mode){
  --bg:#eaf4ff;
  --paper:#f4f9ff;
  --card:#ffffff;
  --line:#cfe0f8;
  --line-soft:#e2edfb;
  --header:#f8fbff;
  --header2:#eef6ff;
  --text:#152746;
  --muted:#647e9f;
  --accent:#277be8;
  --accent-soft:#e7f2ff;
  --good:#148a71;
  --danger:#dc2626;
  --warn:#c68b28;
  --shadow:0 12px 32px rgba(35,98,177,.09);
  --ink:#152746;
  background:linear-gradient(158deg,#f9fcff 0%,#e6f3ff 48%,#f2f8ff 100%)!important;
}
body:not(.dark-mode) .app{
  background:linear-gradient(158deg,#f9fcff 0%,#e6f3ff 48%,#f2f8ff 100%)!important;
}
body:not(.dark-mode) .topbar{
  background:rgba(248,252,255,.95)!important;
  border-bottom-color:#dfebfb!important;
  box-shadow:0 5px 22px rgba(41,103,180,.055)!important;
}
body:not(.dark-mode) .brand,body:not(.dark-mode) .monthlabel{color:#142747!important}
body:not(.dark-mode) .topbar .monthnav button,
body:not(.dark-mode) .theme-toggle{
  background:#eff7ff!important;
  border-color:#d7e8fe!important;
  color:#2157a0!important;
  box-shadow:0 2px 9px rgba(41,108,190,.045)!important;
  border-radius:14px;
}
body:not(.dark-mode) .topbar .monthnav button:hover{background:#e3f1ff!important}
body:not(.dark-mode) .metric,
body:not(.dark-mode) .card,
body:not(.dark-mode) .budget-section,
body:not(.dark-mode) .status-stat,
body:not(.dark-mode) .table-wrap,
body:not(.dark-mode) .mobile-quick-entry,
body:not(.dark-mode) .mobile-full-entry,
body:not(.dark-mode) .mobile-recent,
body:not(.dark-mode) .mobile-month-calendar,
body:not(.dark-mode) .mobile-day-card,
body:not(.dark-mode) dialog{
  background:#fff!important;
  border-color:#e1edfb!important;
  box-shadow:0 12px 32px rgba(35,98,177,.09)!important;
}
body:not(.dark-mode) .card h2{
  background:transparent!important;
  color:#162b4b!important;
  border-bottom-color:#e7effb!important;
}
body:not(.dark-mode) .metric .label{color:#617c9c!important}
body:not(.dark-mode) .metric .value{color:#142747!important}
body:not(.dark-mode) .metric .sub{color:#617c9c!important}
/* Preserve the existing 2px balance outline and red/green state semantics. */
body:not(.dark-mode) .metric:nth-child(3){
  background:#fff!important;
  border-color:#3187f0!important;
}
body:not(.dark-mode) .metric:nth-child(3) .value.neg,
body:not(.dark-mode) .budget-section .actual.neg,
body:not(.dark-mode) .status-stat.remaining .v.neg,
body:not(.dark-mode) .budget-watch-row.over strong{color:#dc2626!important}
body:not(.dark-mode) .metric:nth-child(3):has(.value.neg) .sub{color:#dc2626!important}
body:not(.dark-mode) .metric:nth-child(3) .value.pos{color:#148a71!important}
body:not(.dark-mode) .mobile-quick-head{
  background:linear-gradient(115deg,#2779e8 0%,#378eed 62%,#36c7d9 100%)!important;
  border-bottom-color:transparent!important;
}
body:not(.dark-mode) .mobile-quick-head strong,
body:not(.dark-mode) .mobile-quick-date{color:#fff!important}
body:not(.dark-mode) .mobile-full-entry{
  background:linear-gradient(135deg,#fff 0%,#fff 68%,#f3faff 100%)!important;
}
body:not(.dark-mode) .mobile-full-head strong{color:#172947!important}
body:not(.dark-mode) .primary{
  background:linear-gradient(115deg,#2c7bec 0%,#358ff3 62%,#37c7d9 100%)!important;
  border-color:transparent!important;
  color:#fff!important;
  box-shadow:0 9px 20px rgba(42,126,229,.20)!important;
}
body:not(.dark-mode) .primary:hover{filter:brightness(.98)}
body:not(.dark-mode) .secondary,
body:not(.dark-mode) .field input,
body:not(.dark-mode) .field select,
body:not(.dark-mode) .quick-amount input,
body:not(.dark-mode) .item-chip,
body:not(.dark-mode) .daily-history-buttons button,
body:not(.dark-mode) .daily-native-date{
  background:#f5faff!important;
  border-color:#d6e7fc!important;
  color:#203b64!important;
}
body:not(.dark-mode) .field input::placeholder{color:#8296b1}
body:not(.dark-mode) .field input:focus,
body:not(.dark-mode) .field select:focus{
  border-color:#4a9af7!important;
  box-shadow:0 0 0 3px rgba(53,144,243,.13)!important;
}
body:not(.dark-mode) .danger{
  background:#fff3f5;
  border-color:#ffcad1;
  color:#c42036;
}
body:not(.dark-mode) .desktop-tabs{background:var(--bg)}
body:not(.dark-mode) .tab{color:#6b83a6}
body:not(.dark-mode) .tab.active{
  background:#eaf4ff!important;
  border-color:#d8e9ff!important;
  color:#186bd7!important;
  box-shadow:0 2px 8px rgba(33,109,204,.07)!important;
}
body:not(.dark-mode) .mobile-nav{
  background:rgba(255,255,255,.96)!important;
  border-top-color:#e0ecfc!important;
  box-shadow:0 -8px 24px rgba(35,98,177,.07)!important;
}
body:not(.dark-mode) .mobile-nav button{color:#7087a7!important}
body:not(.dark-mode) .mobile-nav button.active{
  background:#eaf4ff!important;
  color:#1975e2!important;
  border-radius:15px;
}
body:not(.dark-mode) .budget-section h3,
body:not(.dark-mode) .row.total,
body:not(.dark-mode) .data-table th,
body:not(.dark-mode) .cal-table th{
  background:#edf6ff!important;
  border-color:#deebfb!important;
  color:#264b7a!important;
}
body:not(.dark-mode) .budget-section.fixed-only h3{background:#eff7ff!important}
body:not(.dark-mode) .calendar,
body:not(.dark-mode) .cal-cell,
body:not(.dark-mode) .data-table td{background:#fff!important}
body:not(.dark-mode) .cal-cell:hover,
body:not(.dark-mode) .data-table tbody tr:hover td{background:#eff7ff!important}
body:not(.dark-mode) .cal-cat{background:#f2f8ff!important;color:#3b608c!important}
body:not(.dark-mode) .table-wrap,
body:not(.dark-mode) .cal-table td{border-color:#e0ebfa!important}
body:not(.dark-mode) .variable-status{
  background:linear-gradient(180deg,#fcfeff,#f1f8ff)!important;
  border-color:#e2edfb!important;
}
body:not(.dark-mode) .status-stat{background:#fff!important}
body:not(.dark-mode) .status-stat.remaining .v{color:#167f6c}
body:not(.dark-mode) .progress,
body:not(.dark-mode) .variable-status .big-progress,
body:not(.dark-mode) .variable-budget-bar{background:#dceafb!important}
body:not(.dark-mode) .progress>span:not(.over),
body:not(.dark-mode) .variable-status .big-progress span:not(.over),
body:not(.dark-mode) .variable-budget-bar:not(.warn):not(.danger):not(.over) span{
  background:linear-gradient(90deg,#347ef0,#3fc0df)!important;
}
body:not(.dark-mode) .progress>span.over,
body:not(.dark-mode) .variable-status .big-progress span.over,
body:not(.dark-mode) .variable-budget-bar.danger span,
body:not(.dark-mode) .variable-budget-bar.over span{background:#dc2626!important}
body:not(.dark-mode) .variable-budget-bar.warn span{background:#e9ad4e!important}
body:not(.dark-mode) .sync-status-row,
body:not(.dark-mode) .daily-history-row,
body:not(.dark-mode) .day-summary-strip,
body:not(.dark-mode) .expense-history-fixed{
  background:#f2f8ff!important;
  border-color:#e2edfb!important;
}
body:not(.dark-mode) .day-nav-btn{
  background:#f2f8ff;
  color:#2464ae;
  border-color:#d6e7fc;
}
body:not(.dark-mode) .mobile-cal-day.selected{
  background:#e7f2ff;
  box-shadow:inset 0 0 0 2px #3187f0;
}
body:not(.dark-mode) .expense-history-filter{
  background:#f4f9ff;
  border-color:#dce9fb;
  color:#31547b;
}
body:not(.dark-mode) .expense-history-filter.active{
  background:#287cea;
  border-color:#287cea;
  color:#fff;
}
body:not(.dark-mode) .expense-history-actions button{
  background:#f4f9ff;
  border-color:#dce9fb;
  color:#28466f;
}
body:not(.dark-mode) .expense-history-actions .expense-history-delete{color:#dc2626}
body:not(.dark-mode) .donut-mode-toggle{background:#edf5ff;border-color:#dce9fb}
body:not(.dark-mode) .donut-mode-btn.active{
  background:#fff;
  color:#1e73dc;
  box-shadow:0 2px 7px rgba(25,94,189,.09);
}
body:not(.dark-mode) .donut-legend-name{color:#233d62}
body:not(.dark-mode) .donut-value-amount{color:#25538b}
body:not(.dark-mode) .sync-choice-head{background:#f0f7ff;border-color:#e2edfb}
body:not(.dark-mode) .sync-choice-option{background:#fff;border-color:#d9e8fa}
body:not(.dark-mode) .sync-choice-warning{background:#fff2f4;color:#c82737}
/* The high-specificity delete rule from v2.6.33 remains unchanged. */

/* Match the same blue-and-white aesthetic in dark mode without disabling it. */
body.dark-mode{
  --bg:#0d182b;
  --paper:#14243a;
  --card:#17283e;
  --line:#36516f;
  --line-soft:#2a415d;
  --header:#101d30;
  --header2:#20344f;
  --text:#f0f6ff;
  --muted:#a6bbd5;
  --accent:#65adff;
  --accent-soft:#203b60;
  --good:#67cfa7;
  --danger:#ff8d92;
  --warn:#e3b76b;
  --shadow:0 12px 34px rgba(0,0,0,.23);
  --ink:#f0f6ff;
  background:#0d182b!important;
}
body.dark-mode .app{background:linear-gradient(150deg,#0c192d,#12253c 52%,#0d182b)!important}
body.dark-mode .topbar{
  background:rgba(13,26,44,.96)!important;
  border-bottom-color:#29415e!important;
  box-shadow:0 5px 22px rgba(0,0,0,.23)!important;
}
body.dark-mode .metric,
body.dark-mode .card,
body.dark-mode .budget-section,
body.dark-mode .status-stat,
body.dark-mode .mobile-quick-entry,
body.dark-mode .mobile-full-entry,
body.dark-mode .mobile-recent,
body.dark-mode .mobile-month-calendar,
body.dark-mode .mobile-day-card,
body.dark-mode .table-wrap,
body.dark-mode dialog{
  background:#17283e!important;
  border-color:#2a415d!important;
  box-shadow:0 12px 34px rgba(0,0,0,.23)!important;
}
body.dark-mode .metric:nth-child(3){background:#17283e!important;border-color:#65adff!important}
body.dark-mode .card h2{background:transparent!important;border-bottom-color:#2a415d!important}
body.dark-mode .mobile-quick-head{background:linear-gradient(115deg,#1659b5,#2478da 68%,#157f9a)!important}
body.dark-mode .primary{
  background:linear-gradient(115deg,#1767d3,#267fe6 67%,#208fa9)!important;
  color:#fff!important;
  box-shadow:0 7px 19px rgba(0,0,0,.22)!important;
}
body.dark-mode .mobile-nav{background:rgba(13,26,44,.96)!important;border-top-color:#2a415d!important}
body.dark-mode .mobile-nav button.active{background:#203b60!important;color:#7ac4ff!important;border-radius:15px}
body.dark-mode .budget-section h3,
body.dark-mode .budget-section.fixed-only h3{background:#20344f!important;border-color:#2a415d!important}
body.dark-mode .variable-status{background:linear-gradient(180deg,#192d46,#15273e)!important;border-color:#2a415d!important}
body.dark-mode .variable-status .big-progress span:not(.over),
body.dark-mode .variable-budget-bar:not(.warn):not(.danger):not(.over) span{background:linear-gradient(90deg,#368bea,#42bed7)!important}
body.dark-mode .variable-status .big-progress span.over{background:#ff6b6b!important}
body.dark-mode .sync-choice-head{background:#20344f;border-color:#2a415d}
body.dark-mode .sync-choice-option{background:#192c45;border-color:#36516f}
'''
style.write_text(s, encoding='utf-8')

index = Path('index.html')
s = index.read_text(encoding='utf-8')
assert 'style.css?v=2.6.40' in s and 'app.js?v=2.6.40' in s
assert 'v2.6.40 Stable' in s
s = s.replace('style.css?v=2.6.40','style.css?v=2.6.41',1)
s = s.replace('app.js?v=2.6.40','app.js?v=2.6.41',1)
s = s.replace('v2.6.40 Stable','v2.6.41 Stable')
index.write_text(s, encoding='utf-8')

sw=Path('sw.js')
s=sw.read_text(encoding='utf-8')
assert "kakeibo-v2.6.40-stable" in s
assert "./style.css?v=2.6.40" in s and "./app.js?v=2.6.40" in s
s=s.replace('kakeibo-v2.6.40-stable','kakeibo-v2.6.41-stable',1)
s=s.replace('./style.css?v=2.6.40','./style.css?v=2.6.41',1)
s=s.replace('./app.js?v=2.6.40','./app.js?v=2.6.41',1)
sw.write_text(s,encoding='utf-8')

readme=Path('README.md')
s=readme.read_text(encoding='utf-8')
assert s.startswith('# 家計簿Webアプリ v2.6.40 Stable')
needle='## v2.6.40 Stable\n'
pos=s.find(needle)
assert pos!=-1
s='''# 家計簿Webアプリ v2.6.41 Stable

Excel家計簿をベースにした iPhone / iPad / Mac 対応のレスポンシブPWAです。

## v2.6.41 Stable
- ご提示の左端のデザイン案を基に、淡いブルーの背景・白いカード・青〜シアンのアクセント・柔らかい影を全画面へ統一
- スマホだけでなく、iPad・PCの概要／支出／収入／予算／設定、入力フォームとダイアログにも同じ色彩を適用
- ダークモードは維持し、同じ青系の配色へ調整。赤字・予算超過の警告色は維持
- 既存の機能、HTML構造、ボタン・カードの場所、大きさ、表示順、グラフの集計方式は変更なし

'''+s[pos:]
readme.write_text(s,encoding='utf-8')

test=Path('tests/ui-regression.spec.js')
s=test.read_text(encoding='utf-8')
assert 'release assets use v2.6.40 cache-busting URLs' in s
s=s.replace('release assets use v2.6.40 cache-busting URLs','release assets use v2.6.41 cache-busting URLs')
s=s.replace('style.css?v=2.6.40','style.css?v=2.6.41')
s=s.replace('app.js?v=2.6.40','app.js?v=2.6.41')
assert 'reference visual theme applies on phone, tablet and PC' not in s
s+='''

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
'''
test.write_text(s,encoding='utf-8')
