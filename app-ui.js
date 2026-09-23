// Navigation, screen rendering, dialogs, input handlers, theme, and app bootstrap.
const tabs=[['dashboard','概要'],['expense','支出'],['income','収入'],['budget','予算'],['settings','設定']];
const EXPENSE_CALENDAR_TYPES=['variable','self','special'];
let mobileDailyDate = new Date();
let expenseHistoryFilter='nonvariable';
function initNav(){for(const [k,l] of tabs){const b=document.createElement('button');b.className='tab'+(k==='dashboard'?' active':'');b.textContent=l;b.dataset.tab=k;document.querySelector('#tabs').appendChild(b);const m=b.cloneNode(true);m.className=k==='dashboard'?'active':'';m.dataset.tab=k;document.querySelector('#mobileNav').appendChild(m)} document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>showPanel(b.dataset.tab))}
function showPanel(k){
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.dataset.panel===k));
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===k));
  if(k==='expense'||k==='income'){renderCalendar();renderMobileDaily()}
  if(k==='budget'){renderBudgetEditor();renderItemManager()}
  if(k==='dashboard')scheduleChartDraw();
}
function renderCurrentMonthViews(){renderMobileRecent();document.querySelector('#monthLabel').textContent=`${current.getFullYear()}年${current.getMonth()+1}月`;renderSummary();renderBudgetOverview();renderVariableStatus();renderCalendar();renderBudgetEditor();renderItemManager();renderExpenseHistory();scheduleChartDraw()}
function render(){refreshQuickEntry();renderCurrentMonthViews();renderMobileDaily()}
function renderMobileRecent(){const wrap=document.getElementById('mobileRecentList');if(!wrap)return;const rows=[...monthTx()].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,5);if(!rows.length){wrap.innerHTML='<div class="recent-empty">まだ入力はありません</div>';return}wrap.innerHTML=rows.map(t=>{const d=(t.date||'').slice(5).replace('-','/');const sign=t.type==='income'?'+':'−';return `<div class="recent-row"><div class="recent-icon">${escapeHtml((t.category||'?').slice(0,1))}</div><div class="recent-main"><strong>${escapeHtml(t.item||t.category||'')}</strong><span>${d} ・ ${escapeHtml(t.category||'')}</span></div><div class="recent-amt ${t.type==='income'?'pos':''}">${sign}${money(t.amount).replace('¥','¥')}</div></div>`}).join('')}

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

