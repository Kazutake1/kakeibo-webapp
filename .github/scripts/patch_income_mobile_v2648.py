from pathlib import Path


def change(path, old, new):
    file = Path(path)
    source = file.read_text(encoding='utf-8')
    assert source.count(old) == 1, (path, 'expected one anchor', source.count(old), old[:90])
    file.write_text(source.replace(old, new, 1), encoding='utf-8')


# Add one income category without renaming/reordering existing categories or removing user entries.
change('app.js',
       "  income:['給与','ボーナス','配当収入'],",
       "  income:['給与','ボーナス','配当収入','その他の収入'],")
change('app.js',
       "    categories[t.key]=[...new Set(raw.map(x=>cleanText(x,80)).filter(Boolean))].slice(0,200);",
       "    categories[t.key]=[...new Set(raw.map(x=>cleanText(x,80)).filter(Boolean))].slice(0,200);\n    if(t.key==='income'&&!categories.income.includes('その他の収入'))categories.income.push('その他の収入');")

# Only the iPhone income panel receives the redesigned graph, actions and monthly categories.
old_income = '''      <div class="mobile-daily" id="mobileIncome">
        <div class="mobile-month-calendar" id="incomeMonthCalendar" aria-label="収入カレンダー"></div>
        <div class="mobile-day-card">'''
new_income = '''      <div class="income-mobile-overview" id="incomeMobileOverview">
        <section class="income-graph-card" aria-label="収入の推移">
          <div class="income-graph-head">
            <div class="income-graph-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v13c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 9c0 1.7 3.1 3 7 3s7-1.3 7-3M5 14c0 1.7 3.1 3 7 3s7-1.3 7-3"/></svg></div>
            <div class="income-graph-summary"><span id="incomeGraphTitle">今月の収入</span><strong id="incomeGraphTotal">¥0</strong><small id="incomeGraphCompare">前月比 ― ―</small></div>
            <label class="income-period-wrap"><span class="sr-only">グラフの集計期間</span><select id="incomeGraphPeriod" aria-label="グラフの集計期間"><option value="month">月間</option><option value="year">年間</option></select></label>
          </div>
          <div class="income-chart-bars" id="incomeGraphBars" role="group" aria-label="収入推移のグラフ"></div>
        </section>
        <div class="income-mini-cards">
          <button class="income-add-card" id="incomeAddCard" type="button"><span class="income-add-symbol" aria-hidden="true">＋</span><span class="income-add-copy"><strong>収入を追加</strong><small>給与・ボーナス・その他の収入を記録</small></span><span class="income-add-arrow" aria-hidden="true">›</span></button>
          <section class="income-total-card" aria-label="収入合計"><span class="income-total-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 10h18M16 15h5M6 6V4a1 1 0 0 1 1-1h11"/></svg></span><span class="income-total-copy"><span>収入合計</span><strong id="incomeMiniTotal">¥0</strong><small id="incomeMiniCount">0件の入金</small></span></section>
        </div>
        <section class="income-categories-card" aria-label="収入のカテゴリ">
          <div class="income-categories-head"><h2>収入のカテゴリ</h2><button id="incomeViewAll" type="button">すべて見る <span aria-hidden="true">›</span></button></div>
          <div class="income-categories-list" id="incomeMonthCategories"></div>
        </section>
      </div>
      <div class="mobile-daily" id="mobileIncome">
        <div class="mobile-day-card">'''
change('index.html', old_income, new_income)

income_dialog = '''<dialog id="incomeMonthDialog" class="income-month-dialog" aria-labelledby="incomeMonthTitle">
  <div class="dialog-head" id="incomeMonthTitle">収入明細</div>
  <div class="dialog-body">
    <p id="incomeMonthMeta" class="income-month-meta"></p>
    <div id="incomeMonthRows" class="income-month-rows"></div>
    <div class="dialog-actions"><button type="button" class="secondary" id="incomeMonthClose">閉じる</button><button type="button" class="primary" id="incomeMonthAdd">＋ 追加</button></div>
  </div>
</dialog>

'''
change('index.html', '<dialog id="syncChoiceDialog"', income_dialog + '<dialog id="syncChoiceDialog"')

