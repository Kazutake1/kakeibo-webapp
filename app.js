const TYPES = [
  {key:'income',label:'収入'}, {key:'tax',label:'社会保険・税金'}, {key:'saving',label:'貯蓄'}, {key:'self',label:'自己投資'},
  {key:'fixed',label:'固定費'}, {key:'special',label:'特別費'}, {key:'variable',label:'変動費'}
];
const DEFAULT_CATS = {
  income:['給与','ボーナス','配当収入'],
  tax:['健康保険','厚生年金','所得税','地方税'],
  saving:['NISA','預金','その他'],
  self:['書籍','学習','資格','その他'],
  fixed:['生命保険','住宅ローン','通信費','Youtube','iCloud+','MoneyForward'],
  special:['特別支出'],
  variable:['セブンイレブン','ローソン','ファミリーマート','スギ薬局','ゲンキー','その他','外食','インターネット','ネット通販','その他2']
};
const DEFAULT_BUDGET = {income:{},tax:{},saving:{NISA:30000},self:{},fixed:{生命保険:25646,住宅ローン:60000,通信費:2181,Youtube:1280,'iCloud+':150,MoneyForward:550},special:{},variable:{セブンイレブン:20000,ローソン:0,ファミリーマート:0,スギ薬局:15000,ゲンキー:15000,その他:0,外食:0,インターネット:0,ネット通販:0,その他2:0}};
const tabs=[['dashboard','概要'],['expense','支出'],['income','収入'],['budget','予算'],['settings','設定']];
let current = new Date(); current.setDate(1);
let state = loadState();
let mobileDailyDate = new Date();
const SUPABASE_URL='https://blyyxmhehubufqzyqapq.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_DB6exzL5oiIQ3e30r6nqmw_FC14UaM4';
const SYNC_SESSION_KEY='kakeibo-sync-session-v1';
let syncSession=null;
let syncUser=null;
let syncSaveTimer=null;
let syncBusy=false;
let suppressCloudSync=false;

