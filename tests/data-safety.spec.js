const {test,expect}=require('@playwright/test');

async function start(page,seed){
  if(seed)await page.addInitScript(data=>localStorage.setItem('kakeibo-v1',JSON.stringify(data)),seed);
  await page.goto('/');
}

test('failed quick save keeps the entered amount and does not add a transaction',async({page})=>{
  await start(page);
  await page.locator('#quickAmount').fill('321');
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='kakeibo-v1')throw new Error('quota');return original.call(this,key,value)}});
  page.on('dialog',dialog=>dialog.accept());
  await page.locator('#quickSaveBtn').click();
  await expect(page.locator('#quickAmount')).toHaveValue('321');
  expect(await page.evaluate(()=>state.transactions.length)).toBe(0);
  expect(await page.evaluate(()=>localStorage.getItem('kakeibo-v1'))).toBeNull();
});

test('deleted fixed item still contributes to a past month but not this month or a new month',async({page})=>{
  const now=new Date(),past=new Date(now.getFullYear(),now.getMonth()-1,1);
  const pastKey=`${past.getFullYear()}-${String(past.getMonth()+1).padStart(2,'0')}`;
  const currentKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  await start(page,{transactions:[],categories:{fixed:['住宅ローン']},budgets:{[pastKey]:{fixed:{住宅ローン:60000}},[currentKey]:{fixed:{住宅ローン:60000}}}});
  page.on('dialog',dialog=>dialog.accept());
  await page.evaluate(()=>deleteItem('fixed',encodeURIComponent('住宅ローン')));
  const values=await page.evaluate(pastKey=>{
    const nowBudget=budgetTypeSum('fixed');
    current=new Date(Number(pastKey.slice(0,4)),Number(pastKey.slice(5))-1,1);
    const oldBudget=budgetTypeSum('fixed');
    current.setMonth(current.getMonth()+2);
    const nextBudget=budgetTypeSum('fixed');
    return {nowBudget,oldBudget,nextBudget,stored:JSON.parse(localStorage.getItem('kakeibo-v1')).budgets[pastKey].fixed['住宅ローン']};
  },pastKey);
  expect(values).toEqual({nowBudget:0,oldBudget:60000,nextBudget:0,stored:60000});
});

test('stale tab cannot silently overwrite a change saved in another tab',async({browser})=>{
  const context=await browser.newContext();
  const first=await context.newPage(),second=await context.newPage();
  await start(first);await start(second);
  second.on('dialog',dialog=>dialog.accept());
  await first.locator('#quickAmount').fill('123');await first.locator('#quickSaveBtn').click();
  await second.locator('#quickAmount').fill('456');await second.locator('#quickSaveBtn').click();
  expect(await second.evaluate(()=>JSON.parse(localStorage.getItem('kakeibo-v1')).transactions.map(x=>x.amount))).toEqual([123]);
  await expect(second.locator('#quickAmount')).toHaveValue('456');
  await context.close();
});