# Reuse the existing add/edit transaction dialog, daily editor, saveState, and cloud sync.
income_logic = '''// iPhone income dashboard: real transactions only; zero months never receive fabricated bars.
let incomeGraphPeriod='month';
let incomeDetailCategory=null;
function incomePeriodTotal(date,period){
  const key=period==='year'?String(date.getFullYear()):ym(date);
  return sum(state.transactions.filter(t=>t.type==='income'&&t.date.startsWith(key)).map(t=>t.amount));
}
function renderMobileIncomeOverview(){
  const root=document.getElementById('incomeMobileOverview');
  if(!root)return;
  const year=current.getFullYear(),month=current.getMonth();
  const selected=new Date(year,month,1);
  const annual=incomeGraphPeriod==='year';
  const total=incomePeriodTotal(selected,incomeGraphPeriod);
  const previous=incomePeriodTotal(annual?new Date(year-1,month,1):new Date(year,month-1,1),incomeGraphPeriod);
  document.getElementById('incomeGraphTitle').textContent=annual?`${year}年の収入`:(ym()===ym(new Date())?'今月の収入':`${month+1}月の収入`);
  document.getElementById('incomeGraphTotal').textContent=money(total);
  const difference=previous?`${total>=previous?'+':''}${Math.round((total-previous)/previous*100)}%`:'― ―';
  document.getElementById('incomeGraphCompare').textContent=`${annual?'前年比':'前月比'} ${difference}`;
  document.getElementById('incomeGraphPeriod').value=incomeGraphPeriod;
  const periods=Array.from({length:9},(_,index)=>{
    const offset=index-5;
    const date=annual?new Date(year+offset,month,1):new Date(year,month+offset,1);
    return {date,amount:incomePeriodTotal(date,incomeGraphPeriod),selected:offset===0};
  });
  const max=Math.max(1,...periods.map(p=>p.amount));
  document.getElementById('incomeGraphBars').innerHTML=periods.map(p=>{
    const fraction=p.amount/max;
    const height=p.amount?Math.max(4,Math.round(82*fraction)):0;
    const caption=annual?`${p.date.getFullYear()}年`:`${p.date.getMonth()+1}月`;
    const value=p.amount?money(p.amount):'¥0';
    return `<button type="button" class="income-chart-column${p.selected?' selected':''}" data-income-period="${annual?p.date.getFullYear():ym(p.date)}" aria-label="${caption}の収入 ${value}${p.selected?'、選択中':''}"><span class="income-chart-track"><span class="income-chart-bar" style="height:${height}%"></span>${p.selected?`<span class="income-chart-tag">${value}</span>`:''}</span><span class="income-chart-label">${caption}</span></button>`;
  }).join('');
  const monthItems=monthTx().filter(t=>t.type==='income');
  document.getElementById('incomeMiniTotal').textContent=money(sum(monthItems.map(t=>t.amount)));
  document.getElementById('incomeMiniCount').textContent=`${monthItems.length}件の入金`;
  const categories=catsFor('income');
  const icons=[
    '<rect x="4" y="7" width="16" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M4 12h16M10 12v2h4v-2"/>',
    '<rect x="4" y="9" width="16" height="12" rx="2"/><path d="M12 9v12M4 13h16M12 9c-4 0-6-2-5-4 1-3 5-1 5 4Zm0 0c4 0 6-2 5-4-1-3-5-1-5 4Z"/>',
    '<path d="M3 18h18M5 14l5-5 4 3 5-7M15 5h4v4"/>',
    '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
  ];
  document.getElementById('incomeMonthCategories').innerHTML=categories.map((category,index)=>{
    const rows=monthItems.filter(t=>t.category===category);
    const amount=sum(rows.map(t=>t.amount));
    const icon=icons[Math.min(index,3)];
    const encoded=encodeArg(category);
    return `<button type="button" class="income-category-row" onclick="openIncomeMonthDetail('${encoded}')"><span class="income-category-symbol color-${index%4}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icon}</svg></span><span class="income-category-name"><strong>${escapeHtml(category)}</strong><small>今月の合計 ${money(amount)}</small></span><span class="income-category-count">${rows.length}件</span><span class="income-category-arrow" aria-hidden="true">›</span></button>`;
  }).join('');
}
function openIncomeFromCard(category=''){
  openTx();
  txDialogTitle.textContent='収入を追加';
  txType.value='income';
  updateCats();
  txDate.value=localDateKey(mobileDailyDate);
  if(category&&catsFor('income').includes(category))txCategory.value=category;
}
function renderIncomeMonthDetail(){
  const dialog=document.getElementById('incomeMonthDialog');
  if(!dialog)return;
  const category=incomeDetailCategory;
  const rows=monthTx().filter(t=>t.type==='income'&&(category===null||t.category===category))
    .sort((a,b)=>b.date.localeCompare(a.date));
  document.getElementById('incomeMonthTitle').textContent=category?`${category}の明細`:'収入明細';
  document.getElementById('incomeMonthMeta').textContent=`${current.getFullYear()}年${current.getMonth()+1}月 ・ ${rows.length}件 ・ 合計 ${money(sum(rows.map(t=>t.amount)))}`;
  document.getElementById('incomeMonthRows').innerHTML=rows.length?rows.map(t=>{
    const detail=[t.item,t.memo].filter(Boolean).map(x=>escapeHtml(x)).join(' ・ ');
    return `<div class="income-month-row"><span class="income-month-entry"><strong>${money(t.amount)}</strong><small>${escapeHtml(t.date.slice(5).replace('-','/'))} ・ ${escapeHtml(t.category)}${detail?' ・ '+detail:''}</small></span><span class="income-month-actions"><button type="button" onclick="editIncomeMonthTx('${encodeArg(t.id)}')">編集</button><button type="button" class="income-month-delete" onclick="deleteIncomeMonthTx('${encodeArg(t.id)}')">削除</button></span></div>`;
  }).join(''):'<div class="daily-history-empty">この月の収入はありません</div>';
}
window.openIncomeMonthDetail=(encoded=null)=>{
  incomeDetailCategory=encoded===null?null:decodeURIComponent(encoded);
  renderIncomeMonthDetail();
  const dialog=document.getElementById('incomeMonthDialog');
  if(!dialog.open)dialog.showModal();
};
window.editIncomeMonthTx=encoded=>{
  const id=decodeURIComponent(encoded);
  if(!monthTx().some(t=>t.type==='income'&&t.id===id))return;
  document.getElementById('incomeMonthDialog').close();
  openTx(id);
};
window.deleteIncomeMonthTx=encoded=>{
  const id=decodeURIComponent(encoded);
  const index=state.transactions.findIndex(t=>t.id===id&&t.type==='income'&&t.date.startsWith(ym()));
  if(index<0)return;
  const tx=state.transactions[index];
  if(!confirm(`${tx.date} の「${tx.category}」 ${money(tx.amount)} を削除しますか？`))return;
  const removed=state.transactions.splice(index,1)[0];
  if(!saveState()){state.transactions.splice(index,0,removed);return}
  render();
  renderIncomeMonthDetail();
};
function initIncomeMobileOverview(){
  const period=document.getElementById('incomeGraphPeriod');
  if(!period)return;
  period.onchange=()=>{incomeGraphPeriod=period.value==='year'?'year':'month';renderMobileIncomeOverview()};
  document.getElementById('incomeGraphBars').onclick=e=>{
    const button=e.target.closest('[data-income-period]');
    if(!button)return;
    const value=button.dataset.incomePeriod;
    const date=incomeGraphPeriod==='year'?new Date(Number(value),current.getMonth(),Math.min(mobileDailyDate.getDate(),28)):dateFromPickerValue(value+'-01');
    if(date)setMobileDailyDate(date);
  };
  document.getElementById('incomeAddCard').onclick=()=>openIncomeFromCard();
  document.getElementById('incomeViewAll').onclick=()=>window.openIncomeMonthDetail();
  document.getElementById('incomeMonthClose').onclick=()=>document.getElementById('incomeMonthDialog').close();
  document.getElementById('incomeMonthAdd').onclick=()=>{
    const category=incomeDetailCategory;
    document.getElementById('incomeMonthDialog').close();
    openIncomeFromCard(category||'');
  };
}

'''
change('app.js', "function renderMobileDaily(){\n  renderMobilePage('expense');\n  renderMobilePage('income');\n}", income_logic + "function renderMobileDaily(){\n  renderMobilePage('expense');\n  renderMobilePage('income');\n  renderMobileIncomeOverview();\n}")
change('app.js', "initNav();populateType();initQuickEntry();initTheme();initMobileDaily();", "initNav();populateType();initQuickEntry();initTheme();initMobileDaily();initIncomeMobileOverview();")

