const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block'});
const fs=require('node:fs/promises');
const LEGACY={income:{},tax:{},saving:{NISA:30000},self:{},fixed:{生命保険:25646,住宅ローン:60000,通信費:2181,Youtube:1280,'iCloud+':150,MoneyForward:550},special:{},variable:{セブンイレブン:20000,ローソン:0,ファミリーマート:0,スギ薬局:15000,ゲンキー:15000,その他:0,外食:0,インターネット:0,ネット通販:0,その他2:0}};
const baseline={transactions:[{id:'fixture-income',date:'2025-01-02',type:'income',category:'給与',item:'合成テスト',amount:250000,amountExpression:'250000',memo:'旧月'}],budgets:{'2025-01':{fixed:{住宅ローン:60000,過去項目:1000},variable:{外食:0}}},categories:{}};
const fakeSession=(id='synthetic-user')=>({access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id,email:'synthetic@example.test'}});

test.beforeEach(async({page})=>{
  // No test contacts the production Auth or Data API.
  await page.route('https://*.supabase.co/**',route=>route.abort());
});
async function open(page,data){
  if(data)await page.addInitScript(data=>localStorage.setItem('kakeibo-v1',JSON.stringify(data)),data);
  await page.goto('/');
}

test('legacy baseline is immutable and initial budget copies cannot change it',async({page})=>{
  await open(page);
  const result=await page.evaluate(()=>{
    const copy=initialBudgetSource();copy.fixed['住宅ローン']=0;
    return {baseline:LEGACY_DEFAULT_BUDGET,next:initialBudgetSource(),frozen:Object.isFrozen(LEGACY_DEFAULT_BUDGET)&&Object.values(LEGACY_DEFAULT_BUDGET).every(Object.isFrozen)};
  });
  expect(result).toEqual({baseline:LEGACY,next:LEGACY,frozen:true});
});

test('unsaved defaults and partial budgets keep legacy amounts without writing storage',async({page})=>{
  await open(page);
  const result=await page.evaluate(()=>{
    state=normalizeState({});
    const defaults=deepCopy(getBudget());
    const defaultData=hasMeaningfulLocalData();
    state=normalizeState({budgets:{'2025-01':{fixed:{住宅ローン:0,過去項目:1234}}}});
    current=new Date(2025,0,1);
    const partial=deepCopy(getBudget());
    return {defaults,defaultData,partial,stored:localStorage.getItem('kakeibo-v1')};
  });
  expect(result.defaults.fixed).toEqual(LEGACY.fixed);
  expect(result.defaults.saving.NISA).toBe(30000);
  expect(result.defaultData).toBe(false);
  expect(result.partial.fixed).toEqual({...LEGACY.fixed,住宅ローン:0,過去項目:1234});
  expect(result.stored).toBeNull();
});

test('historical and prior-month budgets retain zeros, custom values and archived values',async({page})=>{
  await open(page,baseline);
  const result=await page.evaluate(()=>{
    current=new Date(2025,0,1);const history=deepCopy(getBudget());
    current=new Date(2025,1,1);const next=deepCopy(getBudget());
    return {history,next,stored:JSON.parse(localStorage.getItem('kakeibo-v1'))};
  });
  expect(result.history.fixed.過去項目).toBe(1000);
  expect(result.history.variable.外食).toBe(0);
  expect(result.next.fixed.住宅ローン).toBe(60000);
  expect(result.next.fixed.過去項目).toBeUndefined();
  expect(result.stored).toEqual(baseline);
});

test('an archived budget with value is meaningful local data during cloud selection',async({page})=>{
  await open(page);
  const result=await page.evaluate(()=>{
    state=normalizeState({});ensureBudgetMonth(ym());
    state.budgets[ym()].fixed.過去項目=1250;
    return hasMeaningfulLocalData();
  });
  expect(result).toBe(true);
});

