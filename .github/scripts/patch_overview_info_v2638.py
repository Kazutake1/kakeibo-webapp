from pathlib import Path

# v2.6.38: smartphone overview explanations move behind compact info buttons / bottom sheet.

index = Path('index.html')
s = index.read_text(encoding='utf-8')
assert 'style.css?v=2.6.37' in s and 'app.js?v=2.6.37' in s, 'v2.6.37 asset refs not found'
assert 'v2.6.37 Stable' in s, 'v2.6.37 badge not found'
old_full = '''      <div class="mobile-full-entry" id="mobileFullEntry">
        <div class="mobile-full-head"><strong>詳細入力</strong><span class="mobile-full-badge">全項目</span></div>
        <div class="mobile-full-body">
          <p class="mobile-full-note">収入・社会保険／税金・貯蓄・自己投資・固定費・特別費・変動費は、ここから入力できます。</p>
          <button class="secondary full-entry-btn" id="quickFullBtn" type="button">詳細入力を開く</button>
        </div>
      </div>'''
new_full = '''      <div class="mobile-full-entry" id="mobileFullEntry">
        <div class="mobile-full-head"><div class="mobile-full-title-row"><strong>詳細入力</strong><button class="mobile-full-info-btn overview-info-btn" id="mobileFullInfoBtn" type="button" aria-label="詳細入力の説明を表示">i</button></div><span class="mobile-full-badge">全項目</span></div>
        <div class="mobile-full-body">
          <p class="mobile-full-note">収入・社会保険／税金・貯蓄・自己投資・固定費・特別費・変動費は、ここから入力できます。</p>
          <button class="secondary full-entry-btn" id="quickFullBtn" type="button">詳細入力を開く</button>
        </div>
      </div>'''
assert old_full in s, 'mobile full entry block not found'
s = s.replace(old_full, new_full, 1)

insert_before = '''<dialog id="syncChoiceDialog" class="sync-choice-dialog" aria-labelledby="syncChoiceTitle" aria-describedby="syncChoiceMessage">'''
info_dialog = '''<dialog id="overviewInfoDialog" class="overview-info-dialog" aria-labelledby="overviewInfoTitle" aria-describedby="overviewInfoText">
  <div class="overview-info-handle" aria-hidden="true"></div>
  <div class="overview-info-head"><span class="overview-info-kicker">項目の説明</span><div class="dialog-head" id="overviewInfoTitle">説明</div></div>
  <div class="overview-info-body">
    <p id="overviewInfoText"></p>
    <button class="primary overview-info-close" id="overviewInfoClose" type="button">閉じる</button>
  </div>
</dialog>

'''
assert insert_before in s and 'id="overviewInfoDialog"' not in s, 'overview info dialog insertion point invalid'
s = s.replace(insert_before, info_dialog + insert_before, 1)

s = s.replace('style.css?v=2.6.37', 'style.css?v=2.6.38', 1)
s = s.replace('app.js?v=2.6.37', 'app.js?v=2.6.38', 1)
s = s.replace('v2.6.37 Stable', 'v2.6.38 Stable')
index.write_text(s, encoding='utf-8')