# Keep original date picker/day card and its working per-entry edit/delete sheet. The deleted
# monthly income calendar is absent, while the expense calendar and desktop calendar remain.
css = Path('style.css')
source = css.read_text(encoding='utf-8')
assert 'v2.6.48' not in source
css.write_text(source + '''

/* v2.6.48: iPhone income page only. Retain the original daily entry and editing card. */
.income-mobile-overview{display:none}
@media(max-width:700px){
  .income-panel .income-mobile-overview{display:grid;gap:12px;margin-bottom:12px;min-width:0}
  .income-graph-card,.income-total-card,.income-categories-card{
    background:var(--card);border:1px solid var(--line-soft);box-shadow:var(--shadow);border-radius:22px;
  }
  .income-graph-card{padding:15px 13px 13px;overflow:hidden}
  .income-graph-head{display:flex;align-items:flex-start;gap:10px;min-width:0}
  .income-graph-mark,.income-total-symbol,.income-category-symbol{
    display:flex;flex:none;align-items:center;justify-content:center;background:#e9f3ff;color:#246ed5;border-radius:50%;
  }
  .income-graph-mark{width:42px;height:42px}
  .income-graph-mark svg{width:25px;height:25px}
  .income-graph-summary{display:flex;flex:1;min-width:0;flex-direction:column}
  .income-graph-summary>span{font-weight:750;font-size:13px;color:var(--muted)}
  .income-graph-summary strong{font-weight:850;font-size:26px;color:var(--text);line-height:1.22;margin-top:4px;font-variant-numeric:tabular-nums}
  .income-graph-summary small{font-size:11px;color:var(--muted);margin-top:5px}
  .income-period-wrap{flex:0 0 auto}
  .income-period-wrap select{appearance:none;-webkit-appearance:none;cursor:pointer;border:0;border-radius:999px;padding:8px 24px 8px 12px;background:#e9f3ff;color:#284f84;font-size:12px;font-weight:750;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='m1 1 5 5 5-5' fill='none' stroke='%23256bcc' stroke-width='1.7'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center}
  .income-chart-bars{display:grid;grid-template-columns:repeat(9,minmax(0,1fr));align-items:end;column-gap:4px;margin-top:13px;border-bottom:1px solid #dce9fb;min-width:0}
  .income-chart-column{min-width:0;background:none;border:0;padding:0;color:var(--muted);display:flex;flex-direction:column;align-items:center;cursor:pointer}
  .income-chart-track{height:126px;width:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;position:relative}
  .income-chart-bar{display:block;width:min(75%,28px);min-height:0;border-radius:5px 5px 0 0;background:#d7eaff;flex:none}
  .income-chart-column.selected .income-chart-bar{background:linear-gradient(180deg,#419bf5,#2679e9)}
  .income-chart-tag{position:absolute;bottom:calc(82% + 5px);left:50%;transform:translateX(-50%);background:#e9f3ff;color:#1c4678;padding:3px 6px;border-radius:999px;font-size:10px;font-weight:800;white-space:nowrap;line-height:1.3;pointer-events:none}
  .income-chart-column.selected .income-chart-tag{bottom:calc(var(--unused,0px) + 10px)}
  .income-chart-label{font-size:10px;font-weight:650;white-space:nowrap;padding:8px 0 0;line-height:1.5}
  .income-chart-column.selected .income-chart-label{color:#1975e2;font-weight:850}
  .income-mini-cards{display:grid;grid-template-columns:1fr 1fr;gap:9px;min-width:0}
  .income-add-card{border:0;border-radius:21px;background:linear-gradient(115deg,#3280ec 0%,#3196f4 52%,#35cbe1 100%);box-shadow:0 10px 22px rgba(41,129,229,.17);color:#fff;display:flex;align-items:center;gap:9px;padding:15px 11px;text-align:left;min-width:0;min-height:108px}
  .income-add-symbol{background:#fff;color:#2676dd;border-radius:50%;width:42px;height:42px;flex:0 0 42px;display:flex;align-items:center;justify-content:center;font-size:31px;font-weight:400;line-height:1}
  .income-add-copy{min-width:0;flex:1;display:flex;flex-direction:column;gap:4px}
  .income-add-copy strong{font-size:15px;line-height:1.2;white-space:nowrap}
  .income-add-copy small{font-size:10px;line-height:1.4;overflow-wrap:anywhere}
  .income-add-arrow{font-size:24px;line-height:1;font-weight:300}
  .income-total-card{display:flex;align-items:center;gap:9px;min-width:0;padding:12px 10px}
  .income-total-symbol{width:39px;height:39px;flex-basis:39px;background:#e9fff9;color:#12a287}
  .income-total-symbol svg{width:23px;height:23px}
  .income-total-copy{display:flex;min-width:0;flex-direction:column;gap:3px}
  .income-total-copy>span{color:var(--muted);font-size:12px;font-weight:750}
  .income-total-copy strong{font-size:21px;letter-spacing:-.025em;color:var(--text);font-variant-numeric:tabular-nums;white-space:nowrap}
  .income-total-copy small{font-size:11px;color:var(--muted);white-space:nowrap}
  .income-categories-card{padding:13px 11px 10px;min-width:0}
  .income-categories-head{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:0 4px 9px}
  .income-categories-head h2{font-size:17px;margin:0;color:var(--text)}
  .income-categories-head button{border:0;background:none;color:#1975e2;font-weight:700;font-size:12px;padding:4px 0;white-space:nowrap}
  .income-categories-head button span{font-size:19px;vertical-align:-1px}
  .income-categories-list{border:1px solid var(--line-soft);border-radius:16px;overflow:hidden}
  .income-category-row{display:flex;align-items:center;gap:10px;width:100%;background:none;border:0;border-bottom:1px solid var(--line-soft);color:var(--text);padding:8px;text-align:left;min-width:0}
  .income-category-row:last-child{border-bottom:0}
  .income-category-symbol{width:37px;height:37px;flex-basis:37px;border-radius:13px}
  .income-category-symbol svg{width:22px;height:22px}
  .income-category-symbol.color-1{background:#e6fff5;color:#109c70}
  .income-category-symbol.color-2{background:#eaf2ff;color:#2c78ce}
  .income-category-symbol.color-3{background:#f2edff;color:#7045d3}
  .income-category-name{display:flex;flex:1;min-width:0;flex-direction:column;gap:2px}
  .income-category-name strong{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .income-category-name small{font-size:10px;color:var(--muted);white-space:nowrap}
  .income-category-count{color:var(--muted);font-size:11px;white-space:nowrap}
  .income-category-arrow{color:#718aaa;font-size:21px}
  /* Do not remove or replace the previous income day editor; preserve its date and controls. */
  .income-panel #mobileIncome .mobile-day-card{margin-top:0}
  .income-month-dialog{width:min(94vw,540px);max-height:86dvh;overflow:auto}
  .income-month-meta{font-size:12px;color:var(--muted);margin:0 0 12px;line-height:1.6}
  .income-month-row{display:flex;align-items:center;justify-content:space-between;gap:7px;border-bottom:1px solid var(--line-soft);padding:12px 0}
  .income-month-entry{display:flex;min-width:0;flex:1;flex-direction:column;gap:4px}
  .income-month-entry strong{font-size:16px;color:var(--text);font-variant-numeric:tabular-nums}
  .income-month-entry small{font-size:11px;color:var(--muted);overflow-wrap:anywhere}
  .income-month-actions{display:flex;gap:5px;flex:none}
  .income-month-actions button{border-radius:9px;border:1px solid var(--line);background:#eaf4ff;color:#246ad3;padding:7px 8px;font-weight:750;font-size:12px}
  .income-month-actions button.income-month-delete{background:#fff1f2;border-color:#fecaca;color:#dc2626}
  body.dark-mode .income-graph-card,body.dark-mode .income-total-card,body.dark-mode .income-categories-card{background:var(--card);border-color:var(--line-soft)}
  body.dark-mode .income-graph-mark,body.dark-mode .income-category-symbol{background:#203b60;color:#83bdff}
  body.dark-mode .income-total-symbol{background:#133d3b;color:#6ad5b8}
  body.dark-mode .income-period-wrap select,body.dark-mode .income-chart-tag{background-color:#203b60;color:#bed9ff}
  body.dark-mode .income-chart-bar{background:#355779}
  body.dark-mode .income-chart-column.selected .income-chart-bar{background:#4397f0}
  body.dark-mode .income-chart-bars{border-bottom-color:#34516f}
  body.dark-mode .income-categories-list,body.dark-mode .income-category-row,body.dark-mode .income-month-row{border-color:var(--line-soft)}
  body.dark-mode .income-month-actions button{background:#203b60;border-color:#36516f;color:#afceff}
  body.dark-mode .income-month-actions button.income-month-delete{background:#35202c;border-color:#673849;color:#ffa4ae}
}
@media(max-width:360px){
  .income-add-card{padding:10px 8px;gap:6px}
  .income-add-symbol{width:35px;height:35px;flex-basis:35px;font-size:27px}
  .income-add-copy strong{font-size:13px}
  .income-add-arrow{display:none}
  .income-total-card{gap:6px;padding:10px 7px}
  .income-total-symbol{width:33px;height:33px;flex-basis:33px}
  .income-total-copy strong{font-size:18px}
}
.sr-only{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
''', encoding='utf-8')