for(const width of [390,1194]){
  test(`stored markup and quote payloads stay inert at width ${width}`,async({page})=>{
    await page.setViewportSize({width,height:844});
    const payload=`'");window.__xssExecuted=true;//<img src=x onerror="window.__xssExecuted=true">&`;
    const now=new Date();const date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const categories={variable:[payload],income:[payload]};
    const transactions=['variable','self','special','income'].map((type,index)=>({id:payload+index,date,type,category:payload,item:payload,amount:123,amountExpression:'123',memo:payload}));
    await open(page,{categories,transactions,budgets:{}});
    await page.evaluate(()=>{
      for(const panel of ['dashboard','expense','income','budget','settings'])showPanel(panel);
      dailyHistoryType='variable';dailyHistoryCategory=state.categories.variable[0];renderDailyHistory();
      openIncomeMonthDetail(encodeArg(state.categories.income[0]));
    });
    expect(await page.evaluate(()=>window.__xssExecuted||false)).toBe(false);
    await expect(page.locator('img[src="x"],script:not([src])')).toHaveCount(0);
    expect(await page.locator('#itemList').textContent()).toContain(payload);
    const editButton=page.locator('#itemList .edit-item').first();
    const deleteButton=page.locator('#itemList .delete-item').first();
    await expect(editButton).not.toHaveAttribute('onclick',/.+/);
    await expect(deleteButton).not.toHaveAttribute('onclick',/.+/);
    await expect(editButton).toHaveAttribute('data-item-action','edit');
    await expect(deleteButton).toHaveAttribute('data-item-action','delete');
    await expect(editButton).toHaveAttribute('data-item-type','variable');
    await expect(editButton).toHaveAttribute('data-item-name',encodeURIComponent(payload).replace(/'/g,'%27'));
  });
}


test('delegated category edit/delete fires once after rerender and preserves historical budgets',async({page})=>{
  const oldCategory=`出張'"<&`;
  const newCategory=`出張費<更新> & '`;
  const now=new Date();
  const currentMonth=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const next=new Date(now.getFullYear(),now.getMonth()+1,1);
  const nextMonth=`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}`;
  const historyMonth='2025-01';
  const transaction={id:'historical-category-fixture',date:'2025-01-07',type:'variable',category:oldCategory,item:'記録',amount:1234,amountExpression:'1234',memo:'残す'};
  await open(page,{
    transactions:[transaction],
    categories:{variable:[oldCategory,'外食']},
    budgets:{
      [historyMonth]:{variable:{[oldCategory]:5000}},
      [currentMonth]:{variable:{[oldCategory]:6000}},
      [nextMonth]:{variable:{[oldCategory]:7000}}
    }
  });
  await page.locator('#tabs [data-tab="budget"]').click();
  await page.evaluate(()=>{renderItemManager();renderItemManager();renderItemList()});
  const oldRow=page.locator('#itemList .item-chip').filter({hasText:oldCategory});
  const editButton=oldRow.locator('.edit-item');
  await expect(editButton).toHaveAttribute('data-item-name',encodeURIComponent(oldCategory).replace(/'/g,'%27'));
  const dialogs=[];
  page.on('dialog',async dialog=>{
    dialogs.push(dialog.type());
    if(dialog.type()==='prompt')await dialog.accept(newCategory);
    else await dialog.accept();
  });
  await editButton.click();
  await expect(page.locator('#itemList .item-chip').filter({hasText:newCategory})).toHaveCount(1);
  expect(dialogs).toEqual(['prompt','confirm']);
  const renamed=await page.evaluate(({historyMonth,currentMonth,nextMonth,newCategory,oldCategory})=>({
    transaction:state.transactions[0],historical:state.budgets[historyMonth].variable[newCategory],
    current:state.budgets[currentMonth].variable[newCategory],
    next:state.budgets[nextMonth].variable[newCategory],
    legacyNameExists:state.categories.variable.includes(oldCategory)
  }),{historyMonth,currentMonth,nextMonth,newCategory,oldCategory});
  expect(renamed.transaction).toEqual({...transaction,category:newCategory});
  expect(renamed.historical).toBe(5000);
  expect(renamed.current).toBe(6000);
  expect(renamed.next).toBe(7000);
  expect(renamed.legacyNameExists).toBe(false);

  await page.evaluate(()=>{renderItemManager();renderItemList()});
  await page.locator('#itemList .item-chip').filter({hasText:newCategory}).locator('.delete-item').click();
  expect(dialogs).toEqual(['prompt','confirm','confirm']);
  const deleted=await page.evaluate(({historyMonth,currentMonth,nextMonth,newCategory})=>({
    categories:state.categories.variable,
    transaction:state.transactions[0],
    historical:state.budgets[historyMonth].variable[newCategory],
    current:state.budgets[currentMonth].variable[newCategory],
    next:state.budgets[nextMonth].variable[newCategory],
    saved:JSON.parse(localStorage.getItem('kakeibo-v1')).transactions[0]
  }),{historyMonth,currentMonth,nextMonth,newCategory});
  expect(deleted.categories).not.toContain(newCategory);
  expect(deleted.transaction).toEqual({...transaction,category:newCategory});
  expect(deleted.saved).toEqual({...transaction,category:newCategory});
  expect(deleted.historical).toBe(5000);
  expect(deleted.current).toBeUndefined();
  expect(deleted.next).toBeUndefined();
});

test('backup export and JSON restore preserve all historical data and exclude auth information',async({page})=>{
  await open(page,baseline);
  await page.evaluate(session=>{syncSession=session;syncUser=session.user;persistSyncSession();showPanel('settings')},fakeSession());
  const snapshot=await page.evaluate(()=>deepCopy(state));
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  const download=await downloadPromise;
  const backup=await fs.readFile(await download.path(),'utf8');
  expect(JSON.parse(backup)).toEqual(snapshot);
  expect(backup).not.toContain('synthetic-access');expect(backup).not.toContain('synthetic-refresh');
  page.on('dialog',dialog=>dialog.accept());
  await page.evaluate(()=>{state.transactions=[]});
  await page.locator('#importInput').setInputFiles({name:'synthetic-backup.json',mimeType:'application/json',buffer:Buffer.from(backup)});
  await expect.poll(()=>page.evaluate(()=>state.transactions)).toEqual(snapshot.transactions);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('kakeibo-v1')))).toEqual(snapshot);
  expect(await page.evaluate(()=>!!readStoredSyncSession())).toBe(true);
});

test('invalid backup and failed storage restore leave the previous data intact',async({page})=>{
  await open(page,baseline);page.on('dialog',dialog=>dialog.accept());
  const before=await page.evaluate(()=>deepCopy(state));
  await page.locator('#importInput').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{broken')});
  await expect.poll(()=>page.evaluate(()=>importInput.value)).toBe('');
  expect(await page.evaluate(()=>state)).toEqual(before);
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='kakeibo-v1')throw Error('synthetic quota');return original.call(this,key,value)}});
  await page.locator('#importInput').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({transactions:[],budgets:{},categories:{}}))});
  await expect.poll(()=>page.evaluate(()=>importInput.value)).toBe('');
  expect(await page.evaluate(()=>state)).toEqual(before);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('kakeibo-v1')))).toEqual(baseline);
});