function renderSummary(){
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
    ['balance','収支',balance,balance>=0?'黒字':''],
    ['fixed','固定費',fixedBudget,''],
    ['variable','変動費',variable,`予算残り ${money(budgetVar-variable)}`]
  ];
  const root=document.querySelector('#summaryCards');
  root.innerHTML=data.map(([key,l,v,s])=>{
    const valueClass=l==='収支'?(v>=0?'pos':'neg'):(l==='変動費'&&budgetVar>0&&v>budgetVar?'neg':'');
    const sub=s?`<div class="sub">${s}</div>`:'';
    const budgetBar=key==='variable'&&budgetVar>0?`<div class="variable-budget-bar ${variableLevel}" role="img" aria-label="変動費の予算消化 ${variablePct}%"><span style="width:${variableWidth}%"></span></div>`:'';
    const icon=`<span class="metric-icon" aria-hidden="true">${summaryCardIcon(key)}</span>`;
    return `<div class="metric" data-summary-key="${key}"><div class="metric-heading">${icon}<div class="label">${l}</div></div><div class="value ${valueClass}">${money(v)}</div>${sub}${budgetBar}</div>`
  }).join('');
}
// Decorative summary icons only. No chart-style three-bar icon is included.
function summaryCardIcon(key){
  const icons={
    income:'<ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v13c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 9c0 1.7 3.1 3 7 3s7-1.3 7-3M5 14c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
    expense:'<path d="M6 18 18 6M9 6h9v9"/>',
    balance:'<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 10h18M16 15h5M6 6V4a1 1 0 0 1 1-1h11"/>',
    fixed:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
    variable:'<path d="M5 9h14l1 12H4L5 9ZM9 10V7a3 3 0 0 1 6 0v3"/>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">${icons[key]||''}</svg>`;
}
function renderBudgetOverview(){
  const root=document.querySelector('#budgetOverview');
  const b=getBudget();
  root.innerHTML=TYPES.map(t=>{
    const actual=typeSum(t.key);
    const bud=budgetTypeSum(t.key);
    // Always use the category master order. Never derive display order from budget object keys.
    const cats=[...catsFor(t.key)];
    const variable=t.key==='variable';
    const fixed=t.key==='fixed';
    const suffix=(variable||fixed)?' <span style="font-size:10px;font-weight:600;color:#63736c">・予算</span>':' <span style="font-size:10px;font-weight:600;color:#63736c"></span>';

    const rows=cats.map(c=>{
      const a=sum(monthTx().filter(x=>x.type===t.key&&x.category===c).map(x=>x.amount));
      const budgetValue=+(b[t.key]?.[c]||0);

      // Fixed expenses: the configured monthly budget is the amount shown in the overview.
      if(fixed){
        return `<div class="row"><span>${escapeHtml(c)}</span><strong class="fixed-budget">${money(budgetValue)}</strong></div>`
      }

      // Variable expenses: actual / budget + progress.
      if(variable){
        const pct=budgetValue>0?Math.min(100,Math.round(a/budgetValue*100)):0;
        const over=budgetValue>0&&a>budgetValue;
        return `<div class="row"><span>${escapeHtml(c)}${budgetValue>0?`<div class="progress"><span class="${over?'over':''}" style="width:${pct}%"></span></div>`:''}</span><strong class="budget-pair"><span class="actual ${over?'neg':''}">${money(a)}</span><span class="budget-ref">/ ${money(budgetValue)}</span></strong></div>`
      }

      // Other sections continue to show actual amounts.
      return `<div class="row"><span>${escapeHtml(c)}</span><strong class="actual">${money(a)}</strong></div>`
    }).join('');

    const totalValue=fixed
      ? `<span class="fixed-budget">${money(bud)}</span>`
      : variable
        ? `<span class="budget-pair"><span class="actual ${bud>0&&actual>bud?'neg':''}">${money(actual)}</span><span class="budget-ref">/ ${money(bud)}</span></span>`
        : `<span class="actual">${money(actual)}</span>`;

    return `<div class="budget-section" data-budget-section="${t.key}"><h3 onclick="toggleBudgetSection('${t.key}')"><span>${t.label}${suffix}</span><span class="budget-toggle">表示 ▼</span></h3><div class="rows">${rows}<div class="row total"><b>合計</b><strong>${totalValue}</strong></div></div></div>`
  }).join('');
  applyMobileBudgetCollapse()
}
window.toggleBudgetSection=(key)=>{if(!matchMedia('(max-width:700px)').matches)return;const el=document.querySelector(`[data-budget-section="${key}"]`);if(!el)return;el.classList.toggle('collapsed');const t=el.querySelector('.budget-toggle');if(t)t.textContent=el.classList.contains('collapsed')?'表示 ▼':'閉じる ▲'}
function applyMobileBudgetCollapse(){if(!matchMedia('(max-width:700px)').matches)return;document.querySelectorAll('[data-budget-section]').forEach(el=>{el.classList.add('collapsed');const t=el.querySelector('.budget-toggle');if(t)t.textContent='表示 ▼'})}
function renderVariableStatus(){
  const root=document.getElementById('variableStatus'); if(!root)return;
  const budget=getBudget().variable||{}, usedByCat=Object.fromEntries(catsFor('variable').map(c=>[c,sum(monthTx().filter(t=>t.type==='variable'&&t.category===c).map(t=>t.amount))]));
  const budgetTotal=budgetTypeSum('variable'), used=typeSum('variable'), remaining=budgetTotal-used;
  const pct=budgetTotal>0?Math.round(used/budgetTotal*100):0, width=Math.min(100,Math.max(0,pct));
  const now=new Date(), y=current.getFullYear(), m=current.getMonth(), daysInMonth=new Date(y,m+1,0).getDate();
  const isCurrent=y===now.getFullYear()&&m===now.getMonth(), isPast=new Date(y,m+1,0)<new Date(now.getFullYear(),now.getMonth(),now.getDate()), isFuture=new Date(y,m,1)>new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const daysLeft=isCurrent?Math.max(1,daysInMonth-now.getDate()+1):(isFuture?daysInMonth:0);
  const daily=daysLeft>0?Math.max(0,remaining)/daysLeft:0;
  const watched=catsFor('variable').map(c=>({name:c,budget:+budget[c]||0,used:+usedByCat[c]||0,remaining:(+budget[c]||0)-(+usedByCat[c]||0)})).filter(x=>x.budget>0).sort((a,b)=>a.remaining-b.remaining).slice(0,5);
  const daysText=isCurrent?`月末まで ${daysLeft}日`:(isFuture?`対象月 ${daysInMonth}日間`:'対象月は終了');
  root.innerHTML=`<div class="variable-status-top"><div class="status-stat"><div class="k">予算</div><div class="v">${money(budgetTotal)}</div></div><div class="status-stat"><div class="k">使用済</div><div class="v">${money(used)}</div></div><div class="status-stat remaining"><div class="k">残り</div><div class="v ${remaining<0?'neg':''}">${money(remaining)}</div></div></div><div class="big-progress"><span class="${pct>100?'over':''}" style="width:${width}%"></span></div><div class="status-caption"><span>${budgetTotal>0?`予算消化 ${pct}%`:'予算未設定'}</span><span>${daysText}${daysLeft>0?` ・ 1日目安 ${money(daily)}`:''}</span></div>${watched.length?`<div class="budget-watch"><div class="budget-watch-title">予算残額が少ない項目</div>${watched.map(x=>`<div class="budget-watch-row ${x.remaining<0?'over':''}"><span>${escapeHtml(x.name)}</span><strong>${x.remaining<0?'超過 ':'残り '}${money(Math.abs(x.remaining))}</strong></div>`).join('')}</div>`:''}`;
}
window.editTxEncoded=encoded=>openTx(decodeURIComponent(encoded));

function updateAmountPreview(){const raw=txAmount.value;const r=evaluateAmountExpression(raw);if(!raw.trim()){amountCalcHint.textContent='複数回の会計は + - × ÷ ( ) を使って入力できます';amountCalcHint.className='hint';return}if(r.ok){amountCalcHint.textContent='合計 '+money(r.value);amountCalcHint.className='hint pos'}else{amountCalcHint.textContent='計算式を確認してください';amountCalcHint.className='hint neg'}}

function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function encodeArg(s){return encodeURIComponent(String(s)).replace(/'/g,'%27')}
function populateType(){txType.innerHTML=TYPES.map(t=>`<option value="${t.key}">${t.label}</option>`).join(''); updateCats()}
function updateCats(extra=''){let arr=catsFor(txType.value);let bud=getBudget()[txType.value]||{};let cats=[...new Set([...arr,...Object.keys(bud)])];if(extra&&!cats.includes(extra))cats.push(extra);txCategory.innerHTML=cats.map(c=>`<option>${escapeHtml(c)}</option>`).join('')}
function initQuickEntry(){if(!document.getElementById('quickCategory'))return;const now=new Date();quickDateLabel.textContent=`${now.getMonth()+1}月${now.getDate()}日`;quickCategory.innerHTML=catsFor('variable').map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');quickCategory.onchange=()=>{if(!quickItem.value.trim())quickItem.placeholder=`例：${quickCategory.value}`};quickAmount.addEventListener('input',()=>{const r=evaluateAmountExpression(quickAmount.value);quickAmountResult.textContent=r.ok&&quickAmount.value.trim()?`合計 ${money(r.value)}`:''});quickSaveBtn.onclick=saveQuickEntry;quickFullBtn.onclick=()=>openTx()}
function refreshQuickEntry(){if(!document.getElementById('quickCategory'))return;const prev=quickCategory.value;quickCategory.innerHTML=catsFor('variable').map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');if(catsFor('variable').includes(prev))quickCategory.value=prev;const now=new Date();quickDateLabel.textContent=`${now.getMonth()+1}月${now.getDate()}日`}
function saveQuickEntry(){const expr=quickAmount.value.trim();const calc=evaluateAmountExpression(expr);if(!expr||!calc.ok){alert('金額を正しく入力してください');quickAmount.focus();return}const amount=calc.value;const now=new Date();const date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;const cat=quickCategory.value;state.transactions.push({id:newId(),date,type:'variable',category:cat,item:quickItem.value.trim(),amount,amountExpression:expr,memo:''});current=new Date(now.getFullYear(),now.getMonth(),1);saveState();quickAmount.value='';quickAmountResult.textContent='保存しました';quickItem.value='';render();setTimeout(()=>{if(quickAmountResult.textContent==='保存しました')quickAmountResult.textContent=''},1200)}
function openTx(id=null){txId.value=id||'';txDialogTitle.textContent=id?'収支を編集':'収支を追加'; if(id){let t=state.transactions.find(x=>x.id===id);txDate.value=t.date;txType.value=t.type;updateCats(t.category);txCategory.value=t.category;txItem.value=t.item;txAmount.value=t.amountExpression||t.amount;txMemo.value=t.memo||'';updateAmountPreview()}else{txDate.value=ym()+'-'+String(Math.min(new Date().getDate(),new Date(current.getFullYear(),current.getMonth()+1,0).getDate())).padStart(2,'0');txType.value='variable';updateCats();txItem.value='';txAmount.value='';txMemo.value='';updateAmountPreview()} txDialog.tabIndex=-1;txDate.disabled=true;try{txDialog.showModal()}finally{txDate.disabled=false}txDialog.focus()}
txForm.onsubmit=e=>{e.preventDefault();const calc=evaluateAmountExpression(txAmount.value);if(!calc.ok){updateAmountPreview();txAmount.focus();return}let obj={id:txId.value||newId(),date:txDate.value,type:txType.value,category:txCategory.value,item:txItem.value.trim(),amount:calc.value,amountExpression:txAmount.value.trim(),memo:txMemo.value.trim()};let i=state.transactions.findIndex(x=>x.id===obj.id);if(i>=0)state.transactions[i]=obj;else state.transactions.push(obj);saveState();txDialog.close();render()};
function renderBudgetEditor(){const b=getBudget();const budgetTypes=TYPES.filter(t=>t.key!=='income'&&t.key!=='tax');budgetEditor.innerHTML=budgetTypes.map(t=>`<div class="budget-section" style="margin-bottom:10px"><h3>${t.label}</h3><div class="rows">${catsFor(t.key).map(c=>`<div class="row"><span>${escapeHtml(c)}</span><strong>${money(b[t.key]?.[c]||0)}</strong></div>`).join('')||'<div class="empty">項目がありません</div>'}</div></div>`).join('')+`<button class="primary" onclick="openBudget()">予算を編集</button>`}
window.openBudget=()=>{
  const b=getBudget();
  const monthText=`${current.getFullYear()}年${current.getMonth()+1}月`;
  budgetDialogBody.innerHTML=`<div class="hint" style="margin-bottom:14px"><strong>${monthText}から適用</strong><br>保存した予算はこの月と後の月に反映され、前の月の予算は変更されません。</div>`+
    TYPES.filter(t=>t.key!=='income'&&t.key!=='tax').map(t=>`<h3>${t.label}</h3><div class="form-grid">${catsFor(t.key).map(c=>`<div class="field"><label>${escapeHtml(c)}</label><input type="number" min="0" data-budget-type="${t.key}" data-budget-cat="${escapeHtml(c)}" value="${b[t.key]?.[c]||0}"></div>`).join('')||'<div class="hint">項目がありません</div>'}</div>`).join('');
  budgetDialog.showModal()
};
function saveBudget(){
  const before=deepCopy(state.budgets);
  const monthKey=ym();
  const b=getBudget();
  document.querySelectorAll('[data-budget-type]').forEach(i=>{
    b[i.dataset.budgetType][i.dataset.budgetCat]=+i.value||0
  });
  state.budgets[monthKey]=normalizeBudgetForCategories(b);
  applyBudgetForwardFrom(monthKey,state.budgets[monthKey]);
  if(!saveState()){
    state.budgets=before;
    return
  }
  budgetDialog.close();
  render()
}


function nthWeekdayOfMonth(y,m,weekday,n){
  const first=new Date(y,m-1,1);
  return 1+((weekday-first.getDay()+7)%7)+(n-1)*7
}
function springEquinoxDay(y){
  if(y<1980)return 21;
  if(y<=2099)return Math.floor(20.8431+0.242194*(y-1980)-Math.floor((y-1980)/4));
  return 20
}
function autumnEquinoxDay(y){
  if(y<1980)return 23;
  if(y<=2099)return Math.floor(23.2488+0.242194*(y-1980)-Math.floor((y-1980)/4));
  return 23
}
function baseJapaneseHolidays(y){
  const h=new Map(),add=(m,d,n)=>h.set(`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`,n);
  add(1,1,'元日');
  add(1,nthWeekdayOfMonth(y,1,1,2),'成人の日');
  add(2,11,'建国記念の日');
  if(y>=2020)add(2,23,'天皇誕生日');
  add(3,springEquinoxDay(y),'春分の日');
  add(4,29,'昭和の日');
  add(5,3,'憲法記念日');add(5,4,'みどりの日');add(5,5,'こどもの日');
  add(7,nthWeekdayOfMonth(y,7,1,3),'海の日');
  add(8,11,'山の日');
  add(9,nthWeekdayOfMonth(y,9,1,3),'敬老の日');
  add(9,autumnEquinoxDay(y),'秋分の日');
  add(10,nthWeekdayOfMonth(y,10,1,2),'スポーツの日');
  add(11,3,'文化の日');add(11,23,'勤労感謝の日');
  return h
}
const holidayCache=new Map();
function japaneseHolidays(y){
  if(holidayCache.has(y))return holidayCache.get(y);
  const h=baseJapaneseHolidays(y);
  // 国民の休日: 祝日に挟まれた平日
  for(let m=1;m<=12;m++){
    const days=new Date(y,m,0).getDate();
    for(let d=2;d<days;d++){
      const key=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      if(h.has(key))continue;
      const prev=new Date(y,m-1,d-1),next=new Date(y,m-1,d+1);
      const pk=localDateKey(prev),nk=localDateKey(next);
      if(h.has(pk)&&h.has(nk))h.set(key,'休日');
    }
  }
  // 振替休日: 日曜祝日の直後の最初の非祝日
  const originals=[...h.entries()];
  for(const [key] of originals){
    const [yy,mm,dd]=key.split('-').map(Number);
    const dt=new Date(yy,mm-1,dd);
    if(dt.getDay()!==0)continue;
    let x=new Date(dt);
    do{x.setDate(x.getDate()+1)}while(h.has(localDateKey(x)));
    if(x.getFullYear()===y)h.set(localDateKey(x),'振替休日');
  }
  holidayCache.set(y,h);
  return h
}
function holidayName(date){
  return japaneseHolidays(date.getFullYear()).get(localDateKey(date))||''
}
function dayClass(date){
  if(holidayName(date))return 'holiday';
  if(date.getDay()===6)return 'sat';
  if(date.getDay()===0)return 'sun';
  return ''
}

function localDateKey(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function startOfWeekMonday(d){
  const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const day=(x.getDay()+6)%7;
  x.setDate(x.getDate()-day);
  return x
}
function formatJapaneseDay(d){
  const ws=['日','月','火','水','木','金','土'];
  return `${d.getMonth()+1}月${d.getDate()}日（${ws[d.getDay()]}）`
}

function compactMoney(n){
  const v=Math.round(+n||0);
  if(Math.abs(v)>=1000000)return '¥'+(v/1000000).toFixed(v%1000000===0?0:1)+'M';
  if(Math.abs(v)>=10000)return '¥'+(v/10000).toFixed(v%10000===0?0:1)+'万';
  return money(v)
}
function pageTypeFor(kind){return kind==='income'?'income':'variable'}
function pageTypesFor(kind){return kind==='income'?['income']:EXPENSE_CALENDAR_TYPES}
function pageLabelFor(kind){return kind==='income'?'収入':'支出'}
function pageAmountForDate(kind,dateKey){
  const types=pageTypesFor(kind);
  return sum(state.transactions.filter(t=>t.date===dateKey&&types.includes(t.type)).map(t=>t.amount))
}
function renderPageMonthCalendar(kind){
  const root=document.getElementById(kind==='income'?'incomeMonthCalendar':'expenseMonthCalendar');
  if(!root)return;
  const selected=new Date(mobileDailyDate.getFullYear(),mobileDailyDate.getMonth(),mobileDailyDate.getDate());
  const y=selected.getFullYear(),m=selected.getMonth();
  const days=new Date(y,m+1,0).getDate();
  const offset=new Date(y,m,1).getDay();
  const todayKey=localDateKey(new Date());
  const selectedKey=localDateKey(selected);
  const label=pageLabelFor(kind);
  const moneyClass=kind==='income'?'income':'expense';
  const cells=[];
  for(let i=0;i<offset;i++)cells.push('<span class="mobile-cal-day empty" aria-hidden="true"></span>');
  for(let d=1;d<=days;d++){
    const dt=new Date(y,m,d),key=localDateKey(dt),dayCls=dayClass(dt);
    const amount=pageAmountForDate(kind,key);
    cells.push(`<button type="button" class="mobile-cal-day${key===selectedKey?' selected':''}${key===todayKey?' today':''}" data-${kind}-date="${key}" aria-label="${m+1}月${d}日">
      <span class="mobile-cal-date ${dayCls}">${d}</span>
      ${amount>0?`<span class="mobile-cal-money ${moneyClass}">${compactMoney(amount)}</span>`:''}
    </button>`)
  }
  root.innerHTML=`<div class="mobile-cal-head">
      <div class="mobile-cal-title">${label}カレンダー</div>
      <div class="mobile-cal-range">${y}年${m+1}月</div>
    </div>
    <div class="mobile-cal-weekdays">
      <span class="mobile-cal-weekday sun">日</span><span class="mobile-cal-weekday">月</span><span class="mobile-cal-weekday">火</span><span class="mobile-cal-weekday">水</span><span class="mobile-cal-weekday">木</span><span class="mobile-cal-weekday">金</span><span class="mobile-cal-weekday sat">土</span>
    </div>
    <div class="mobile-cal-grid">${cells.join('')}</div>
    <div class="mobile-cal-legend single"><span><i class="single-dot ${moneyClass}-dot"></i>${label}</span></div>`;
}
function setMobileDailyDate(d){
  if(!(d instanceof Date)||Number.isNaN(d.getTime()))return;
  const next=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const dateChanged=localDateKey(next)!==localDateKey(mobileDailyDate);
  const monthChanged=current.getFullYear()!==next.getFullYear()||current.getMonth()!==next.getMonth();
  mobileDailyDate=next;
  if(monthChanged)current=new Date(next.getFullYear(),next.getMonth(),1);
  renderMobileDaily();
  if(monthChanged)renderCurrentMonthViews();
  return dateChanged||monthChanged
}
function shiftMobileDailyDate(days){
  const d=new Date(mobileDailyDate);
  d.setDate(d.getDate()+days);
  setMobileDailyDate(d)
}
function renderMobilePage(kind){
  const types=pageTypesFor(kind);
  const prefix=kind==='income'?'income':'expense';
  const d=mobileDailyDate;
  const dateKey=localDateKey(d);
  const todayKey=localDateKey(new Date());
  const dateLabel=document.getElementById(prefix+'DateLabel');
  const dateSub=document.getElementById(prefix+'DateSub');
  const datePicker=document.getElementById(prefix+'DatePicker');
  if(!dateLabel||!dateSub||!datePicker)return;

  renderPageMonthCalendar(kind);
  dateLabel.textContent=formatJapaneseDay(d);
  dateLabel.className='day-date-main '+dayClass(d);
  const hname=holidayName(d);
  dateSub.textContent=hname||(dateKey===todayKey?'今日':'');
  dateSub.className='day-date-sub '+(hname?'holiday':'');
  datePicker.value=dateKey;

  const tx=state.transactions.filter(t=>types.includes(t.type)&&t.date===dateKey);
  const dayTotal=sum(tx.map(t=>t.amount));
  document.getElementById(prefix+'DayTotal').textContent=money(dayTotal);
  document.getElementById(prefix+'SummaryDay').textContent=money(dayTotal);

  const ws=startOfWeekMonday(d),we=new Date(ws);we.setDate(we.getDate()+6);
  const weekTotal=sum(state.transactions.filter(t=>types.includes(t.type)&&validDateString(t.date)).filter(t=>{
    const [y,m,dd]=t.date.split('-').map(Number),x=new Date(y,m-1,dd);
    return x>=ws&&x<=we
  }).map(t=>t.amount));
  document.getElementById(prefix+'SummaryWeek').textContent=money(weekTotal);

  const monthKey=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  const monthTotal=sum(state.transactions.filter(t=>types.includes(t.type)&&String(t.date).startsWith(monthKey)).map(t=>t.amount));
  document.getElementById(prefix+'SummaryMonth').textContent=money(monthTotal);

  const list=document.getElementById(prefix+'CategoryList');
  const palette=kind==='income'
    ?['#347fd6','#438edc','#54a0e6','#69afea','#7dbbea','#5f9ee0']
    :['#df4f5c','#e3646e','#e77982','#ee8d95','#d96675','#c84f63','#ef6f61','#d85c70','#e88770','#ca596a'];

  const groups=types.map(type=>({type,label:TYPES.find(t=>t.key===type)?.label||type,cats:catsFor(type)}));
  let colorIndex=0;
  list.innerHTML=groups.some(group=>group.cats.length)?groups.map(group=>{
    const rows=group.cats.map(cat=>{
      const amount=sum(tx.filter(t=>t.type===group.type&&t.category===cat).map(t=>t.amount));
      const action=kind==='income'
        ?(amount?`openPageDailyHistory('income','${encodeArg(cat)}')`:`openPageDailyEntry('income','${encodeArg(cat)}')`)
        :(amount?`openPageDailyHistoryType('${group.type}','${encodeArg(cat)}')`:`openPageDailyEntryType('${group.type}','${encodeArg(cat)}')`);
      const color=palette[colorIndex++%palette.length];
      return `<button type="button" class="day-cat-row" data-calendar-type="${group.type}" onclick="${action}">
        <span class="day-cat-main"><i class="day-cat-dot" style="background:${color}"></i><span class="day-cat-name">${escapeHtml(cat)}</span></span>
        <span class="day-cat-action">${amount?`<strong class="day-cat-amount">${money(amount)}</strong>`:`<span class="day-cat-add">＋追加</span>`}<span class="day-cat-arrow">›</span></span>
      </button>`
    }).join('');
    const heading=kind==='expense'?`<div class="day-cat-section-title">${escapeHtml(group.label)}</div>`:'';
    return `<div class="day-cat-section" data-category-type="${group.type}">${heading}${rows}</div>`
  }).join(''):`<div class="empty">${kind==='income'?'収入':'支出'}の項目がありません</div>`;
}
// iPhone income dashboard: real transactions only; zero months never receive fabricated bars.
let incomeGraphPeriod='month';
let incomeGraphAnchor=null;
let incomeGraphSelected=null;
let incomeDetailCategory=null;
function incomePeriodTotal(date,period){
  const key=period==='year'?String(date.getFullYear()):ym(date);
  return sum(state.transactions.filter(t=>t.type==='income'&&t.date.startsWith(key)).map(t=>t.amount));
}
// Keep the nine graph positions anchored to the daily view's month. Selecting a bar
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
function renderMobileIncomeOverview(){
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
    '<rect x="4" y="9" width="16" height="12" rx="2"/><path d="M12 9v12M4 13h16M12 9c-4 0-6-2-5-4 1-3 5-1 5 4Zm0 0c4 0 6-2 5-4-1-3-5-1-5 4Z"/>',
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
}
function renderDesktopIncomeOverview(){
  const root=document.getElementById('incomeDesktopOverview');
  if(!root)return;
  const year=current.getFullYear(),month=current.getMonth();
  const annual=incomeGraphPeriod==='year';
  const selectedKey=selectedIncomePeriod();
  const selectedDate=annual?new Date(Number(selectedKey),0,1):dateFromPickerValue(selectedKey+'-01');
  const selectedLabel=selectedIncomePeriodLabel();
  const total=incomePeriodTotal(selectedDate,incomeGraphPeriod);
  const previousDate=annual?new Date(selectedDate.getFullYear()-1,0,1):new Date(selectedDate.getFullYear(),selectedDate.getMonth()-1,1);
  const previous=incomePeriodTotal(previousDate,incomeGraphPeriod);
  const difference=previous?`${total>=previous?'+':''}${Math.round((total-previous)/previous*100)}%`:'― ―';
  const periodItems=selectedIncomeTransactions();

  root.querySelectorAll('[data-income-desktop-period]').forEach(button=>{
    button.classList.toggle('active',button.dataset.incomeDesktopPeriod===incomeGraphPeriod);
    button.setAttribute('aria-pressed',String(button.dataset.incomeDesktopPeriod===incomeGraphPeriod));
  });
  document.getElementById('incomeDesktopTotalTitle').textContent=annual?`${selectedKey}年の収入`:(selectedKey===ym(new Date())?'今月の収入':`${selectedLabel}の収入`);
  document.getElementById('incomeDesktopTotal').textContent=money(total);
  document.getElementById('incomeDesktopCount').textContent=`${periodItems.length}件の入金`;
  document.getElementById('incomeDesktopCompareLabel').textContent=annual?'前年比':'前月比';
  document.getElementById('incomeDesktopCompare').textContent=difference;

  // PC/iPad month view shows a rolling year ending at the displayed month.
  // Annual view keeps the existing six-year comparison.
  const periodCount=annual?6:12;
  const periods=Array.from({length:periodCount},(_,index)=>{
    const offset=index-(periodCount-1);
    const date=annual?new Date(year+offset,month,1):new Date(year,month+offset,1);
    const key=annual?String(date.getFullYear()):ym(date);
    return {date,key,amount:incomePeriodTotal(date,incomeGraphPeriod),selected:key===selectedKey};
  });
  const max=Math.max(1,...periods.map(period=>period.amount));
  const desktopGraph=document.getElementById('incomeDesktopGraphBars');
  desktopGraph.style.setProperty('--income-desktop-column-count',periodCount);
  desktopGraph.innerHTML=periods.map(period=>{
    const height=period.amount?Math.max(5,Math.round(82*period.amount/max)):0;
    const caption=annual?`${period.date.getFullYear()}年`:`${period.date.getMonth()+1}月`;
    const value=money(period.amount);
    return `<button type="button" class="income-desktop-chart-column${period.selected?' selected':''}" data-income-desktop-key="${period.key}" aria-label="${caption}の収入 ${value}${period.selected?'、選択中':''}"><span class="income-desktop-chart-track" style="--bar-height:${height}%"><span class="income-desktop-chart-value">${period.selected&&period.amount?value:''}</span><span class="income-desktop-chart-bar" style="height:${height}%"></span></span><span class="income-desktop-chart-label">${caption}</span></button>`
  }).join('');

  const categoryColors=['#237de6','#58adf3','#18bde2','#58d1e5'];
  document.getElementById('incomeDesktopCategories').innerHTML=catsFor('income').map((category,index)=>{
    const rows=periodItems.filter(t=>t.category===category);
    const amount=sum(rows.map(t=>t.amount));
    return `<button type="button" class="income-desktop-category-row" onclick="openIncomeMonthDetail('${encodeArg(category)}')"><span class="income-desktop-category-name"><i style="background:${categoryColors[index%categoryColors.length]}"></i>${escapeHtml(category)}</span><strong>${money(amount)}</strong></button>`
  }).join('');

  const recent=[...periodItems].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  document.getElementById('incomeDesktopRecentRows').innerHTML=recent.length?recent.map(t=>{
    const content=t.item||t.memo||t.category;
    return `<div class="income-desktop-recent-row"><span>${escapeHtml(t.date.slice(5).replace('-','/'))}</span><span class="income-desktop-recent-category">${escapeHtml(t.category)}</span><span class="income-desktop-recent-content">${escapeHtml(content)}</span><strong>${money(t.amount)}</strong><button type="button" onclick="editIncomeMonthTx('${encodeArg(t.id)}')">編集</button></div>`
  }).join(''):`<div class="income-desktop-empty">${annual?'この年':'この月'}の収入はありません</div>`;
}
function renderIncomeOverviews(){
  renderMobileIncomeOverview();
  renderDesktopIncomeOverview();
}
function openIncomeFromCard(category=''){
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
function renderIncomeMonthDetail(){
  const dialog=document.getElementById('incomeMonthDialog');
  if(!dialog)return;
  const category=incomeDetailCategory;
  const rows=selectedIncomeTransactions().filter(t=>category===null||t.category===category)
    .sort((a,b)=>b.date.localeCompare(a.date));
  document.getElementById('incomeMonthTitle').textContent=category?`${category}の明細`:'収入明細';
  document.getElementById('incomeMonthMeta').textContent=`${selectedIncomePeriodLabel()} ・ ${rows.length}件 ・ 合計 ${money(sum(rows.map(t=>t.amount)))}`;
  document.getElementById('incomeMonthRows').innerHTML=rows.length?rows.map(t=>{
    const detail=[t.item,t.memo].filter(Boolean).map(x=>escapeHtml(x)).join(' ・ ');
    return `<div class="income-month-row"><span class="income-month-entry"><strong>${money(t.amount)}</strong><small>${escapeHtml(t.date.slice(5).replace('-','/'))} ・ ${escapeHtml(t.category)}${detail?' ・ '+detail:''}</small></span><span class="income-month-actions"><button type="button" onclick="editIncomeMonthTx('${encodeArg(t.id)}')">編集</button><button type="button" class="income-month-delete" onclick="deleteIncomeMonthTx('${encodeArg(t.id)}')">削除</button></span></div>`;
  }).join(''):`<div class="daily-history-empty">${incomeGraphPeriod==='year'?'この年':'この月'}の収入はありません</div>`;
}
window.openIncomeMonthDetail=(encoded=null)=>{
  incomeDetailCategory=encoded===null?null:decodeURIComponent(encoded);
  renderIncomeMonthDetail();
  const dialog=document.getElementById('incomeMonthDialog');
  if(!dialog.open)dialog.showModal();
};
window.editIncomeMonthTx=encoded=>{
  const id=decodeURIComponent(encoded);
  if(!selectedIncomeTransactions().some(t=>t.id===id))return;
  document.getElementById('incomeMonthDialog').close();
  openTx(id);
};
window.deleteIncomeMonthTx=encoded=>{
  const id=decodeURIComponent(encoded);
  const index=state.transactions.findIndex(t=>t.id===id&&t.type==='income'&&t.date.startsWith(selectedIncomePeriod()));
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
  period.onchange=()=>{incomeGraphPeriod=period.value==='year'?'year':'month';incomeGraphSelected=incomeGraphPeriod==='year'?String(current.getFullYear()):ym();renderIncomeOverviews()};
  document.getElementById('incomeGraphBars').onclick=e=>{
    const button=e.target.closest('[data-income-period]');
    if(!button)return;
    incomeGraphSelected=button.dataset.incomePeriod;
    renderIncomeOverviews();
  };
  document.getElementById('incomeAddCard').onclick=()=>openIncomeFromCard();
  document.getElementById('incomeViewAll').onclick=()=>window.openIncomeMonthDetail();
  const desktopRoot=document.getElementById('incomeDesktopOverview');
  desktopRoot.querySelectorAll('[data-income-desktop-period]').forEach(button=>button.onclick=()=>{
    incomeGraphPeriod=button.dataset.incomeDesktopPeriod==='year'?'year':'month';
    incomeGraphSelected=incomeGraphPeriod==='year'?String(current.getFullYear()):ym();
    renderIncomeOverviews();
  });
  document.getElementById('incomeDesktopGraphBars').onclick=e=>{
    const button=e.target.closest('[data-income-desktop-key]');
    if(!button)return;
    incomeGraphSelected=button.dataset.incomeDesktopKey;
    renderIncomeOverviews();
  };
  document.getElementById('incomeDesktopAdd').onclick=()=>openIncomeFromCard();
  document.getElementById('incomeDesktopViewAll').onclick=()=>window.openIncomeMonthDetail();
  document.getElementById('incomeMonthClose').onclick=()=>document.getElementById('incomeMonthDialog').close();
  document.getElementById('incomeMonthAdd').onclick=()=>{
    const category=incomeDetailCategory;
    document.getElementById('incomeMonthDialog').close();
    openIncomeFromCard(category||'');
  };
}

function renderMobileDaily(){
  renderMobilePage('expense');
  renderMobilePage('income');
  renderIncomeOverviews();
}
window.openPageDailyEntry=(kind,encoded)=>{
  openDailyEntryEditor(pageTypeFor(kind),decodeURIComponent(encoded))
};
window.openPageDailyHistory=(kind,encoded)=>{
  openDailyHistoryFor(pageTypeFor(kind),encoded)
};
window.openPageDailyEntryType=(type,encoded)=>{
  if(!EXPENSE_CALENDAR_TYPES.includes(type))return;
  openDailyEntryEditor(type,decodeURIComponent(encoded))
};
window.openPageDailyHistoryType=(type,encoded)=>{
  if(!EXPENSE_CALENDAR_TYPES.includes(type))return;
  openDailyHistoryFor(type,encoded)
};
let dailyEntryType='variable';
let dailyEntryCategory='';
let dailyEntryEditId='';
let dailyHistoryType='variable';
let dailyHistoryCategory='';
let dailyEntryReturnToHistory=false;

function dailyTransactionsFor(dateKey,type,category){
  return state.transactions.filter(t=>t.type===type&&t.date===dateKey&&t.category===category)
}
function openDailyEntryEditor(type,category,editId='',returnToHistory=false){
  dailyEntryType=type;
  dailyEntryCategory=category;
  dailyEntryEditId=editId||'';
  dailyEntryReturnToHistory=!!returnToHistory;
  const existing=dailyEntryEditId?state.transactions.find(t=>t.id===dailyEntryEditId&&t.type===dailyEntryType):null;
  const typeLabel=TYPES.find(t=>t.key===dailyEntryType)?.label||dailyEntryType;
  dailyEntryTitle.textContent=existing?'入力を編集':`${typeLabel}を追加`;
  dailyEntryMeta.textContent=`${formatJapaneseDay(mobileDailyDate)} ・ ${typeLabel} ・ ${dailyEntryCategory}`;
  dailyEntryAmount.value=existing?(existing.amountExpression||existing.amount):'';
  dailyEntryItem.value=existing?(existing.item||''):'';
  dailyEntryMemo.value=existing?(existing.memo||''):'';
  dailyEntrySave.textContent=existing?'変更を保存':'追加する';
  updateDailyEntryCalc();
  dailyEntryDialog.showModal();
  setTimeout(()=>dailyEntryAmount.focus(),80)
}
function renderDailyHistory(){
  const dateKey=localDateKey(mobileDailyDate);
  const rows=dailyTransactionsFor(dateKey,dailyHistoryType,dailyHistoryCategory);
  const typeLabel=TYPES.find(t=>t.key===dailyHistoryType)?.label||dailyHistoryType;
  dailyHistoryTitle.textContent=`${typeLabel}・${dailyHistoryCategory||'入力履歴'}`;
  dailyHistoryMeta.textContent=`${formatJapaneseDay(mobileDailyDate)} の入力履歴`;
  dailyHistoryList.innerHTML=rows.length?rows.map((t,i)=>{
    const details=[t.item,t.memo].map(v=>cleanText(v,500)).filter(Boolean).join(' ・ ')||`入力 ${i+1}`;
    return `<div class="daily-history-row">
      <div class="daily-history-main"><strong>${money(t.amount)}</strong><span>${escapeHtml(details)}</span></div>
      <div class="daily-history-buttons">
        <button type="button" onclick="editDailyHistoryEntry('${encodeArg(t.id)}')">編集</button>
        <button type="button" class="history-delete" onclick="deleteDailyHistoryEntry('${encodeArg(t.id)}')">削除</button>
      </div>
    </div>`
  }).join(''):'<div class="daily-history-empty">この項目の入力はありません</div>';
}
function openDailyHistoryFor(type,encoded){
  dailyHistoryType=type;
  dailyHistoryCategory=decodeURIComponent(encoded);
  renderDailyHistory();
  if(!dailyHistoryDialog.open)dailyHistoryDialog.showModal();
}
window.editDailyHistoryEntry=encoded=>{
  const id=decodeURIComponent(encoded);
  const tx=state.transactions.find(t=>t.id===id&&t.type===dailyHistoryType);
  if(!tx)return;
  dailyHistoryType=tx.type;
  dailyHistoryCategory=tx.category;
  if(dailyHistoryDialog.open)dailyHistoryDialog.close();
  openDailyEntryEditor(tx.type,tx.category,id,true);
};
window.deleteDailyHistoryEntry=encoded=>{
  const id=decodeURIComponent(encoded);
  const index=state.transactions.findIndex(t=>t.id===id&&t.type===dailyHistoryType);
  if(index<0)return;
  const tx=state.transactions[index];
  const typeLabel=TYPES.find(t=>t.key===tx.type)?.label||tx.type;
  if(!confirm(`${formatJapaneseDay(new Date(tx.date+'T00:00:00'))} の「${typeLabel}・${tx.category}」 ${money(tx.amount)} を削除しますか？`))return;
  const removed=state.transactions.splice(index,1)[0];
  if(!saveState()){
    state.transactions.splice(index,0,removed);
    return;
  }
  renderMobileDaily();
  renderCurrentMonthViews();
  const remaining=dailyTransactionsFor(localDateKey(mobileDailyDate),dailyHistoryType,dailyHistoryCategory);
  if(remaining.length){
    renderDailyHistory();
  }else if(dailyHistoryDialog.open){
    dailyHistoryDialog.close();
  }
};

function updateDailyEntryCalc(){
  const raw=dailyEntryAmount.value;
  const r=evaluateAmountExpression(raw);
  if(!raw.trim()){dailyEntryCalc.textContent='+ - × ÷ ( ) で計算できます';dailyEntryCalc.className='hint';return}
  if(r.ok){dailyEntryCalc.textContent=`合計 ${money(r.value)}`;dailyEntryCalc.className='hint pos'}
  else{dailyEntryCalc.textContent='計算式を確認してください';dailyEntryCalc.className='hint neg'}
}
function saveDailyEntry(){
  const raw=dailyEntryAmount.value.trim(),calc=evaluateAmountExpression(raw);
  if(!raw||!calc.ok){updateDailyEntryCalc();dailyEntryAmount.focus();return}
  const item=cleanText(dailyEntryItem.value,200);
  const memo=cleanText(dailyEntryMemo.value,500);
  const wasEdit=!!dailyEntryEditId;
  if(wasEdit){
    const index=state.transactions.findIndex(t=>t.id===dailyEntryEditId&&t.type===dailyEntryType);
    if(index<0){alert('編集対象のデータが見つかりません');return}
    const before={...state.transactions[index]};
    state.transactions[index]={...state.transactions[index],amount:calc.value,amountExpression:raw,item,memo};
    if(!saveState()){
      state.transactions[index]=before;
      return;
    }
  }else{
    const tx={
      id:newId(),date:localDateKey(mobileDailyDate),type:dailyEntryType,category:dailyEntryCategory,
      item,amount:calc.value,amountExpression:raw,memo
    };
    state.transactions.push(tx);
    if(!saveState()){
      state.transactions.pop();
      return;
    }
  }
  const returnToHistory=dailyEntryReturnToHistory;
  const type=dailyEntryType;
  const category=dailyEntryCategory;
  dailyEntryDialog.close();
  dailyEntryEditId='';
  dailyEntryReturnToHistory=false;
  renderMobileDaily();
  renderCurrentMonthViews();
  if(returnToHistory){
    dailyHistoryType=type;
    dailyHistoryCategory=category;
    renderDailyHistory();
    dailyHistoryDialog.showModal();
  }
}
function dateFromPickerValue(value){
  if(!validDateString(value))return null;
  const [y,m,d]=value.split('-').map(Number);
  return new Date(y,m-1,d)
}
function handlePageDatePicker(id){
  const picker=document.getElementById(id);
  const picked=dateFromPickerValue(picker?.value);
  if(picked)setMobileDailyDate(picked)
}
function bindMonthCalendar(rootId,kind){
  const root=document.getElementById(rootId);
  if(!root)return;
  root.addEventListener('click',e=>{
    const btn=e.target.closest(`[data-${kind}-date]`);
    if(!btn)return;
    const value=btn.getAttribute(`data-${kind}-date`);
    const picked=dateFromPickerValue(value);
    if(picked)setMobileDailyDate(picked)
  })
}
const dailySwipeAnimationTimers=new WeakMap();
function animateDailySwipe(root,days){
  const card=root?.querySelector('.mobile-day-card');
  if(!card)return;
  const className=days>0?'day-swipe-next':'day-swipe-prev';
  const previousTimer=dailySwipeAnimationTimers.get(card);
  if(previousTimer)clearTimeout(previousTimer);
  card.classList.remove('day-swipe-next','day-swipe-prev');
  void card.offsetWidth;
  card.classList.add(className);
  dailySwipeAnimationTimers.set(card,setTimeout(()=>{
    card.classList.remove(className);
    dailySwipeAnimationTimers.delete(card)
  },280))
}
function bindDailySwipe(rootId){
  const root=document.getElementById(rootId);
  if(!root)return;
  let touchX=null;
  root.addEventListener('touchstart',e=>{touchX=e.changedTouches[0]?.clientX??null},{passive:true});
  root.addEventListener('touchend',e=>{
    if(touchX===null)return;
    const dx=(e.changedTouches[0]?.clientX??touchX)-touchX;touchX=null;
    if(Math.abs(dx)>55){
      const days=dx<0?1:-1;
      shiftMobileDailyDate(days);
      animateDailySwipe(root,days)
    }
  },{passive:true})
}
function initMobileDaily(){
  if(!document.getElementById('mobileExpense')||!document.getElementById('mobileIncome'))return;
  const now=new Date();
  mobileDailyDate=new Date(now.getFullYear(),now.getMonth(),now.getDate());

  expensePrevBtn.onclick=()=>shiftMobileDailyDate(-1);
  expenseNextBtn.onclick=()=>shiftMobileDailyDate(1);
  incomePrevBtn.onclick=()=>shiftMobileDailyDate(-1);
  incomeNextBtn.onclick=()=>shiftMobileDailyDate(1);

  expenseDatePicker.addEventListener('input',()=>handlePageDatePicker('expenseDatePicker'));
  expenseDatePicker.addEventListener('change',()=>handlePageDatePicker('expenseDatePicker'));
  incomeDatePicker.addEventListener('input',()=>handlePageDatePicker('incomeDatePicker'));
  incomeDatePicker.addEventListener('change',()=>handlePageDatePicker('incomeDatePicker'));

  bindMonthCalendar('expenseMonthCalendar','expense');
  bindMonthCalendar('incomeMonthCalendar','income');

  dailyEntryAmount.addEventListener('input',updateDailyEntryCalc);
  dailyEntryCancel.onclick=()=>dailyEntryDialog.close();
  dailyEntrySave.onclick=saveDailyEntry;
  dailyHistoryClose.onclick=()=>dailyHistoryDialog.close();
  dailyHistoryAdd.onclick=()=>{
    const type=dailyHistoryType;
    const cat=dailyHistoryCategory;
    dailyHistoryDialog.close();
    openDailyEntryEditor(type,cat,'',true);
  };
  dailyEntryAmount.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveDailyEntry()}});

  bindDailySwipe('mobileExpense');
  bindDailySwipe('mobileIncome');
}
function renderTypeCalendar(wrapId,type,cats,label){
  const root=document.getElementById(wrapId);
  if(!root)return;
  const types=Array.isArray(type)?type:[type];
  const rows=Array.isArray(cats)&&cats.length&&typeof cats[0]==='object'
    ?cats
    :(cats||[]).map(cat=>({type:types[0],cat}));
  const y=current.getFullYear(),m=current.getMonth();
  const days=new Date(y,m+1,0).getDate(), offset=(new Date(y,m,1).getDay()+6)%7;
  const weeks=Math.ceil((offset+days)/7);
  const tx=monthTx().filter(t=>types.includes(t.type));
  let html='<table class="cal-table">';
  for(let w=0;w<weeks;w++){
    const ds=[];
    for(let c=0;c<7;c++){const d=w*7+c-offset+1;ds.push(d>=1&&d<=days?d:null)}
    html+=`<tr><th class="cal-cat">項目</th>${ds.map(d=>{
      if(!d)return '<th></th>';
      const dt=new Date(y,m,d),cls=dayClass(dt),wd=['日','月','火','水','木','金','土'][dt.getDay()],hn=holidayName(dt);
      return `<th class="${cls}" title="${escapeHtml(hn)}">${d}<span class="weekday-label">${wd}</span></th>`
    }).join('')}<th>合計</th></tr>`;

    for(const row of rows){
      const rowTx=tx.filter(t=>t.type===row.type);
      html+=`<tr data-calendar-type="${row.type}"><td class="cal-cat">${escapeHtml(row.cat)}</td>${ds.map(d=>{
        if(!d)return '<td></td>';
        const date=ym()+'-'+String(d).padStart(2,'0');
        const a=sum(rowTx.filter(t=>t.category===row.cat&&t.date===date).map(t=>t.amount));
        return `<td class="cal-cell" onclick="quickAddType('${date}','${row.type}','${encodeArg(row.cat)}')">${a?`<span class="amt">${money(a)}</span>`:''}</td>`
      }).join('')}<td class="cal-cell"><b>${money(sum(rowTx.filter(t=>t.category===row.cat&&ds.includes(+t.date.slice(-2))).map(t=>t.amount)))}</b></td></tr>`
    }

    const weekTotal=sum(tx.filter(t=>ds.includes(+t.date.slice(-2))).map(t=>t.amount));
    html+=`<tr class="expense-week-total-row"><td class="cal-cat"><b>${label}合計</b></td>${ds.map(d=>{
      if(!d)return '<td class="cal-cell expense-week-total-cell"></td>';
      const date=ym()+'-'+String(d).padStart(2,'0');
      const a=sum(tx.filter(t=>t.date===date).map(t=>t.amount));
      return `<td class="cal-cell expense-week-total-cell"><b class="${a>2000?'expense-limit-over':''}">${a?money(a):''}</b></td>`
    }).join('')}<td class="cal-cell expense-week-total-cell"><b class="${weekTotal>14000?'expense-limit-over':''}">${money(weekTotal)}</b></td></tr>`;
  }
  html+='</table>';
  root.innerHTML=html
}
function renderCalendar(){
  const expenseRows=EXPENSE_CALENDAR_TYPES.flatMap(type=>catsFor(type).map(cat=>({type,cat})));
  renderTypeCalendar('expenseCalendarWrap',EXPENSE_CALENDAR_TYPES,expenseRows,'支出');
}
window.quickAddType=(date,type,encoded)=>{
  const cat=decodeURIComponent(encoded);
  const picked=dateFromPickerValue(date);
  const existing=state.transactions.some(t=>t.type===type&&t.date===date&&t.category===cat);
  if(existing&&picked){
    mobileDailyDate=picked;
    dailyHistoryType=type;
    dailyHistoryCategory=cat;
    renderDailyHistory();
    dailyHistoryDialog.showModal();
    return;
  }
  openTx();txDate.value=date;txType.value=type;updateCats();txCategory.value=cat;txItem.value='';
}
function renderItemManager(){if(!document.getElementById('itemType'))return;const selected=itemType.dataset.ready?itemType.value:'variable';itemType.innerHTML=TYPES.map(t=>`<option value="${t.key}">${t.label}</option>`).join('');itemType.value=selected||'variable';itemType.dataset.ready='1';renderItemList()}
function renderItemList(){if(!document.getElementById('itemList'))return;const type=itemType.value||'variable';const cats=catsFor(type);itemList.innerHTML=cats.length?cats.map(c=>`<div class="item-chip"><span>${escapeHtml(c)}</span><span class="item-chip-actions"><button class="edit-item" type="button" onclick="editItem('${type}','${encodeArg(c)}')">編集</button><button class="delete-item" type="button" onclick="deleteItem('${type}','${encodeArg(c)}')">削除</button></span></div>`).join(''):'<div class="empty">項目がありません</div>'}
function addItem(){const type=itemType.value;const name=newItemName.value.trim();if(!name)return;if(catsFor(type).some(c=>c.toLowerCase()===name.toLowerCase())){alert('同じ名前の項目があります');return}state.categories[type].push(name);const b=getBudget();if(!(name in b[type]))b[type][name]=0;saveState();newItemName.value='';render();itemType.value=type;renderItemList();updateCats()}
window.editItem=(type,encoded)=>{const oldName=decodeURIComponent(encoded);const input=prompt(`「${oldName}」の新しい項目名を入力してください`,oldName);if(input===null)return;const newName=input.trim();if(!newName||newName===oldName)return;if(catsFor(type).some(c=>c!==oldName&&c.toLowerCase()===newName.toLowerCase())){alert('同じ名前の項目があります');return}if(!confirm(`「${oldName}」を「${newName}」に変更しますか？\n過去の収支データと各月の予算にも反映されます。`))return;state.categories[type]=catsFor(type).map(c=>c===oldName?newName:c);for(const tx of state.transactions){if(tx.type===type&&tx.category===oldName)tx.category=newName}for(const month of Object.values(state.budgets)){if(!month?.[type]||!(oldName in month[type]))continue;const oldValue=month[type][oldName];if(!(newName in month[type]))month[type][newName]=oldValue;delete month[type][oldName]}saveState();render();itemType.value=type;renderItemList();updateCats()};
window.deleteItem=(type,encoded)=>{const name=decodeURIComponent(encoded);if(!confirm(`「${name}」を削除しますか？\n過去の収支データは削除されません。`))return;state.categories[type]=catsFor(type).filter(c=>c!==name);for(const month of Object.values(state.budgets)){if(month?.[type])delete month[type][name]}saveState();render();itemType.value=type;renderItemList();updateCats()};
// iPad Safari: keep navigation outside sticky-positioning/scrolling quirks.
// Desktop browsers and the narrow iPhone layout retain their existing rules.
function initIPadNavigation(){
  const isIPad=/iPad/.test(navigator.userAgent)||
    (/Mac/.test(navigator.platform)&&navigator.maxTouchPoints>1);
  if(!isIPad)return;
  const nav=document.getElementById('tabs');
  const header=document.querySelector('.topbar');
  const spacer=document.createElement('div');
  spacer.setAttribute('aria-hidden','true');
  nav.before(spacer);
  const update=()=>{
    const wide=window.matchMedia('(min-width:701px)').matches;
    nav.classList.toggle('ipad-fixed-tabs',wide);
    if(!wide){spacer.style.height='0px';return}
    const rect=spacer.getBoundingClientRect();
    nav.style.setProperty('--ipad-tabs-top',header.getBoundingClientRect().height+'px');
    nav.style.setProperty('--ipad-tabs-left',rect.left+'px');
    nav.style.setProperty('--ipad-tabs-width',rect.width+'px');
    spacer.style.height=nav.getBoundingClientRect().height+'px';
  };
  const observer=new ResizeObserver(update);
  observer.observe(header);
  observer.observe(nav.parentElement);
  observer.observe(nav);
  window.addEventListener('resize',update);
  update();
}

const THEME_KEY='kakeibo-theme';
function applyTheme(theme){
  const dark=theme==='dark';
  document.body.classList.toggle('dark-mode',dark);
  const btn=document.getElementById('themeToggle');
  if(btn){
    const icon=btn.querySelector('.theme-icon');
    const label=btn.querySelector('.theme-label');
    if(icon){
      if(dark){
        icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4" stroke-width="2"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" stroke-width="2" stroke-linecap="round"/></svg>';
      }else{
        icon.textContent='☾';
      }
    }
    if(label) label.textContent=dark?'ライト':'ダーク';
    btn.title=dark?'ライトモードに切替':'ダークモードに切替';
    btn.setAttribute('aria-label',btn.title);
  }
  if(typeof scheduleChartDraw==='function') scheduleChartDraw();
}
function initTheme(){
  const saved=localStorage.getItem(THEME_KEY);
  const preferred=saved || 'light';
  applyTheme(preferred);
  const btn=document.getElementById('themeToggle');
  if(btn) btn.onclick=()=>{
    const next=document.body.classList.contains('dark-mode')?'light':'dark';
    localStorage.setItem(THEME_KEY,next);
    applyTheme(next);
  };
}

function mobileDailyPanelActive(){
  if(!matchMedia('(max-width:700px)').matches)return false;
  return !!document.querySelector('.panel[data-panel="expense"].active,.panel[data-panel="income"].active')
}
function shiftVisibleMonth(delta){
  if(mobileDailyPanelActive()){
    const originalDay=mobileDailyDate.getDate();
    const d=new Date(mobileDailyDate.getFullYear(),mobileDailyDate.getMonth()+delta,1);
    d.setDate(Math.min(originalDay,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));
    setMobileDailyDate(d);
  }else{
    current.setMonth(current.getMonth()+delta);
    render();
  }
}
prevMonth.onclick=()=>shiftVisibleMonth(-1);nextMonth.onclick=()=>shiftVisibleMonth(1);todayBtn.onclick=()=>{if(mobileDailyPanelActive())setMobileDailyDate(new Date());else{current=new Date();current.setDate(1);render()}};
addTxBtn.onclick=()=>openTx();addBudgetBtn.onclick=()=>openBudget();txCancel.onclick=()=>txDialog.close();txType.onchange=updateCats;txAmount.addEventListener('input',updateAmountPreview);budgetCancel.onclick=()=>budgetDialog.close();budgetSave.onclick=saveBudget;itemType.onchange=renderItemList;addItemBtn.onclick=addItem;newItemName.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addItem()}});
exportBtn.onclick=()=>{let blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='kakeibo-backup-'+ym()+'.json';a.click();URL.revokeObjectURL(a.href)};
importInput.onchange=async e=>{let f=e.target.files[0];if(!f)return;try{if(f.size>10*1024*1024)throw 0;let d=JSON.parse(await f.text());if(!d||typeof d!=='object'||!Array.isArray(d.transactions)||!d.budgets||typeof d.budgets!=='object')throw 0;state=normalizeState(d);if(saveState()){render();alert('読み込みました')}}catch{alert('読み込めないファイルです')}finally{e.target.value=''}};
resetBtn.onclick=()=>{if(confirm('すべての家計簿データを初期化しますか？')){state=normalizeState({});saveState();render()}};
window.addEventListener('resize',()=>scheduleChartDraw(140));
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
initNav();initIPadNavigation();populateType();initQuickEntry();initTheme();initMobileDaily();initIncomeMobileOverview();
render();
initCloudSync();
