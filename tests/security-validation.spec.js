const {test,expect}=require('@playwright/test');
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
    const handler=await page.locator('#itemList .edit-item').first().getAttribute('onclick');
    expect(handler).toBe(`editItem('variable','${encodeURIComponent(payload).replace(/'/g,'%27')}')`);
    expect(handler).toContain('%27');
  });
}

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

test('strict CSP rehearsal exposes blocked HTML handlers while external scripts and navigation work',async({page})=>{
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
  await page.locator('#budgetEditor button').click();
  await expect(page.locator('#budgetDialog')).not.toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.__cspViolations.includes('script-src-attr'))).toBe(true);
});