test('malformed saved sessions cannot supply object or array auth tokens',async({page})=>{
  await open(page);
  expect(await page.evaluate(()=>[null,{}, {access_token:{},refresh_token:[]},{access_token:'a',refresh_token:''}].map(normalizeSyncSession))).toEqual([null,null,null,null]);
});

test('refresh rejection clears auth only and transient errors keep auth and budget data',async({page})=>{
  await open(page,baseline);
  const result=await page.evaluate(async session=>{
    syncSession=session;syncUser=session.user;persistSyncSession();
    const before=localStorage.getItem('kakeibo-v1');
    window.fetch=async()=>new Response('{}',{status:503});
    const transient=await performSyncSessionRefresh();const kept=!!readStoredSyncSession();
    window.fetch=async()=>new Response('{}',{status:401});
    const rejected=await performSyncSessionRefresh();
    return {transient,kept,rejected,session:readStoredSyncSession(),dataUnchanged:before===localStorage.getItem('kakeibo-v1')};
  },fakeSession());
  expect(result).toEqual({transient:false,kept:true,rejected:false,session:null,dataUnchanged:true});
});

test('parallel refresh requests share a single request and rotate stored tokens',async({page})=>{
  await open(page);
  const result=await page.evaluate(async session=>{
    syncSession=session;syncUser=session.user;persistSyncSession();
    let requests=0,release;window.fetch=()=>{requests++;return new Promise(r=>release=r)};
    const first=refreshSyncSession(),second=refreshSyncSession();
    while(!release)await new Promise(r=>setTimeout(r,0));
    release(new Response(JSON.stringify({...session,access_token:'rotated-access',refresh_token:'rotated-refresh'}),{status:200}));
    const values=await Promise.all([first,second]);
    return {requests,values,rotated:readStoredSyncSession()?.refresh_token==='rotated-refresh'};
  },fakeSession());
  expect(result).toEqual({requests:1,values:[true,true],rotated:true});
});

test('a late login response after logout cannot recreate a saved session',async({page})=>{
  await open(page);
  const result=await page.evaluate(async session=>{
    syncEmail.value='synthetic@example.test';syncPassword.value='synthetic-password';
    let release;window.fetch=url=>String(url).includes('grant_type=password')?new Promise(r=>release=r):Promise.resolve(new Response('{}',{status:200}));
    const pending=signInCloud();await signOutCloud();
    release(new Response(JSON.stringify(session),{status:200}));await pending;
    return {session:readStoredSyncSession(),user:syncUser};
  },fakeSession());
  expect(result).toEqual({session:null,user:null});
});

test('a late initial cloud read after logout cannot replace local data',async({page})=>{
  await open(page,baseline);
  const result=await page.evaluate(async session=>{
    syncSession=session;syncUser=session.user;persistSyncSession();
    const before=deepCopy(state),stored=localStorage.getItem('kakeibo-v1');
    let release;fetchCloudState=()=>new Promise(r=>release=r);window.fetch=async()=>new Response('{}',{status:200});
    const pending=initialCloudSync();await signOutCloud();release({state:{transactions:[],budgets:{},categories:{}},sync_version:1});await pending;
    return {same:JSON.stringify(state)===JSON.stringify(before),storedSame:localStorage.getItem('kakeibo-v1')===stored,version:syncCloudVersion===undefined};
  },fakeSession());
  expect(result).toEqual({same:true,storedSame:true,version:true});
});