app = Path('app.js')
s = app.read_text(encoding='utf-8')
old_summary = '''function renderSummary(){
  const income=typeSum('income');
  const expense=sum(['tax','saving','self','fixed','special','variable'].map(effectiveTypeSum));
  const fixedBudget=budgetTypeSum('fixed');
  const variable=typeSum('variable');
  const budgetVar=budgetTypeSum('variable');
  const balance=income-expense;
  const data=[
    ['収入',income,'当月の実績'],
    ['支出',expense,'固定費は予算額を自動計上'],
    ['収支',balance,balance>=0?'黒字':'赤字'],
    ['固定費',fixedBudget,'予算＝当月支出'],
    ['変動費',variable,`予算残り ${money(budgetVar-variable)}`]
  ];
  document.querySelector('#summaryCards').innerHTML=data.map(([l,v,s])=>`<div class="metric"><div class="label">${l}</div><div class="value ${l==='収支'?(v>=0?'pos':'neg'):(l==='変動費'&&budgetVar>0&&v>budgetVar?'neg':'')}">${money(v)}</div><div class="sub">${s}</div></div>`).join('')
}'''
new_summary = '''const OVERVIEW_INFO={
  income:{title:'収入',text:'当月に登録された収入の実績です。'},
  expense:{title:'支出',text:'社会保険・税金、貯蓄、自己投資、固定費、特別費、変動費の合計です。固定費は予算額を当月支出として自動計上します。'},
  balance:{title:'収支',text:'収入から当月の支出を差し引いた金額です。プラスは黒字、マイナスは赤字として表示します。'},
  fixed:{title:'固定費',text:'設定した固定費予算を当月支出として自動計上しています。'},
  variable:{title:'変動費',text:'当月に入力した変動費の合計です。予算残りは、変動費予算から使用額を差し引いた金額です。'},
  detail:{title:'詳細入力',text:'収入・社会保険／税金・貯蓄・自己投資・固定費・特別費・変動費のすべての項目を入力できます。'}
};
function openOverviewInfo(key){
  const info=OVERVIEW_INFO[key],dialog=document.getElementById('overviewInfoDialog');
  if(!info||!dialog)return;
  document.getElementById('overviewInfoTitle').textContent=info.title;
  document.getElementById('overviewInfoText').textContent=info.text;
  if(!dialog.open)dialog.showModal();
}
function initOverviewInfo(){
  const dialog=document.getElementById('overviewInfoDialog');
  const close=document.getElementById('overviewInfoClose');
  const detail=document.getElementById('mobileFullInfoBtn');
  if(close)close.onclick=()=>dialog?.close();
  if(detail)detail.onclick=()=>openOverviewInfo('detail');
}
function renderSummary(){
  const income=typeSum('income');
  const expense=sum(['tax','saving','self','fixed','special','variable'].map(effectiveTypeSum));
  const fixedBudget=budgetTypeSum('fixed');
  const variable=typeSum('variable');
  const budgetVar=budgetTypeSum('variable');
  const balance=income-expense;
  const data=[
    ['income','収入',income,'当月の実績','explainer'],
    ['expense','支出',expense,'固定費は予算額を自動計上','explainer'],
    ['balance','収支',balance,balance>=0?'黒字':'赤字','status'],
    ['fixed','固定費',fixedBudget,'予算＝当月支出','explainer'],
    ['variable','変動費',variable,`予算残り ${money(budgetVar-variable)}`,'status']
  ];
  const root=document.querySelector('#summaryCards');
  root.innerHTML=data.map(([key,l,v,s,subKind])=>`<div class="metric"><div class="metric-label-row"><div class="label">${l}</div><button type="button" class="summary-info-btn overview-info-btn" data-info-key="${key}" aria-label="${l}の説明を表示">i</button></div><div class="value ${l==='収支'?(v>=0?'pos':'neg'):(l==='変動費'&&budgetVar>0&&v>budgetVar?'neg':'')}">${money(v)}</div><div class="sub summary-${subKind}">${s}</div></div>`).join('');
  root.querySelectorAll('.summary-info-btn').forEach(btn=>btn.onclick=()=>openOverviewInfo(btn.dataset.infoKey));
}'''
assert old_summary in s, 'renderSummary block not found'
s = s.replace(old_summary, new_summary, 1)
old_init = 'initNav();populateType();initQuickEntry();initTheme();initMobileDaily();\nrender();'
new_init = 'initNav();populateType();initQuickEntry();initTheme();initMobileDaily();initOverviewInfo();\nrender();'
assert old_init in s, 'init sequence not found'
s = s.replace(old_init, new_init, 1)
app.write_text(s, encoding='utf-8')