function newId(){return crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)}
function cleanText(v,max=200){return String(v??'').replace(/[\u0000-\u001F\u007F]/g,' ').trim().slice(0,max)}
function validDateString(v){const s=String(v||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const [y,m,d]=s.split('-').map(Number),dt=new Date(y,m-1,d);return dt.getFullYear()===y&&dt.getMonth()===m-1&&dt.getDate()===d}
function finiteMoney(v){const n=Number(v);return Number.isFinite(n)&&n>=0&&n<=1e12?Math.round(n):0}
function loadState(){try{const d=JSON.parse(localStorage.getItem('kakeibo-v1'))||{};return normalizeState(d)}catch{return normalizeState({})}}
function normalizeState(input){
  const d=input&&typeof input==='object'?input:{};
  const categories={};
  for(const t of TYPES){
    const raw=Array.isArray(d.categories?.[t.key])?d.categories[t.key]:deepCopy(DEFAULT_CATS[t.key]||[]);
    categories[t.key]=[...new Set(raw.map(x=>cleanText(x,80)).filter(Boolean))].slice(0,200);
  }
  const allowedTypes=new Set(TYPES.map(t=>t.key));
  const transactions=(Array.isArray(d.transactions)?d.transactions:[]).map(x=>{
    const type=allowedTypes.has(x?.type)?x.type:'variable';
    const date=validDateString(x?.date)?x.date:new Date().toISOString().slice(0,10);
    return {id:cleanText(x?.id,100)||newId(),date,type,category:cleanText(x?.category,80),item:cleanText(x?.item,200),amount:finiteMoney(x?.amount),amountExpression:cleanText(x?.amountExpression||x?.amount,100),memo:cleanText(x?.memo,500)};
  }).filter(x=>x.amount>=0).slice(-50000);
  const budgets={};
  if(d.budgets&&typeof d.budgets==='object')for(const [month,monthData] of Object.entries(d.budgets)){
    if(!/^\d{4}-\d{2}$/.test(month)||!monthData||typeof monthData!=='object')continue;
    budgets[month]={};
    for(const t of TYPES){budgets[month][t.key]={};const obj=monthData[t.key];if(obj&&typeof obj==='object')for(const [cat,val] of Object.entries(obj)){const c=cleanText(cat,80);if(c)budgets[month][t.key][c]=finiteMoney(val)}}
  }
  return {transactions,budgets,categories};
}
function catsFor(type){return state.categories?.[type]||[]}
function saveState(){
  try{
    localStorage.setItem('kakeibo-v1',JSON.stringify(state));
    if(!suppressCloudSync)scheduleCloudSync();
    return true
  }catch(e){
    console.error('保存に失敗しました',e);
    alert('データを保存できませんでした。ブラウザの保存容量やプライベートブラウズ設定を確認してください。');
    return false
  }
}
function ym(d=current){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
function money(n){return '¥'+Math.round(n||0).toLocaleString('ja-JP')}
function deepCopy(o){return JSON.parse(JSON.stringify(o))}
function normalizeBudgetForCategories(source){
  const out={};
  for(const t of TYPES){
    out[t.key]={};
    for(const c of catsFor(t.key)){
      const hasValue=source?.[t.key]&&Object.prototype.hasOwnProperty.call(source[t.key],c);
      out[t.key][c]=hasValue?finiteMoney(source[t.key][c]):finiteMoney(DEFAULT_BUDGET[t.key]?.[c]||0);
    }
  }
  return out
}
function previousBudgetSource(monthKey){
  const keys=Object.keys(state.budgets||{})
    .filter(k=>/^\d{4}-\d{2}$/.test(k)&&k<monthKey)
    .sort();
  return keys.length?state.budgets[keys[keys.length-1]]:DEFAULT_BUDGET;
}
function ensureBudgetMonth(monthKey){
  if(!state.budgets[monthKey]){
    state.budgets[monthKey]=normalizeBudgetForCategories(previousBudgetSource(monthKey));
  }else{
    state.budgets[monthKey]=normalizeBudgetForCategories(state.budgets[monthKey]);
  }
  return state.budgets[monthKey];
}
function getBudget(){return ensureBudgetMonth(ym())}
function applyBudgetForwardFrom(monthKey,budget){
  const snapshot=normalizeBudgetForCategories(budget);
  for(const key of Object.keys(state.budgets||{})){
    if(/^\d{4}-\d{2}$/.test(key)&&key>monthKey){
      state.budgets[key]=deepCopy(snapshot);
    }
  }
}
function monthTx(){let k=ym(); return state.transactions.filter(t=>typeof t.date==='string'&&t.date.startsWith(k))}
function sum(arr){return arr.reduce((a,b)=>a+(+b||0),0)}
function typeSum(type){return sum(monthTx().filter(t=>t.type===type).map(t=>t.amount))}
function budgetTypeSum(type){return sum(Object.values(getBudget()[type]||{}))}
function effectiveTypeSum(type){
  // Fixed expenses are treated as monthly expenses automatically from their budget.
  // Actual fixed-expense transactions are not added again, preventing double counting.
  return type==='fixed'?budgetTypeSum('fixed'):typeSum(type)
}
function initNav(){for(const [k,l] of tabs){const b=document.createElement('button');b.className='tab'+(k==='dashboard'?' active':'');b.textContent=l;b.dataset.tab=k;document.querySelector('#tabs').appendChild(b);const m=b.cloneNode(true);m.className=k==='dashboard'?'active':'';m.dataset.tab=k;document.querySelector('#mobileNav').appendChild(m)} document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>showPanel(b.dataset.tab))}
function showPanel(k){
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.dataset.panel===k));
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===k));
  if(k==='expense'||k==='income'){renderCalendar();renderMobileDaily()}
  if(k==='budget'){renderBudgetEditor();renderItemManager()}
}
function renderCurrentMonthViews(){renderMobileRecent();document.querySelector('#monthLabel').textContent=`${current.getFullYear()}年${current.getMonth()+1}月`;renderSummary();renderBudgetOverview();renderVariableStatus();renderCalendar();renderBudgetEditor();renderItemManager();requestAnimationFrame(()=>requestAnimationFrame(drawCharts))}
function render(){refreshQuickEntry();renderCurrentMonthViews();renderMobileDaily()}
function renderMobileRecent(){const wrap=document.getElementById('mobileRecentList');if(!wrap)return;const rows=[...monthTx()].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,5);if(!rows.length){wrap.innerHTML='<div class="recent-empty">まだ入力はありません</div>';return}wrap.innerHTML=rows.map(t=>{const d=(t.date||'').slice(5).replace('-','/');const sign=t.type==='income'?'+':'−';return `<div class="recent-row"><div class="recent-icon">${escapeHtml((t.category||'?').slice(0,1))}</div><div class="recent-main"><strong>${escapeHtml(t.item||t.category||'')}</strong><span>${d} ・ ${escapeHtml(t.category||'')}</span></div><div class="recent-amt ${t.type==='income'?'pos':''}">${sign}${money(t.amount).replace('¥','¥')}</div></div>`}).join('')}
function renderSummary(){
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
function renderTransactions(){const body=document.querySelector('#txBody');if(!body)return;const rows=monthTx().sort((a,b)=>(b.date||'').localeCompare(a.date||''));body.innerHTML=rows.length?rows.map(t=>{const typeLabel=TYPES.find(x=>x.key===t.type)?.label||t.type;return `<tr><td>${escapeHtml(t.date)}</td><td>${escapeHtml(typeLabel)}</td><td>${escapeHtml(t.category||'')}</td><td>${escapeHtml(t.item||'')}</td><td>${escapeHtml(t.memo||'')}</td><td class="amount">${money(t.amount)}</td><td><button class="ghost" onclick="editTxEncoded('${encodeArg(t.id)}')">編集</button></td></tr>`}).join(''):`<tr><td colspan="7" class="empty">この月のデータはありません</td></tr>`}
window.editTxEncoded=encoded=>openTx(decodeURIComponent(encoded));

function normalizeExpression(s){return String(s||'').trim().replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/[，,￥¥円\s]/g,'').replace(/[＋]/g,'+').replace(/[－−ー]/g,'-').replace(/[×＊]/g,'*').replace(/[÷／]/g,'/').replace(/[（]/g,'(').replace(/[）]/g,')').replace(/[＝=]$/,'')}
function evaluateAmountExpression(raw){
  const expr=normalizeExpression(raw);if(!expr||!/^[0-9+\-*/().]+$/.test(expr))return {ok:false,value:0};
  let i=0;
  const skip=()=>{while(expr[i]===' ')i++};
  const number=()=>{skip();const m=expr.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);if(!m)throw 0;i+=m[0].length;return Number(m[0])};
  const factor=()=>{skip();if(expr[i]==='+'){i++;return factor()}if(expr[i]==='-'){i++;return -factor()}if(expr[i]==='('){i++;const v=expression();skip();if(expr[i]!==')')throw 0;i++;return v}return number()};
  const term=()=>{let v=factor();while(true){skip();const op=expr[i];if(op!=='*'&&op!=='/')break;i++;const r=factor();if(op==='/'&&r===0)throw 0;v=op==='*'?v*r:v/r}return v};
  const expression=()=>{let v=term();while(true){skip();const op=expr[i];if(op!=='+'&&op!=='-')break;i++;const r=term();v=op==='+'?v+r:v-r}return v};
  try{const value=expression();skip();if(i!==expr.length||!Number.isFinite(value)||value<0||value>1e12)return {ok:false,value:0};return {ok:true,value:Math.round(value)}}catch{return {ok:false,value:0}}
}
function updateAmountPreview(){const raw=txAmount.value;const r=evaluateAmountExpression(raw);if(!raw.trim()){amountCalcHint.textContent='複数回の会計は + - × ÷ ( ) を使って入力できます';amountCalcHint.className='hint';return}if(r.ok){amountCalcHint.textContent='合計 '+money(r.value);amountCalcHint.className='hint pos'}else{amountCalcHint.textContent='計算式を確認してください';amountCalcHint.className='hint neg'}}