test('an old user lookup failure cannot replace the newly signed-in user',async({page})=>{
  await open(page);
  const result=await page.evaluate(async session=>{
    syncSession=session;syncUser=session.user;persistSyncSession();
    let reject;window.fetch=()=>new Promise((resolve,r)=>reject=r);
    const pending=fetchSyncUser();
    syncSessionGeneration++;syncUser={id:'synthetic-next'};syncSession={...session,user:syncUser};persistSyncSession();
    reject(Error('synthetic offline'));await pending;
    return syncUser.id;
  },fakeSession());
  expect(result).toBe('synthetic-next');
});

test('manual sync keeps both sides intact when cancelled and preserves legacy payload shape when chosen',async({page})=>{
  await open(page,baseline);
  const result=await page.evaluate(async session=>{
    syncSession=session;syncUser=session.user;persistSyncSession();const before=deepCopy(state);
    fetchCloudState=async()=>({state:{transactions:[],budgets:{},categories:{}},sync_version:3});
    chooseSyncSource=async()=>null;let calls=0;updateCloudState=async(snapshot,version)=>{calls++;return {sync_version:version+1}};
    await manualCloudSync();const cancelled=JSON.stringify(state)===JSON.stringify(before)&&calls===0;
    let payload;chooseSyncSource=async()=> 'local';updateCloudState=async(snapshot,version)=>{payload=snapshot;return {sync_version:version+1}};
    await manualCloudSync();return {cancelled,payload,version:syncCloudVersion,before};
  },fakeSession());
  expect(result.cancelled).toBe(true);expect(result.payload).toEqual(result.before);expect(result.version).toBe(4);
  expect(Object.keys(result.payload).sort()).toEqual(['budgets','categories','transactions']);
});

test('cloud restore failure rolls back memory and retains local history',async({page})=>{
  await open(page,baseline);
  const result=await page.evaluate(async()=>{
    const before=JSON.stringify(state),stored=localStorage.getItem('kakeibo-v1');syncCloudVersion=3;
    const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='kakeibo-v1')throw Error('synthetic quota');return original.call(this,key,value)};
    let failed=false;try{await applyCloudState({state:{transactions:[],budgets:{},categories:{}},sync_version:5})}catch{failed=true}
    return {failed,memorySame:JSON.stringify(state)===before,storedSame:localStorage.getItem('kakeibo-v1')===stored,version:syncCloudVersion};
  });
  expect(result).toEqual({failed:true,memorySame:true,storedSame:true,version:3});
});

test('a sync choice pending during logout is cancelled without cloud or local writes',async({page})=>{
  await open(page,baseline);
  const result=await page.evaluate(async session=>{
    syncSession=session;syncUser=session.user;persistSyncSession();const before=JSON.stringify(state);
    fetchCloudState=async()=>({state:{transactions:[],budgets:{},categories:{}},sync_version:3});
    window.fetch=async()=>new Response('{}',{status:200});
    const pending=manualCloudSync();
    while(!syncChoiceResolve)await new Promise(r=>setTimeout(r,0));
    await signOutCloud();await pending;
    return {unchanged:JSON.stringify(state)===before,dialogClosed:!syncChoiceDialog.open,session:readStoredSyncSession()};
  },fakeSession());
  expect(result).toEqual({unchanged:true,dialogClosed:true,session:null});
});

