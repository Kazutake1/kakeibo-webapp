// Daily entry, history, touch navigation, and mobile daily initialization.
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
  let touchStart=null;
  root.addEventListener('touchstart',e=>{const touch=e.changedTouches[0];touchStart=touch?{x:touch.clientX??0,y:touch.clientY??0}:null},{passive:true});
  root.addEventListener('touchend',e=>{
    if(!touchStart)return;
    const touch=e.changedTouches[0];const dx=(touch?.clientX??touchStart.x)-touchStart.x;
    const dy=(touch?.clientY??touchStart.y)-touchStart.y;touchStart=null;
    if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.2){
      const days=dx<0?1:-1;
      shiftMobileDailyDate(days);
      animateDailySwipe(root,days)
    }
  },{passive:true});
  root.addEventListener('touchcancel',()=>{touchStart=null},{passive:true})
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