# Asset versioning prevents stale PWA cache; keep storage keys and sync untouched.
for name in ['index.html', 'sw.js', 'tests/ui-regression.spec.js']:
    f=Path(name)
    data=f.read_text(encoding='utf-8')
    assert '2.6.47' in data and '2.6.48' not in data, name
    f.write_text(data.replace('2.6.47','2.6.48'), encoding='utf-8')

readme=Path('README.md')
text=readme.read_text(encoding='utf-8')
assert text.startswith('# 家計簿Webアプリ v2.6.47 Stable\n')
readme.write_text(text.replace('# 家計簿Webアプリ v2.6.47 Stable', '# 家計簿Webアプリ v2.6.48 Stable', 1).replace('## v2.6.47 Stable', '''## v2.6.48 Stable
- iPhone版収入カレンダーを収入推移グラフ・左の青〜シアングラデーション「収入を追加」カード・右の収入合計カードに置換
- 収入履歴の常設カードや平均収入カードは設けず、4カテゴリ別の月合計を表示。明細画面で個別収入を編集・削除可能
- 元の収入日別入力カードと編集・削除ダイアログは残し、iPad・PCの収入カレンダーは維持
- 給与・ボーナス・配当収入の名称を保持して「その他の収入」を追加。既存の取引データと同期は維持

## v2.6.47 Stable''',1), encoding='utf-8')