test('a stored session survives reload while credentials are excluded from household backups',async({page})=>{
  await open(page);
  await page.evaluate(session=>{syncSession=session;syncUser=session.user;persistSyncSession()},fakeSession());
  await page.route('https://*.supabase.co/**',route=>{
    const url=route.request().url();
    const body=url.includes('/auth/v1/user')?{id:'synthetic-user',email:'synthetic@example.test'}:route.request().method()==='GET'?[]:[{sync_version:1}];
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.reload();
  await expect.poll(()=>page.evaluate(()=>syncUser?.id)).toBe('synthetic-user');
  const result=await page.evaluate(()=>({kept:!!readStoredSyncSession(),dataKeys:Object.keys(state).sort(),hasPassword:localStorage.getItem('kakeibo-sync-session-v1').includes('password')}));
  expect(result).toEqual({kept:true,dataKeys:['budgets','categories','transactions'],hasPassword:false});
});

test('logout in a second tab clears the first tab session without changing household data',async({page,context})=>{
  await open(page,baseline);
  await page.evaluate(session=>{syncSession=session;syncUser=session.user;persistSyncSession()},fakeSession());
  const stored=await page.evaluate(()=>localStorage.getItem('kakeibo-v1'));
  await context.route('https://*.supabase.co/**',route=>route.abort());
  const second=await context.newPage();await second.goto('/');
  await second.evaluate(()=>localStorage.removeItem('kakeibo-sync-session-v1'));
  await expect.poll(()=>page.evaluate(()=>syncSession===null&&syncUser===null)).toBe(true);
  expect(await page.evaluate(()=>localStorage.getItem('kakeibo-v1'))).toBe(stored);
  await second.close();
});


for(const width of [390,1194]){
  test(`delegated budget actions preserve monthly budgets and fire once at width ${width}`,async({page})=>{
    await page.setViewportSize({width,height:844});
    const today=new Date();
    const currentMonth=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
    const nextDate=new Date(today.getFullYear(),today.getMonth()+1,1);
    const nextMonth=`${nextDate.getFullYear()}-${String(nextDate.getMonth()+1).padStart(2,'0')}`;
    const fixture={
      transactions:baseline.transactions,
      budgets:{
        '2025-01':{fixed:{住宅ローン:63000}},
        [currentMonth]:{fixed:{住宅ローン:60000},variable:{外食:0}},
        [nextMonth]:{fixed:{住宅ローン:55000}}
      },
      categories:{}
    };
    await open(page,fixture);
    const fold=await page.evaluate(()=>{
      const original=window.toggleBudgetSection;
      window.__budgetFoldCalls=0;
      window.toggleBudgetSection=key=>{window.__budgetFoldCalls++;return original(key)};
      for(let i=0;i<5;i++){bindBudgetOverviewActions();renderBudgetOverview()}
      const header=document.querySelector('#budgetOverview [data-budget-toggle="fixed"]');
      const section=header.closest('.budget-section');
      const before=section.classList.contains('collapsed');
      header.querySelector('span').click();
      const after=section.classList.contains('collapsed');
      header.click();
      return {before,after,restored:section.classList.contains('collapsed'),calls:window.__budgetFoldCalls,inline:header.hasAttribute('onclick')};
    });
    expect(fold).toEqual({before:width===390,after:false,restored:width===390,calls:2,inline:false});
    await page.locator('#tabs [data-tab="budget"]').click();
    const priorStorage=await page.evaluate(()=>localStorage.getItem('kakeibo-v1'));
    await page.evaluate(()=>{
      window.__budgetOpenCalls=0;
      const original=window.openBudget;
      window.openBudget=(...args)=>{window.__budgetOpenCalls++;return original(...args)};
      for(let i=0;i<5;i++){bindBudgetEditorActions();renderBudgetEditor()}
    });
    const button=page.locator('#budgetEditor [data-budget-action="edit"]');
    await expect(button).not.toHaveAttribute('onclick',/.*/);
    await button.click();
    await expect(page.locator('#budgetDialog')).toBeVisible();
    expect(await page.evaluate(()=>window.__budgetOpenCalls)).toBe(1);
    expect(await page.evaluate(()=>localStorage.getItem('kakeibo-v1'))).toBe(priorStorage);
    await page.locator('#budgetDialog [data-budget-type="fixed"][data-budget-cat="住宅ローン"]').fill('77000');
    await page.locator('#budgetSave').click();
    await expect(page.locator('#budgetDialog')).not.toBeVisible();
    const after=await page.evaluate(({currentMonth,nextMonth})=>({
      history:state.budgets['2025-01'].fixed.住宅ローン,
      current:state.budgets[currentMonth].fixed.住宅ローン,
      next:state.budgets[nextMonth].fixed.住宅ローン,
      zero:state.budgets[currentMonth].variable.外食,
      transactions:deepCopy(state.transactions),
      stored:JSON.parse(localStorage.getItem('kakeibo-v1')),
      editorCalls:window.__budgetOpenCalls
    }),{currentMonth,nextMonth});
    expect(after.history).toBe(63000);
    expect(after.current).toBe(77000);
    expect(after.next).toBe(77000);
    expect(after.zero).toBe(0);
    expect(after.transactions).toEqual(baseline.transactions);
    expect(after.stored.budgets['2025-01'].fixed.住宅ローン).toBe(63000);
    expect(after.stored.budgets[currentMonth].fixed.住宅ローン).toBe(77000);
    expect(after.stored.transactions).toEqual(baseline.transactions);
    expect(after.editorCalls).toBe(1);
  });
}

test('delegated budget editor keeps data and dialog intact on storage failure',async({page})=>{
  await open(page,baseline);
  await page.locator('#tabs [data-tab="budget"]').click();
  const before=await page.evaluate(()=>({
    budgets:deepCopy(state.budgets),
    transactions:deepCopy(state.transactions),
    stored:localStorage.getItem('kakeibo-v1')
  }));
  await page.locator('#budgetEditor [data-budget-action="edit"]').click();
  await expect(page.locator('#budgetDialog')).toBeVisible();
  await page.locator('#budgetDialog [data-budget-type="fixed"][data-budget-cat="住宅ローン"]').fill('91919');
  await page.evaluate(()=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){if(key==='kakeibo-v1')throw Error('synthetic quota');return original.call(this,key,value)};
  });
  page.on('dialog',dialog=>dialog.accept());
  await page.locator('#budgetSave').click();
  await expect(page.locator('#budgetDialog')).toBeVisible();
  const after=await page.evaluate(()=>({
    budgets:deepCopy(state.budgets),
    transactions:deepCopy(state.transactions),
    stored:localStorage.getItem('kakeibo-v1')
  }));
  expect(after).toEqual(before);
});

