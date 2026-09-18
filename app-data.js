// Data model, validation, local persistence, and shared calculations.
const TYPES = [
  {key:'income',label:'収入'}, {key:'tax',label:'社会保険・税金'}, {key:'saving',label:'貯蓄'}, {key:'self',label:'自己投資'},
  {key:'fixed',label:'固定費'}, {key:'special',label:'特別費'}, {key:'variable',label:'変動費'}
];
const DEFAULT_CATS = {
  income:['給与','ボーナス','配当収入','その他の収入'],
  tax:['健康保険','厚生年金','所得税','地方税'],
  saving:['NISA','預金','その他'],
  self:['書籍','学習','資格','その他'],
  fixed:['生命保険','住宅ローン','通信費','Youtube','iCloud+','MoneyForward'],
  special:['特別支出'],
  variable:['セブンイレブン','ローソン','ファミリーマート','スギ薬局','ゲンキー','その他','外食','インターネット','ネット通販','その他2']
};
const DEFAULT_BUDGET = {income:{},tax:{},saving:{NISA:30000},self:{},fixed:{生命保険:25646,住宅ローン:60000,通信費:2181,Youtube:1280,'iCloud+':150,MoneyForward:550},special:{},variable:{セブンイレブン:20000,ローソン:0,ファミリーマート:0,スギ薬局:15000,ゲンキー:15000,その他:0,外食:0,インターネット:0,ネット通販:0,その他2:0}};
let current = new Date(); current.setDate(1);
let state = loadState();
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
    if(t.key==='income'&&!categories.income.includes('その他の収入'))categories.income.push('その他の収入');
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
