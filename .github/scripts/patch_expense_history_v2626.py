from pathlib import Path

# v2.6.26: add an expense history area without changing existing calendar/input behavior.

app = Path('app.js')
s = app.read_text(encoding='utf-8')

state_marker = "let mobileDailyDate = new Date();"
if "let expenseHistoryFilter='nonvariable';" not in s:
    if state_marker not in s:
        raise SystemExit('mobileDailyDate marker not found')
    s = s.replace(state_marker, state_marker + "\nlet expenseHistoryFilter='nonvariable';", 1)

render_marker = "function renderMobileRecent(){const wrap=document.getElementById('mobileRecentList');"
if 'function renderExpenseHistory(){' not in s:
    pos = s.find(render_marker)
    if pos < 0:
        raise SystemExit('renderMobileRecent marker not found')
    end = s.find('\nfunction renderSummary()', pos)
    if end < 0:
        raise SystemExit('renderSummary marker not found')
    history_code = r'''

const EXPENSE_HISTORY_FILTERS=[
  ['nonvariable','変動費以外'],['all','すべて'],['tax','社会保険・税金'],['saving','貯蓄'],
  ['self','自己投資'],['special','特別費'],['variable','変動費'],['fixed','固定費']
];
function renderExpenseHistory(){
  const filters=document.getElementById('expenseHistoryFilters');
  const list=document.getElementById('expenseHistoryList');
  if(!filters||!list)return;
  filters.innerHTML=EXPENSE_HISTORY_FILTERS.map(([key,label])=>`<button type="button" class="expense-history-filter${expenseHistoryFilter===key?' active':''}" onclick="setExpenseHistoryFilter('${key}')">${label}</button>`).join('');

  let rows=monthTx().filter(t=>t.type!=='income'&&t.type!=='fixed');
  if(expenseHistoryFilter==='nonvariable')rows=rows.filter(t=>t.type!=='variable');
  else if(expenseHistoryFilter!=='all'&&expenseHistoryFilter!=='fixed')rows=rows.filter(t=>t.type===expenseHistoryFilter);
  else if(expenseHistoryFilter==='fixed')rows=[];
  rows=[...rows].sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  const showFixed=expenseHistoryFilter==='nonvariable'||expenseHistoryFilter==='all'||expenseHistoryFilter==='fixed';
  const fixedHtml=showFixed?`<div class="expense-history-row expense-history-fixed" data-expense-type="fixed">
    <div class="expense-history-date">毎月</div>
    <div class="expense-history-main"><span class="expense-history-type">固定費</span><strong>予算から自動計上</strong><span>当月の固定費合計</span></div>
    <div class="expense-history-amount">${money(budgetTypeSum('fixed'))}</div>
    <div class="expense-history-actions"><button type="button" class="expense-history-edit" onclick="openFixedBudgetSettings()">予算設定へ</button></div>
  </div>`:'';

  const txHtml=rows.map(t=>{
    const typeLabel=TYPES.find(x=>x.key===t.type)?.label||t.type;
    const title=t.item||t.category||typeLabel;
    const detail=[t.category,t.memo].map(v=>cleanText(v,500)).filter(Boolean).join(' ・ ');
    const date=(t.date||'').slice(5).replace('-','/');
    return `<div class="expense-history-row" data-expense-type="${escapeHtml(t.type)}" data-expense-id="${escapeHtml(t.id)}">
      <div class="expense-history-date">${escapeHtml(date)}</div>
      <div class="expense-history-main"><span class="expense-history-type">${escapeHtml(typeLabel)}</span><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></div>
      <div class="expense-history-amount">${money(t.amount)}</div>
      <div class="expense-history-actions"><button type="button" class="expense-history-edit" onclick="editTxEncoded('${encodeArg(t.id)}')">編集</button><button type="button" class="expense-history-delete" onclick="deleteExpenseHistoryTx('${encodeArg(t.id)}')">削除</button></div>
    </div>`
  }).join('');
  list.innerHTML=fixedHtml+txHtml||'<div class="expense-history-empty">該当する支出はありません</div>';
}
window.setExpenseHistoryFilter=filter=>{
  if(!EXPENSE_HISTORY_FILTERS.some(([key])=>key===filter))return;
  expenseHistoryFilter=filter;
  renderExpenseHistory();
};
window.deleteExpenseHistoryTx=encoded=>{
  const id=decodeURIComponent(encoded);
  const index=state.transactions.findIndex(t=>t.id===id&&t.type!=='income'&&t.type!=='fixed');
  if(index<0)return;
  const tx=state.transactions[index];
  const typeLabel=TYPES.find(t=>t.key===tx.type)?.label||tx.type;
  if(!confirm(`${tx.date} の「${typeLabel}・${tx.category}」 ${money(tx.amount)} を削除しますか？`))return;
  const removed=state.transactions.splice(index,1)[0];
  if(!saveState()){
    state.transactions.splice(index,0,removed);
    return;
  }
  render();
};
window.openFixedBudgetSettings=()=>showPanel('budget');
'''
    s = s[:end] + history_code + s[end:]