test('strict CSP rehearsal permits delegated budget actions but blocks remaining inline handlers',async({page})=>{
  await page.addInitScript(()=>{
    window.__cspViolations=[];
    document.addEventListener('securitypolicyviolation',event=>window.__cspViolations.push(event.effectiveDirective));
  });
  await page.route('http://127.0.0.1:4173/',async route=>{
    const response=await route.fetch();
    const html=await response.text();
    await route.fulfill({response,body:html.replace('<meta charset="utf-8" />','<meta charset="utf-8" /><meta http-equiv="Content-Security-Policy" content="script-src \'self\'; script-src-attr \'none\'; object-src \'none\'">')});
  });
  await page.goto('/');
  await page.locator('#tabs [data-tab="budget"]').click();
  await expect(page.locator('section[data-panel="budget"]')).toHaveClass(/active/);
  const foldCalls=await page.evaluate(()=>{
    let calls=0;const original=window.toggleBudgetSection;
    window.toggleBudgetSection=key=>{calls++;return original(key)};
    document.querySelector('#budgetOverview [data-budget-toggle="variable"]').click();
    return calls
  });
  expect(foldCalls).toBe(1);
  await page.locator('#budgetEditor [data-budget-action="edit"]').click();
  await expect(page.locator('#budgetDialog')).toBeVisible();
  await page.locator('#budgetCancel').click();
  await page.locator('#tabs [data-tab="expense"]').click();
  const filterBefore=await page.evaluate(()=>expenseHistoryFilter);
  await page.locator('#expenseHistoryFilters button').nth(1).click();
  expect(await page.evaluate(()=>expenseHistoryFilter)).toBe(filterBefore);
  await expect.poll(()=>page.evaluate(()=>window.__cspViolations.includes('script-src-attr'))).toBe(true);
  const dialogs=[];
  page.on('dialog',async dialog=>{dialogs.push(dialog.type());await dialog.dismiss()});
  await page.locator('#itemList .edit-item').first().click();
  expect(dialogs).toEqual(['prompt']);
});

for(const operation of ['initial-read','upload']){
  test(`same-user token rotation in another tab preserves an in-flight ${operation}`,async({page})=>{
    await open(page,baseline);
    const result=await page.evaluate(async({session,operation})=>{
      syncSession=session;syncUser=session.user;persistSyncSession();syncCloudVersion=undefined;
      let release,writes=0;fetchCloudState=()=>new Promise(resolve=>release=resolve);
      insertCloudState=async()=>{writes++;return {sync_version:1}};
      chooseSyncSource=async()=> 'cloud';
      const pending=operation==='upload'?uploadCloudState():initialCloudSync();
      const rotated={...session,access_token:'rotated-access',refresh_token:'rotated-refresh'};
      const serialized=JSON.stringify(rotated);localStorage.setItem(SYNC_SESSION_KEY,serialized);
      window.dispatchEvent(new StorageEvent('storage',{key:SYNC_SESSION_KEY,newValue:serialized}));
      const cloud=operation==='upload'?null:{state:{transactions:[{id:'rotated-cloud',date:'2025-01-02',type:'income',category:'給与',amount:333}],budgets:{},categories:{}},sync_version:3};
      release(cloud);const ok=await pending;
      return {ok:operation==='upload'?ok:true,writes,version:syncCloudVersion,status:syncStatusTitle.textContent,amount:state.transactions[0].amount,user:syncUser.id,rotated:readStoredSyncSession().access_token==='rotated-access'};
    },{session:fakeSession(),operation});
    expect(result).toEqual({ok:true,writes:operation==='upload'?1:0,version:operation==='upload'?1:3,status:'同期済み',amount:operation==='upload'?250000:333,user:'synthetic-user',rotated:true});
  });
}