# Concrete Playwright tests for layout, data, period switch, CRUD and platform isolation.
tests=Path('tests/ui-regression.spec.js')
text=tests.read_text(encoding='utf-8')
text += '''

test('iPhone income redesign shows graph, action, total, exactly four default categories and keeps day editor',async({page})=>{
  for(const width of [320,375,390,430]){
    await page.setViewportSize({width,height:844});
    await openApp(page);
    await page.locator('#mobileNav [data-tab="income"]').click();
    await expect(page.locator('#incomeMonthCalendar')).toHaveCount(0);
    await expect(page.locator('#incomeMobileOverview')).toBeVisible();
    await expect(page.locator('#incomeGraphBars .income-chart-column')).toHaveCount(9);
    await expect(page.locator('#incomeAddCard')).toBeVisible();
    await expect(page.locator('#incomeMiniTotal')).toHaveText('¥0');
    await expect(page.locator('#incomeMonthCategories .income-category-row')).toHaveCount(4);
    const names=await page.locator('#incomeMonthCategories .income-category-name strong').allTextContents();
    expect(names).toEqual(['給与','ボーナス','配当収入','その他の収入']);
    await expect(page.locator('#incomeDayTotal')).toBeVisible();
    await expect(page.locator('#incomeDatePicker')).toBeVisible();
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
  await columns.nth(4).click();
  await expect(page.locator('#incomeMiniTotal')).toHaveText('¥80,000');
  await expect(page.locator('#monthLabel')).toContainText(`${previous.getFullYear()}年${previous.getMonth()+1}月`);
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

test('iPad and PC retain income daily calendar while mobile-only redesign remains hidden',async({page})=>{
  for(const width of [820,1440]){
    await page.setViewportSize({width,height:900});
    await openApp(page);
    await page.locator('#tabs [data-tab="income"]').click();
    await expect(page.locator('#incomeCalendarWrap .cal-table')).toBeVisible();
    await expect(page.locator('#incomeMobileOverview')).toBeHidden();
    await expect(page.locator('#mobileIncome')).toBeHidden();
  }
});
'''
tests.write_text(text,encoding='utf-8')
print('Prepared v2.6.48 scoped iPhone income redesign, category addition, and end-to-end tests.')