old_render = "function renderCurrentMonthViews(){renderMobileRecent();document.querySelector('#monthLabel').textContent=`${current.getFullYear()}年${current.getMonth()+1}月`;renderSummary();renderBudgetOverview();renderVariableStatus();renderCalendar();renderBudgetEditor();renderItemManager();requestAnimationFrame(()=>requestAnimationFrame(drawCharts))}"
new_render = "function renderCurrentMonthViews(){renderMobileRecent();document.querySelector('#monthLabel').textContent=`${current.getFullYear()}年${current.getMonth()+1}月`;renderSummary();renderBudgetOverview();renderVariableStatus();renderCalendar();renderBudgetEditor();renderItemManager();renderExpenseHistory();requestAnimationFrame(()=>requestAnimationFrame(drawCharts))}"
if old_render in s:
    s = s.replace(old_render, new_render, 1)
elif new_render not in s:
    raise SystemExit('renderCurrentMonthViews target not found')

app.write_text(s, encoding='utf-8')

# Insert the common history card at the bottom of the expense page (visible on PC/iPad/iPhone).
index = Path('index.html')
i = index.read_text(encoding='utf-8')
if 'id="expenseHistoryList"' not in i:
    income_marker = '    <section class="panel income-panel" data-panel="income">'
    pos = i.find(income_marker)
    if pos < 0:
        raise SystemExit('income panel marker not found')
    close = i.rfind('    </section>', 0, pos)
    if close < 0:
        raise SystemExit('expense section close not found')
    block = '''      <div class="card expense-history-card">
        <div class="expense-history-head"><div><h2>支出履歴</h2><p class="hint">当月の支出を確認・編集・削除できます。固定費は予算から自動計上されるため、予算設定から変更します。</p></div></div>
        <div class="card-body"><div class="expense-history-filters" id="expenseHistoryFilters"></div><div class="expense-history-list" id="expenseHistoryList"></div></div>
      </div>
'''
    i = i[:close] + block + i[close:]

i = i.replace('v2.6.25 Stable','v2.6.26 Stable')
index.write_text(i, encoding='utf-8')