test('a pending upload is cancelled at an account boundary without replacing local history',async({page})=>{
  await open(page,baseline);
  const result=await page.evaluate(async session=>{
    syncSession=session;syncUser=session.user;persistSyncSession();syncCloudVersion=undefined;
    const before=JSON.stringify(state);let release,writes=0;fetchCloudState=()=>new Promise(r=>release=r);insertCloudState=async()=>{writes++;return {sync_version:1}};
    const pending=uploadCloudState();const next={...session,user:{id:'synthetic-next',email:'next@example.test'}};
    const serialized=JSON.stringify(next);localStorage.setItem(SYNC_SESSION_KEY,serialized);
    window.dispatchEvent(new StorageEvent('storage',{key:SYNC_SESSION_KEY,newValue:serialized}));
    release(null);const ok=await pending;
    return {ok,writes,user:syncUser.id,unchanged:JSON.stringify(state)===before,status:syncStatusTitle.textContent};
  },fakeSession());
  expect(result).toEqual({ok:false,writes:0,user:'synthetic-next',unchanged:true,status:'同期の確認が必要'});
});

test('401 after same-user token rotation retries with the current token without refreshing it again',async({page})=>{
  await open(page);
  const result=await page.evaluate(async session=>{
    syncSession=session;syncUser=session.user;persistSyncSession();const used=[];let refreshes=0;
    window.fetch=async(url,options)=>{
      if(String(url).includes('grant_type=refresh_token')){refreshes++;throw Error('unexpected refresh')}
      used.push(options.headers.Authorization);
      if(used.length===1){
        const rotated={...session,access_token:'rotated-access',refresh_token:'rotated-refresh'};const serialized=JSON.stringify(rotated);localStorage.setItem(SYNC_SESSION_KEY,serialized);
        window.dispatchEvent(new StorageEvent('storage',{key:SYNC_SESSION_KEY,newValue:serialized}));
        return new Response('{}',{status:401});
      }
      return new Response('[]',{status:200});
    };
    const response=await supabaseFetch('/rest/v1/kakeibo_user_state',{method:'GET'});
    return {status:response.status,used,refreshes};
  },fakeSession());
  expect(result).toEqual({status:200,used:['Bearer synthetic-access','Bearer rotated-access'],refreshes:0});
});

test('a token rotated during a pending refresh is retained and retries the original 401 request',async({page})=>{
  await open(page);
  const result=await page.evaluate(async session=>{
    syncSession=session;syncUser=session.user;persistSyncSession();const used=[];
    window.fetch=async(url,options)=>{
      if(String(url).includes('grant_type=refresh_token')){
        const rotated={...session,access_token:'rotated-access',refresh_token:'rotated-refresh'};const serialized=JSON.stringify(rotated);localStorage.setItem(SYNC_SESSION_KEY,serialized);
        window.dispatchEvent(new StorageEvent('storage',{key:SYNC_SESSION_KEY,newValue:serialized}));
        return new Response('{}',{status:401});
      }
      used.push(options.headers.Authorization);return new Response(used.length===1?'{}':'[]',{status:used.length===1?401:200});
    };
    const response=await supabaseFetch('/rest/v1/kakeibo_user_state',{method:'GET'});
    return {status:response.status,used,retained:readStoredSyncSession()?.refresh_token==='rotated-refresh',user:syncUser?.id};
  },fakeSession());
  expect(result).toEqual({status:200,used:['Bearer synthetic-access','Bearer rotated-access'],retained:true,user:'synthetic-user'});
});