function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function encodeArg(s){return encodeURIComponent(String(s)).replace(/'/g,'%27')}
function populateType(){txType.innerHTML=TYPES.map(t=>`<option value="${t.key}">${t.label}</option>`).join(''); updateCats()}
function updateCats(extra=''){let arr=catsFor(txType.value);let bud=getBudget()[txType.value]||{};let cats=[...new Set([...arr,...Object.keys(bud)])];if(extra&&!cats.includes(extra))cats.push(extra);txCategory.innerHTML=cats.map(c=>`<option>${escapeHtml(c)}</option>`).join('')}
function initQuickEntry(){if(!document.getElementById('quickCategory'))return;const now=new Date();quickDateLabel.textContent=`${now.getMonth()+1}月${now.getDate()}日`;quickCategory.innerHTML=catsFor('variable').map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');quickCategory.onchange=()=>{if(!quickItem.value.trim())quickItem.placeholder=`例：${quickCategory.value}`};quickAmount.addEventListener('input',()=>{const r=evaluateAmountExpression(quickAmount.value);quickAmountResult.textContent=r.ok&&quickAmount.value.trim()?`合計 ${money(r.value)}`:''});quickSaveBtn.onclick=saveQuickEntry;quickFullBtn.onclick=()=>openTx()}
function refreshQuickEntry(){if(!document.getElementById('quickCategory'))return;const prev=quickCategory.value;quickCategory.innerHTML=catsFor('variable').map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');if(catsFor('variable').includes(prev))quickCategory.value=prev;const now=new Date();quickDateLabel.textContent=`${now.getMonth()+1}月${now.getDate()}日`}
function saveQuickEntry(){const expr=quickAmount.value.trim();const calc=evaluateAmountExpression(expr);if(!expr||!calc.ok){alert('金額を正しく入力してください');quickAmount.focus();return}const amount=calc.value;const now=new Date();const date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;const cat=quickCategory.value;state.transactions.push({id:newId(),date,type:'variable',category:cat,item:quickItem.value.trim(),amount,amountExpression:expr,memo:''});current=new Date(now.getFullYear(),now.getMonth(),1);saveState();quickAmount.value='';quickAmountResult.textContent='保存しました';quickItem.value='';render();setTimeout(()=>{if(quickAmountResult.textContent==='保存しました')quickAmountResult.textContent=''},1200)}
function openTx(id=null){txId.value=id||'';txDialogTitle.textContent=id?'収支を編集':'収支を追加'; if(id){let t=state.transactions.find(x=>x.id===id);txDate.value=t.date;txType.value=t.type;updateCats(t.category);txCategory.value=t.category;txItem.value=t.item;txAmount.value=t.amountExpression||t.amount;txMemo.value=t.memo||'';updateAmountPreview()}else{txDate.value=ym()+'-'+String(Math.min(new Date().getDate(),new Date(current.getFullYear(),current.getMonth()+1,0).getDate())).padStart(2,'0');txType.value='variable';updateCats();txItem.value='';txAmount.value='';txMemo.value='';updateAmountPreview()} txDialog.showModal()}
window.editTx=openTx;
txForm.onsubmit=e=>{e.preventDefault();const calc=evaluateAmountExpression(txAmount.value);if(!calc.ok){updateAmountPreview();txAmount.focus();return}let obj={id:txId.value||newId(),date:txDate.value,type:txType.value,category:txCategory.value,item:txItem.value.trim(),amount:calc.value,amountExpression:txAmount.value.trim(),memo:txMemo.value.trim()};let i=state.transactions.findIndex(x=>x.id===obj.id);if(i>=0)state.transactions[i]=obj;else state.transactions.push(obj);saveState();txDialog.close();render()};
function renderBudgetEditor(){const b=getBudget();budgetEditor.innerHTML=TYPES.map(t=>`<div class="budget-section" style="margin-bottom:10px"><h3>${t.label}</h3><div class="rows">${catsFor(t.key).map(c=>`<div class="row"><span>${escapeHtml(c)}</span><strong>${money(b[t.key]?.[c]||0)}</strong></div>`).join('')||'<div class="empty">項目がありません</div>'}</div></div>`).join('')+`<button class="primary" onclick="openBudget()">予算を編集</button>`}
window.openBudget=()=>{
  const b=getBudget();
  const monthText=`${current.getFullYear()}年${current.getMonth()+1}月`;
  budgetDialogBody.innerHTML=`<div class="hint" style="margin-bottom:14px"><strong>${monthText}から適用</strong><br>保存した予算はこの月と後の月に反映され、前の月の予算は変更されません。</div>`+
    TYPES.map(t=>`<h3>${t.label}</h3><div class="form-grid">${catsFor(t.key).map(c=>`<div class="field"><label>${escapeHtml(c)}</label><input type="number" min="0" data-budget-type="${t.key}" data-budget-cat="${escapeHtml(c)}" value="${b[t.key]?.[c]||0}"></div>`).join('')||'<div class="hint">項目がありません</div>'}</div>`).join('');
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
function pageLabelFor(kind){return kind==='income'?'収入':'支出'}
function pageAmountForDate(kind,dateKey){
  const type=pageTypeFor(kind);
  return sum(state.transactions.filter(t=>t.date===dateKey&&t.type===type).map(t=>t.amount))
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
  const type=pageTypeFor(kind);
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

  const tx=state.transactions.filter(t=>t.type===type&&t.date===dateKey);
  const dayTotal=sum(tx.map(t=>t.amount));
  document.getElementById(prefix+'DayTotal').textContent=money(dayTotal);
  document.getElementById(prefix+'SummaryDay').textContent=money(dayTotal);

  const ws=startOfWeekMonday(d),we=new Date(ws);we.setDate(we.getDate()+6);
  const weekTotal=sum(state.transactions.filter(t=>t.type===type&&validDateString(t.date)).filter(t=>{
    const [y,m,dd]=t.date.split('-').map(Number),x=new Date(y,m-1,dd);
    return x>=ws&&x<=we
  }).map(t=>t.amount));
  document.getElementById(prefix+'SummaryWeek').textContent=money(weekTotal);

  const monthKey=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  const monthTotal=sum(state.transactions.filter(t=>t.type===type&&String(t.date).startsWith(monthKey)).map(t=>t.amount));
  document.getElementById(prefix+'SummaryMonth').textContent=money(monthTotal);

  const list=document.getElementById(prefix+'CategoryList');
  const cats=catsFor(type);
  const palette=kind==='income'
    ?['#347fd6','#438edc','#54a0e6','#69afea','#7dbbea','#5f9ee0']
    :['#df4f5c','#e3646e','#e77982','#ee8d95','#d96675','#c84f63','#ef6f61','#d85c70','#e88770','#ca596a'];

  list.innerHTML=cats.length?cats.map((cat,i)=>{
    const amount=sum(tx.filter(t=>t.category===cat).map(t=>t.amount));
    const action=amount
      ? `openPageDailyHistory('${kind}','${encodeArg(cat)}')`
      : `openPageDailyEntry('${kind}','${encodeArg(cat)}')`;
    return `<button type="button" class="day-cat-row" onclick="${action}">
      <span class="day-cat-main"><i class="day-cat-dot" style="background:${palette[i%palette.length]}"></i><span class="day-cat-name">${escapeHtml(cat)}</span></span>
      <span class="day-cat-action">${amount?`<strong class="day-cat-amount">${money(amount)}</strong>`:`<span class="day-cat-add">＋追加</span>`}<span class="day-cat-arrow">›</span></span>
    </button>`
  }).join(''):`<div class="empty">${kind==='income'?'収入':'変動費'}の項目がありません</div>`;
}
function renderMobileDaily(){
  renderMobilePage('expense');
  renderMobilePage('income');
}
window.openPageDailyEntry=(kind,encoded)=>{
  openDailyEntryEditor(pageTypeFor(kind),decodeURIComponent(encoded))
};
window.openPageDailyHistory=(kind,encoded)=>{
  openDailyHistoryFor(pageTypeFor(kind),encoded)
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
window.openDailyEntry=encoded=>openDailyEntryEditor('variable',decodeURIComponent(encoded));
window.openDailyIncome=encoded=>openDailyEntryEditor('income',decodeURIComponent(encoded));

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
window.openDailyHistory=encoded=>openDailyHistoryFor('variable',encoded);
window.openDailyIncomeHistory=encoded=>openDailyHistoryFor('income',encoded);

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
function bindDailySwipe(rootId){
  const root=document.getElementById(rootId);
  if(!root)return;
  let touchX=null;
  root.addEventListener('touchstart',e=>{touchX=e.changedTouches[0]?.clientX??null},{passive:true});
  root.addEventListener('touchend',e=>{
    if(touchX===null)return;
    const dx=(e.changedTouches[0]?.clientX??touchX)-touchX;touchX=null;
    if(Math.abs(dx)>55)shiftMobileDailyDate(dx<0?1:-1)
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
  const y=current.getFullYear(),m=current.getMonth();
  const days=new Date(y,m+1,0).getDate(), offset=(new Date(y,m,1).getDay()+6)%7;
  const weeks=Math.ceil((offset+days)/7);
  const tx=monthTx().filter(t=>t.type===type);
  let html='<table class="cal-table">';
  for(let w=0;w<weeks;w++){
    const ds=[];
    for(let c=0;c<7;c++){const d=w*7+c-offset+1;ds.push(d>=1&&d<=days?d:null)}
    html+=`<tr><th class="cal-cat">項目</th>${ds.map(d=>{
      if(!d)return '<th></th>';
      const dt=new Date(y,m,d),cls=dayClass(dt),wd=['日','月','火','水','木','金','土'][dt.getDay()],hn=holidayName(dt);
      return `<th class="${cls}" title="${escapeHtml(hn)}">${d}<span class="weekday-label">${wd}</span></th>`
    }).join('')}<th>合計</th></tr>`;

    for(const cat of cats){
      html+=`<tr><td class="cal-cat">${escapeHtml(cat)}</td>${ds.map(d=>{
        if(!d)return '<td></td>';
        const date=ym()+'-'+String(d).padStart(2,'0');
        const a=sum(tx.filter(t=>t.category===cat&&t.date===date).map(t=>t.amount));
        return `<td class="cal-cell ${type==='income'?'income-cell':''}" onclick="quickAddType('${date}','${type}','${encodeArg(cat)}')">${a?`<span class="amt">${money(a)}</span>`:''}</td>`
      }).join('')}<td class="cal-cell ${type==='income'?'income-cell':''}"><b>${money(sum(tx.filter(t=>t.category===cat&&ds.includes(+t.date.slice(-2))).map(t=>t.amount)))}</b></td></tr>`
    }

    html+=`<tr><td class="cal-cat"><b>${label}合計</b></td>${ds.map(d=>{
      if(!d)return '<td></td>';
      const date=ym()+'-'+String(d).padStart(2,'0');
      const a=sum(tx.filter(t=>t.date===date).map(t=>t.amount));
      return `<td class="${type==='income'?'income-cell':''}"><b>${a?money(a):''}</b></td>`
    }).join('')}<td></td></tr>`;
  }
  html+='</table>';
  root.innerHTML=html
}
function renderCalendar(){
  renderTypeCalendar('expenseCalendarWrap','variable',catsFor('variable'),'支出');
  renderTypeCalendar('incomeCalendarWrap','income',catsFor('income'),'収入');
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
window.quickAdd=(date,encoded)=>quickAddType(date,'variable',encoded);
function renderItemManager(){if(!document.getElementById('itemType'))return;const selected=itemType.dataset.ready?itemType.value:'variable';itemType.innerHTML=TYPES.map(t=>`<option value="${t.key}">${t.label}</option>`).join('');itemType.value=selected||'variable';itemType.dataset.ready='1';renderItemList()}
function renderItemList(){if(!document.getElementById('itemList'))return;const type=itemType.value||'variable';const cats=catsFor(type);itemList.innerHTML=cats.length?cats.map(c=>`<div class="item-chip"><span>${escapeHtml(c)}</span><span class="item-chip-actions"><button class="edit-item" type="button" onclick="editItem('${type}','${encodeArg(c)}')">編集</button><button class="delete-item" type="button" onclick="deleteItem('${type}','${encodeArg(c)}')">削除</button></span></div>`).join(''):'<div class="empty">項目がありません</div>'}
function addItem(){const type=itemType.value;const name=newItemName.value.trim();if(!name)return;if(catsFor(type).some(c=>c.toLowerCase()===name.toLowerCase())){alert('同じ名前の項目があります');return}state.categories[type].push(name);const b=getBudget();if(!(name in b[type]))b[type][name]=0;saveState();newItemName.value='';render();itemType.value=type;renderItemList();updateCats()}
window.editItem=(type,encoded)=>{const oldName=decodeURIComponent(encoded);const input=prompt(`「${oldName}」の新しい項目名を入力してください`,oldName);if(input===null)return;const newName=input.trim();if(!newName||newName===oldName)return;if(catsFor(type).some(c=>c!==oldName&&c.toLowerCase()===newName.toLowerCase())){alert('同じ名前の項目があります');return}if(!confirm(`「${oldName}」を「${newName}」に変更しますか？\n過去の収支データと各月の予算にも反映されます。`))return;state.categories[type]=catsFor(type).map(c=>c===oldName?newName:c);for(const tx of state.transactions){if(tx.type===type&&tx.category===oldName)tx.category=newName}for(const month of Object.values(state.budgets)){if(!month?.[type]||!(oldName in month[type]))continue;const oldValue=month[type][oldName];if(!(newName in month[type]))month[type][newName]=oldValue;delete month[type][oldName]}saveState();render();itemType.value=type;renderItemList();updateCats()};
window.deleteItem=(type,encoded)=>{const name=decodeURIComponent(encoded);if(!confirm(`「${name}」を削除しますか？\n過去の収支データは削除されません。`))return;state.categories[type]=catsFor(type).filter(c=>c!==name);for(const month of Object.values(state.budgets)){if(month?.[type])delete month[type][name]}saveState();render();itemType.value=type;renderItemList();updateCats()};
function drawCharts(){
  drawWeekly();
  drawDonut('donutChart','donutLegend',TYPES.filter(t=>t.key!=='income').map(t=>[t.label,effectiveTypeSum(t.key)]));
  drawDonut('variableDonut','variableLegend',catsFor('variable').map(c=>[c,sum(monthTx().filter(t=>t.type==='variable'&&t.category===c).map(t=>t.amount))]))
}

function chartTheme(){const dark=document.body.classList.contains('dark-mode');return dark?{grid:'#2b4056',muted:'#9eb0c6',strong:'#cfe5fb',hole:'#162231',empty:'#264866'}:{grid:'#dbe7f7',muted:'#64748b',strong:'#1e3a5f',hole:'#ffffff',empty:'#dbeafe'}}
function prepCanvas(id){const c=document.getElementById(id);let r=c.getBoundingClientRect();let w=Math.max(1,r.width||c.parentElement?.clientWidth||300);let h=Math.max(id==='weeklyChart'?300:180,r.height||c.parentElement?.clientHeight||250);const dpr=devicePixelRatio||1;c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);let x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);return [x,w,h]}
function drawWeekly(){
  let [ctx,w,h]=prepCanvas('weeklyChart');
  ctx.clearRect(0,0,w,h);

  const WEEKLY_BUDGET=14000;
  const lastDay=new Date(current.getFullYear(),current.getMonth()+1,0).getDate();
  const periods=[[1,7],[8,14],[15,21],[22,28],[29,lastDay]].filter(([a])=>a<=lastDay);
  const cats=catsFor('variable');
  const tx=monthTx().filter(t=>t.type==='variable');

  const matrix=periods.map(([a,b])=>
    cats.map(c=>sum(
      tx.filter(t=>t.category===c&&+t.date.slice(-2)>=a&&+t.date.slice(-2)<=b)
        .map(t=>t.amount)
    ))
  );
  const totals=matrix.map(r=>sum(r));

  // Keep the ¥14,000 weekly budget line visible even in low-spend weeks.
  const max=Math.max(...totals,WEEKLY_BUDGET*1.2,1);
  const left=54,right=14,top=26,bottom=40;
  const plotW=w-left-right,plotH=h-top-bottom;
  const ct=chartTheme();

  // Grid and y-axis.
  ctx.strokeStyle=ct.grid;
  ctx.lineWidth=1;
  ctx.fillStyle=ct.muted;
  ctx.font='11px sans-serif';
  ctx.textAlign='right';
  for(let i=0;i<5;i++){
    const y=top+i*plotH/4;
    const val=Math.round(max*(1-i/4));
    ctx.beginPath();
    ctx.moveTo(left,y);
    ctx.lineTo(w-right,y);
    ctx.stroke();
    ctx.fillText(val?money(val):'¥0',left-7,y+4);
  }

  // Weekly budget threshold: ¥2,000/day × 7 days = ¥14,000/week.
  const budgetY=top+plotH-(WEEKLY_BUDGET/max*plotH);
  ctx.save();
  ctx.setLineDash([7,5]);
  ctx.strokeStyle='#ef4444';
  ctx.lineWidth=1.5;
  ctx.beginPath();
  ctx.moveTo(left,budgetY);
  ctx.lineTo(w-right,budgetY);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle='#ef4444';
  ctx.font='700 10px sans-serif';
  ctx.textAlign='left';
  ctx.fillText('週予算 ¥14,000',left+4,Math.max(top+11,budgetY-6));

  // Weekly stacked bars.
  const slot=plotW/periods.length;
  const barW=Math.min(58,slot*.58);
  periods.forEach((p,i)=>{
    const x=left+i*slot+(slot-barW)/2;
    let yBottom=top+plotH;

    matrix[i].forEach((v,j)=>{
      if(!v)return;
      const bh=v/max*plotH;
      yBottom-=bh;
      ctx.fillStyle=chartColor(j);
      ctx.fillRect(x,yBottom,barW,bh);
    });

    ctx.fillStyle=ct.muted;
    ctx.font='11px sans-serif';
    ctx.textAlign='center';
    const end=Math.min(p[1],lastDay);
    ctx.fillText(`${p[0]}-${end}日`,x+barW/2,h-14);

    if(totals[i]){
      ctx.fillStyle=totals[i]>=WEEKLY_BUDGET?'#ef4444':ct.strong;
      ctx.font='700 11px sans-serif';
      ctx.fillText(
        money(totals[i]),
        x+barW/2,
        Math.max(12,top+plotH-totals[i]/max*plotH-6)
      );
    }
  });

  document.getElementById('weeklyLegend').innerHTML=cats
    .map((c,j)=>`<span><i class="dot" style="background:${chartColor(j)}"></i>${escapeHtml(c)}</span>`)
    .join('');
}
const CHART_COLORS_LIGHT=['#2563eb','#f59e0b','#059669','#db2777','#dc2626','#0891b2','#7c3aed','#65a30d','#a16207','#0f766e'];
const CHART_COLORS_DARK=['#60a5fa','#fbbf24','#34d399','#f472b6','#f87171','#22d3ee','#a78bfa','#a3e635','#f59e0b','#2dd4bf'];
function chartColors(){return document.body.classList.contains('dark-mode')?CHART_COLORS_DARK:CHART_COLORS_LIGHT}
function chartColor(index){const palette=chartColors();return palette[index%palette.length]}
const donutLegendModes={donutLegend:'percent',variableLegend:'percent'};
function setDonutLegendMode(legendId,mode){
  if(mode!=='percent'&&mode!=='amount')return;
  donutLegendModes[legendId]=mode;
  const root=document.getElementById(legendId);
  if(!root)return;
  root.dataset.mode=mode;
  root.querySelectorAll('.donut-mode-btn').forEach(btn=>{
    const active=btn.dataset.mode===mode;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-pressed',active?'true':'false');
  });
}
function drawDonut(canvasId,legendId,data){
  let [ctx,w,h]=prepCanvas(canvasId);
  ctx.clearRect(0,0,w,h);
  const allData=data.slice();
  const drawableData=allData.map((entry,index)=>[...entry,index]).filter(x=>x[1]>0);
  let total=sum(allData.map(x=>x[1]));
  let cx=w/2,cy=h/2-2,r=Math.min(w,h)*.34,inner=r*.58,start=-Math.PI/2;
  if(!total){
    const ct=chartTheme();ctx.fillStyle=ct.empty;
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.arc(cx,cy,inner,0,Math.PI*2,true);ctx.fill('evenodd');
  }else{
    drawableData.forEach(([l,v,i])=>{
      let a=v/total*Math.PI*2;
      ctx.fillStyle=chartColor(i);
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,start,start+a);ctx.closePath();ctx.fill();
      start+=a
    });
    ctx.globalCompositeOperation='destination-out';ctx.beginPath();ctx.arc(cx,cy,inner,0,Math.PI*2);ctx.fill();ctx.globalCompositeOperation='source-over';
  }
  const ct=chartTheme();
  ctx.fillStyle=ct.strong;ctx.textAlign='center';ctx.font='700 22px sans-serif';ctx.fillText(money(total),cx,cy-1);
  ctx.fillStyle=ct.muted;ctx.font='12px sans-serif';ctx.fillText('合計',cx,cy+20);
  const mode=donutLegendModes[legendId]||'percent';
  const root=document.getElementById(legendId);
  root.dataset.mode=mode;
  root.innerHTML=`<div class="donut-mode-toggle" role="group" aria-label="凡例の表示切替"><button type="button" class="donut-mode-btn ${mode==='percent'?'active':''}" data-mode="percent" aria-pressed="${mode==='percent'}">割合</button><button type="button" class="donut-mode-btn ${mode==='amount'?'active':''}" data-mode="amount" aria-pressed="${mode==='amount'}">金額</button></div><div class="donut-legend-list">${allData.map(([l,v],i)=>`<div class="donut-legend-row"><div class="donut-legend-name"><i class="dot" style="background:${chartColor(i)}"></i><span>${escapeHtml(l)}</span></div><span class="donut-legend-value donut-value-percent">${total?Math.round(v/total*100):0}%</span><strong class="donut-legend-value donut-value-amount">${money(v)}</strong></div>`).join('')}</div>`;
  root.querySelectorAll('.donut-mode-btn').forEach(btn=>btn.addEventListener('click',()=>setDonutLegendMode(legendId,btn.dataset.mode)));
  setDonutLegendMode(legendId,mode);
}


function syncHeaders(includeAuth=true){
  const h={'apikey':SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'};
  if(includeAuth&&syncSession?.access_token)h.Authorization='Bearer '+syncSession.access_token;
  return h
}
function setSyncStatus(kind,title,detail){
  const t=document.getElementById('syncStatusTitle'),d=document.getElementById('syncStatusDetail'),dot=document.getElementById('syncStatusDot');
  if(t)t.textContent=title;if(d)d.textContent=detail||'';if(dot)dot.className='sync-dot'+(kind?' '+kind:'')
}
function updateSyncUI(){
  const signedIn=!!syncUser,out=document.getElementById('syncSignedOut'),inside=document.getElementById('syncSignedIn'),email=document.getElementById('syncUserEmail');
  if(out)out.hidden=signedIn;if(inside)inside.hidden=!signedIn;if(email)email.textContent=signedIn?`ログイン中: ${syncUser.email||''}`:'';
  if(!signedIn)setSyncStatus('','未ログイン','この端末内だけに保存されています')
}
function persistSyncSession(){try{if(syncSession)localStorage.setItem(SYNC_SESSION_KEY,JSON.stringify(syncSession));else localStorage.removeItem(SYNC_SESSION_KEY)}catch{}}
function loadSyncSession(){try{const s=JSON.parse(localStorage.getItem(SYNC_SESSION_KEY)||'null');if(s&&s.access_token&&s.refresh_token)syncSession=s}catch{}}
async function refreshSyncSession(){
  if(!syncSession?.refresh_token)return false;
  try{
    const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:syncHeaders(false),body:JSON.stringify({refresh_token:syncSession.refresh_token})});
    if(!r.ok)throw new Error('refresh failed');
    syncSession=await r.json();persistSyncSession();return true
  }catch{syncSession=null;syncUser=null;persistSyncSession();updateSyncUI();return false}
}
async function supabaseFetch(path,options={},retry=true){
  if(!syncSession?.access_token)throw new Error('not signed in');
  const doFetch=()=>fetch(SUPABASE_URL+path,{...options,headers:{...syncHeaders(true),...(options.headers||{})}});
  let r=await doFetch();if(r.status===401&&retry&&await refreshSyncSession())r=await doFetch();return r
}
async function fetchSyncUser(){
  if(!syncSession?.access_token)return null;
  try{
    let r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:syncHeaders(true)});
    if(r.status===401&&await refreshSyncSession())r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:syncHeaders(true)});
    if(!r.ok)throw new Error('user fetch failed');
    syncUser=await r.json();return syncUser
  }catch{syncUser=null;return null}
}
function hasMeaningfulLocalData(){return Array.isArray(state?.transactions)&&state.transactions.length>0}
async function fetchCloudState(){
  const r=await supabaseFetch(`/rest/v1/kakeibo_user_state?select=state,updated_at&user_id=eq.${encodeURIComponent(syncUser.id)}&limit=1`,{method:'GET',headers:{Accept:'application/json'}});
  if(!r.ok)throw new Error(`cloud read ${r.status}`);const rows=await r.json();return rows[0]||null
}
async function uploadCloudState(){
  if(!syncUser||syncBusy)return false;
  syncBusy=true;setSyncStatus('busy','同期中','クラウドへ保存しています…');
  try{
    const r=await supabaseFetch('/rest/v1/kakeibo_user_state?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation',Accept:'application/json'},body:JSON.stringify({user_id:syncUser.id,state})});
    if(!r.ok)throw new Error(`cloud write ${r.status}`);
    await r.json();setSyncStatus('ok','同期済み',`最終同期 ${new Date().toLocaleString('ja-JP')}`);return true
  }catch(e){console.error(e);setSyncStatus('err','同期エラー','通信状況を確認して「今すぐ同期」を押してください');return false}
  finally{syncBusy=false}
}
function scheduleCloudSync(){if(!syncUser)return;clearTimeout(syncSaveTimer);syncSaveTimer=setTimeout(()=>uploadCloudState(),700)}
async function applyCloudState(row){
  if(!row?.state)return false;suppressCloudSync=true;
  try{state=normalizeState(row.state);localStorage.setItem('kakeibo-v1',JSON.stringify(state));render();return true}
  finally{suppressCloudSync=false}
}
async function initialCloudSync(){
  if(!syncUser)return;setSyncStatus('busy','同期中','クラウドデータを確認しています…');
  try{
    const cloud=await fetchCloudState();
    if(!cloud){await uploadCloudState();return}
    if(hasMeaningfulLocalData()){
      const useCloud=confirm('クラウド上にも家計簿データがあります。\\n\\n「OK」: クラウドのデータをこの端末へ読み込む\\n「キャンセル」: この端末のデータでクラウドを上書きする');
      if(useCloud){await applyCloudState(cloud);setSyncStatus('ok','同期済み','クラウドのデータを読み込みました')}else await uploadCloudState()
    }else{await applyCloudState(cloud);setSyncStatus('ok','同期済み','クラウドのデータを読み込みました')}
  }catch(e){console.error(e);setSyncStatus('err','同期エラー','クラウドデータを取得できませんでした')}
}
async function signInCloud(){
  const email=syncEmail.value.trim(),password=syncPassword.value;if(!email||!password){alert('メールアドレスとパスワードを入力してください');return}
  setSyncStatus('busy','ログイン中','認証しています…');
  try{
    const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:syncHeaders(false),body:JSON.stringify({email,password})});
    const data=await r.json();if(!r.ok)throw new Error(data?.msg||data?.error_description||'ログインできませんでした');
    syncSession=data;persistSyncSession();syncUser=await fetchSyncUser();if(!syncUser)throw new Error('ユーザー情報を取得できませんでした');
    updateSyncUI();await initialCloudSync()
  }catch(e){setSyncStatus('err','ログイン失敗',e.message||'ログインできませんでした')}
}
async function signUpCloud(){
  const email=syncEmail.value.trim(),password=syncPassword.value;if(!email||!password){alert('メールアドレスとパスワードを入力してください');return}
  if(password.length<8){alert('パスワードは8文字以上にしてください');return}
  setSyncStatus('busy','登録中','アカウントを作成しています…');
  try{
    const r=await fetch(`${SUPABASE_URL}/auth/v1/signup`,{method:'POST',headers:syncHeaders(false),body:JSON.stringify({email,password})});
    const data=await r.json();if(!r.ok)throw new Error(data?.msg||data?.error_description||'登録できませんでした');
    if(data.access_token){syncSession=data;persistSyncSession();syncUser=await fetchSyncUser();updateSyncUI();await initialCloudSync()}
    else setSyncStatus('ok','確認メールを送信しました','メール内の確認リンクを開いたあと、この画面からログインしてください')
  }catch(e){setSyncStatus('err','登録失敗',e.message||'登録できませんでした')}
}
async function signOutCloud(){
  try{if(syncSession?.access_token)await fetch(`${SUPABASE_URL}/auth/v1/logout`,{method:'POST',headers:syncHeaders(true)})}catch{}
  syncSession=null;syncUser=null;persistSyncSession();updateSyncUI()
}
async function manualCloudSync(){
  if(!syncUser){alert('先にログインしてください');return}
  try{
    const cloud=await fetchCloudState();if(!cloud){await uploadCloudState();return}
    const useCloud=confirm('同期方法を選んでください。\\n\\n「OK」: クラウド → この端末\\n「キャンセル」: この端末 → クラウド');
    if(useCloud){await applyCloudState(cloud);setSyncStatus('ok','同期済み','クラウドのデータを読み込みました')}else await uploadCloudState()
  }catch(e){console.error(e);setSyncStatus('err','同期エラー','同期できませんでした')}
}
async function initCloudSync(){
  loadSyncSession();
  if(syncSession){syncUser=await fetchSyncUser();updateSyncUI();if(syncUser)await initialCloudSync()}else updateSyncUI();
  const a=document.getElementById('syncSignInBtn'),b=document.getElementById('syncSignUpBtn'),c=document.getElementById('syncSignOutBtn'),d=document.getElementById('syncNowBtn');
  if(a)a.onclick=signInCloud;if(b)b.onclick=signUpCloud;if(c)c.onclick=signOutCloud;if(d)d.onclick=manualCloudSync
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
  if(typeof drawCharts==='function') requestAnimationFrame(()=>drawCharts());
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
window.addEventListener('resize',()=>{clearTimeout(window.__rt);window.__rt=setTimeout(drawCharts,150)});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
let chartResizeTimer;window.addEventListener('resize',()=>{clearTimeout(chartResizeTimer);chartResizeTimer=setTimeout(()=>requestAnimationFrame(drawCharts),120)});
initNav();populateType();initQuickEntry();initTheme();initMobileDaily();
render();
initCloudSync();