style = Path('style.css')
s = style.read_text(encoding='utf-8')
assert '/* v2.6.38: smartphone overview info sheets */' not in s, 'v2.6.38 styles already exist'
s += r'''


/* v2.6.38: smartphone overview info sheets */
.metric-label-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.overview-info-btn{
  display:none;
  width:24px;height:24px;
  align-items:center;justify-content:center;
  flex:0 0 24px;
  padding:0;
  border:1px solid var(--line);
  border-radius:50%;
  background:var(--paper);
  color:var(--accent);
  font-size:13px;
  font-weight:850;
  line-height:1;
}
.overview-info-dialog{width:min(92vw,520px);max-width:520px;padding:0;overflow:hidden}
.overview-info-handle{display:none}
.overview-info-head{padding:17px 19px 13px;border-bottom:1px solid var(--line-soft);background:var(--header2)}
.overview-info-kicker{display:block;margin-bottom:4px;font-size:11px;font-weight:800;letter-spacing:.06em;color:var(--muted)}
.overview-info-dialog .dialog-head{padding:0;background:transparent;color:var(--text);font-size:20px}
.overview-info-body{padding:18px 19px 19px}
.overview-info-body p{margin:0;color:var(--text);font-size:14px;line-height:1.75}
.overview-info-close{width:100%;margin-top:18px;min-height:46px}
body.dark-mode .overview-info-dialog .dialog-head{background:transparent!important;color:var(--text)!important}
body.dark-mode .overview-info-btn{background:#172638;border-color:#30465d;color:#8ec8ff}

@media(max-width:700px){
  .summary-info-btn,.mobile-full-info-btn{display:inline-flex}
  .metric .sub.summary-explainer{display:none}
  .mobile-full-note{display:none}
  .mobile-full-title-row{display:flex;align-items:center;gap:8px;min-width:0}
  .mobile-full-info-btn{width:26px;height:26px;flex-basis:26px}
  .mobile-full-body{padding-top:4px}
  .overview-info-dialog{
    width:100vw;max-width:none;
    margin:0;
    position:fixed;left:0;right:0;bottom:0;top:auto;
    border:0;
    border-radius:24px 24px 0 0;
    padding-bottom:env(safe-area-inset-bottom);
  }
  .overview-info-handle{display:block;width:40px;height:5px;border-radius:999px;background:#cbd8e8;margin:9px auto 1px}
  .overview-info-head{padding:10px 18px 10px;background:transparent;border-bottom:0}
  .overview-info-dialog .dialog-head{font-size:19px}
  .overview-info-body{padding:2px 18px 18px}
  .overview-info-body p{font-size:14px;line-height:1.8}
  body.dark-mode .overview-info-handle{background:#496079}
}
'''
style.write_text(s, encoding='utf-8')

sw = Path('sw.js')
s = sw.read_text(encoding='utf-8')
assert "kakeibo-v2.6.37-stable" in s, 'v2.6.37 cache name not found'
assert "./style.css?v=2.6.37" in s and "./app.js?v=2.6.37" in s, 'v2.6.37 APP_SHELL refs not found'
s = s.replace("kakeibo-v2.6.37-stable", "kakeibo-v2.6.38-stable", 1)
s = s.replace("./style.css?v=2.6.37", "./style.css?v=2.6.38", 1)
s = s.replace("./app.js?v=2.6.37", "./app.js?v=2.6.38", 1)
sw.write_text(s, encoding='utf-8')

readme = Path('README.md')
s = readme.read_text(encoding='utf-8')
assert s.startswith('# 家計簿Webアプリ v2.6.37 Stable'), 'README version heading unexpected'
marker = '## v2.6.37 Stable\n'
pos = s.find(marker)
assert pos != -1, 'v2.6.37 release section not found'
release = '''# 家計簿Webアプリ v2.6.38 Stable\n\nExcel家計簿をベースにした iPhone / iPad / Mac 対応のレスポンシブPWAです。\n\n## v2.6.38 Stable\n- スマホ版の概要カードで、補足説明を通常表示からタイトル横の情報ボタンへ移動\n- 情報ボタンをタップすると、画面下から項目説明のボトムシートを表示\n- 収支の「黒字／赤字」と変動費の「予算残り」は状態情報として従来どおり常時表示\n- 「詳細入力」の長い説明文も通常は隠し、情報ボタンから確認できるよう整理\n- PC・iPad版の概要表示、金額計算、入力・保存仕様は変更なし\n\n'''
s = release + s[pos:]
readme.write_text(s, encoding='utf-8')

test = Path('tests/ui-regression.spec.js')
s = test.read_text(encoding='utf-8')
s = s.replace('release assets use v2.6.37 cache-busting URLs', 'release assets use v2.6.38 cache-busting URLs')
s = s.replace('style.css?v=2.6.37', 'style.css?v=2.6.38')
s = s.replace('app.js?v=2.6.37', 'app.js?v=2.6.38')
name = "smartphone overview hides explanatory copy behind info sheets"
if name not in s:
    s += r'''


test('smartphone overview hides explanatory copy behind info sheets', async ({ page }) => {
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
});
'''
test.write_text(s, encoding='utf-8')