const dailyId=`合成'"<>&%/\\取引`;
async function openDailyFixture(page,strict=false){
  if(strict){
    await page.addInitScript(()=>{
      window.__dailyCspViolations=[];
      document.addEventListener('securitypolicyviolation',e=>window.__dailyCspViolations.push(e.effectiveDirective));
    });
    await page.route('http://127.0.0.1:4173/',async route=>{
      const response=await route.fetch();
      await route.fulfill({response,body:(await response.text()).replace('<meta charset="utf-8" />',`<meta charset="utf-8" /><meta http-equiv="Content-Security-Policy" content="script-src 'self'; script-src-attr 'none'; object-src 'none'">`)});
    });
  }
  await open(page,{
    transactions:[
      {id:dailyId,date:'2025-01-07',type:'variable',category:'外食',item:'<img src=x onerror="window.__dailyXss=true">',amount:120,amountExpression:'120',memo:'合成'},
      {id:'daily-second',date:'2025-01-07',type:'variable',category:'外食',amount:80},
      {id:'other-date',date:'2025-01-08',type:'variable',category:'外食',amount:900},
      {id:'other-category',date:'2025-01-07',type:'variable',category:'その他',amount:700},
      {id:'other-type',date:'2025-01-07',type:'income',category:'給与',amount:3000}
    ],budgets:baseline.budgets,categories:{variable:['外食','その他'],income:['給与']}
  });
  await page.evaluate(()=>{
    current=new Date(2025,0,1);mobileDailyDate=new Date(2025,0,7);
    render();showPanel('expense');
    openDailyHistoryFor('variable',encodeArg('外食'));
  });
}
for(const strict of [false,true]){
  test(`daily delegated edit/delete preserves unrelated data and totals (strict CSP: ${strict})`,async({page})=>{
    await openDailyFixture(page,strict);
    const before=await page.evaluate(()=>deepCopy(state));
    await page.evaluate(()=>{
      window.__dailyCalls={edit:0,delete:0};
      const edit=window.editDailyHistoryEntry,remove=window.deleteDailyHistoryEntry;
      window.editDailyHistoryEntry=id=>{window.__dailyCalls.edit++;return edit(id)};
      window.deleteDailyHistoryEntry=id=>{window.__dailyCalls.delete++;return remove(id)};
      for(let i=0;i<5;i++){bindDailyHistoryActions();renderDailyHistory()}
    });
    const edit=page.locator('#dailyHistoryList [data-daily-history-action="edit"]').first();
    await expect(edit).not.toHaveAttribute('onclick',/.*/);
    await expect(edit).toHaveAttribute('data-daily-history-id',encodeURIComponent(dailyId).replace(/'/g,'%27'));
    await expect(page.locator('#dailyHistoryList img')).toHaveCount(0);
    await edit.click();
    await expect(page.locator('#dailyEntryDialog')).toBeVisible();
    await expect(page.locator('#dailyHistoryDialog')).not.toBeVisible();
    await expect(page.locator('#dailyEntryAmount')).toHaveValue('120');
    await page.locator('#dailyEntryAmount').fill('200+50');
    await page.locator('#dailyEntrySave').click();
    await expect(page.locator('#dailyHistoryDialog')).toBeVisible();
    const edited=await page.evaluate(()=>deepCopy(state));
    expect(edited.transactions[0]).toEqual({...before.transactions[0],amount:250,amountExpression:'200+50'});
    expect(edited.transactions.slice(1)).toEqual(before.transactions.slice(1));
    expect(edited.budgets).toEqual(before.budgets);expect(edited.categories).toEqual(before.categories);
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('kakeibo-v1')))).toEqual(edited);
    expect(await page.evaluate(()=>expenseDayTotal.textContent)).toBe('¥1,030');
    await page.evaluate(()=>{renderDailyHistory();bindDailyHistoryActions()});
    let confirmations=0;
    page.on('dialog',async d=>{expect(d.type()).toBe('confirm');confirmations++;await d.accept()});
    await page.locator('#dailyHistoryList [data-daily-history-action="delete"]').first().click();
    await expect(page.locator('#dailyHistoryList .daily-history-row')).toHaveCount(1);
    const deleted=await page.evaluate(()=>deepCopy(state));
    expect(deleted).toEqual({...edited,transactions:edited.transactions.slice(1)});
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('kakeibo-v1')))).toEqual(deleted);
    expect(await page.evaluate(()=>expenseDayTotal.textContent)).toBe('¥780');
    expect(confirmations).toBe(1);
    expect(await page.evaluate(()=>window.__dailyCalls)).toEqual({edit:1,delete:1});
    expect(await page.evaluate(()=>window.__dailyXss||false)).toBe(false);
    if(strict)expect(await page.evaluate(()=>window.__dailyCspViolations)).toEqual([]);
  });
}
for(const action of ['edit','delete']){
  test(`daily delegated ${action} storage failure rolls back memory and storage`,async({page})=>{
    await openDailyFixture(page);
    const before=await page.evaluate(()=>({state:deepCopy(state),stored:localStorage.getItem('kakeibo-v1')}));
    await page.evaluate(()=>{
      const original=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){if(key==='kakeibo-v1')throw Error('synthetic quota');return original.call(this,key,value)};
    });
    const dialogs=[];
    page.on('dialog',async d=>{dialogs.push(d.type());await d.accept()});
    await page.locator(`#dailyHistoryList [data-daily-history-action="${action}"]`).first().click();
    if(action==='edit'){
      await page.locator('#dailyEntryAmount').fill('999');
      await page.locator('#dailyEntrySave').click();
      await expect(page.locator('#dailyEntryDialog')).toBeVisible();
    }else await expect(page.locator('#dailyHistoryList .daily-history-row')).toHaveCount(2);
    expect(await page.evaluate(()=>({state:deepCopy(state),stored:localStorage.getItem('kakeibo-v1')}))).toEqual(before);
    expect(dialogs).toEqual(action==='edit'?['alert']:['confirm','alert']);
  });
}