# Add only the styles needed for the new expense history card.
style = Path('style.css')
css = style.read_text(encoding='utf-8')
css_marker = '/* v2.6.26: expense history */'
if css_marker not in css:
    css += r'''

/* v2.6.26: expense history */
.expense-history-card{margin-top:16px}
.expense-history-head{padding:18px 20px 0}
.expense-history-head h2{margin:0 0 4px}
.expense-history-head .hint{margin:0}
.expense-history-filters{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.expense-history-filter{border:1px solid var(--line);background:var(--paper);color:var(--text);border-radius:999px;padding:7px 11px;font-size:12px;font-weight:700;cursor:pointer}
.expense-history-filter.active{background:var(--accent);border-color:var(--accent);color:#fff}
.expense-history-list{display:grid;gap:0}
.expense-history-row{display:grid;grid-template-columns:72px minmax(0,1fr) auto auto;gap:14px;align-items:center;padding:13px 0;border-top:1px solid var(--line-soft)}
.expense-history-row:first-child{border-top:0}
.expense-history-fixed{margin-bottom:2px;padding:13px 12px;border:1px solid var(--line-soft);border-radius:12px;background:var(--accent-soft)}
.expense-history-date{font-size:12px;font-weight:750;color:var(--muted)}
.expense-history-main{min-width:0;display:grid;gap:3px}
.expense-history-main strong{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.expense-history-main>span:last-child{font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.expense-history-type{width:max-content;font-size:10px!important;font-weight:800;color:var(--accent)!important;background:var(--accent-soft);border-radius:999px;padding:2px 7px}
.expense-history-fixed .expense-history-type{background:var(--paper)}
.expense-history-amount{font-size:15px;font-weight:850;white-space:nowrap}
.expense-history-actions{display:flex;gap:6px;justify-content:flex-end}
.expense-history-actions button{border:1px solid var(--line);background:var(--paper);color:var(--text);border-radius:8px;padding:7px 9px;font-size:12px;font-weight:750;cursor:pointer}
.expense-history-actions .expense-history-delete{color:#dc2626}
.expense-history-empty{padding:22px 0;text-align:center;color:var(--muted);font-size:13px}
@media(max-width:700px){
  .expense-history-head{padding:16px 16px 0}
  .expense-history-card .card-body{padding-top:12px}
  .expense-history-filters{gap:6px;overflow-x:auto;flex-wrap:nowrap;padding-bottom:4px;-webkit-overflow-scrolling:touch}
  .expense-history-filter{flex:0 0 auto}
  .expense-history-row{grid-template-columns:56px minmax(0,1fr) auto;gap:10px;padding:12px 0}
  .expense-history-fixed{padding:12px 10px}
  .expense-history-actions{grid-column:2 / -1}
  .expense-history-main strong{font-size:13px}
  .expense-history-amount{font-size:14px}
}
'''
style.write_text(css, encoding='utf-8')

# Release notes.
readme = Path('README.md')
r = readme.read_text(encoding='utf-8')
r = r.replace('# 家計簿Webアプリ v2.6.25 Stable','# 家計簿Webアプリ v2.6.26 Stable',1)
if '## v2.6.26 Stable' not in r:
    entry = '''\n## v2.6.26 Stable\n- 支出ページ下部に当月の「支出履歴」を追加し、変動費以外の支出も確認可能\n- 変動費以外 / すべて / 社会保険・税金 / 貯蓄 / 自己投資 / 特別費 / 変動費 / 固定費で絞り込み可能\n- 社会保険・税金、貯蓄、自己投資、特別費、変動費の履歴から編集・削除可能\n- 固定費は予算からの自動計上額を表示し、「予算設定へ」から変更\n- 既存のカレンダー、入力、集計、同期などその他の仕様は変更なし\n'''
    pos = r.find('\n## v2.6.25 Stable')
    r = r[:pos] + entry + r[pos:] if pos >= 0 else r + entry
readme.write_text(r, encoding='utf-8')

# PWA cache bump.
sw = Path('sw.js')
w = sw.read_text(encoding='utf-8').replace('kakeibo-v2.6.25-stable','kakeibo-v2.6.26-stable')
sw.write_text(w, encoding='utf-8')

# Regression coverage for the new history behavior.
test = Path('tests/ui-regression.spec.js')
t = test.read_text(encoding='utf-8')
marker = "test('expense history shows non-variable expenses and supports edit delete and fixed budget link'"
if marker not in t:
    t += r'''


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
'''
    test.write_text(t, encoding='utf-8')
