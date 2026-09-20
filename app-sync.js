// Supabase authentication and cloud synchronization.
const SUPABASE_URL='https://blyyxmhehubufqzyqapq.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_DB6exzL5oiIQ3e30r6nqmw_FC14UaM4';
const SYNC_SESSION_KEY='kakeibo-sync-session-v1';
const SYNC_REFRESH_MARGIN_MS=60*1000;
const SYNC_REFRESH_RETRY_MS=30*1000;
let syncSession=null;
let syncUser=null;
let syncSaveTimer=null;
let syncRefreshTimer=null;
let syncRefreshPromise=null;
let syncBusy=false;
let syncPending=false;
let syncCloudVersion;
let suppressCloudSync=false;
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
  if(!signedIn){
    if(syncSession)setSyncStatus('busy','ログイン確認中','通信が戻ると自動的に確認します');
    else setSyncStatus('','未ログイン','この端末内だけに保存されています')
  }
}
function normalizeSyncSession(session){
  if(!session?.access_token||!session?.refresh_token)return null;
  const normalized={...session};
  if(!Number.isFinite(Number(normalized.expires_at))&&Number.isFinite(Number(normalized.expires_in)))normalized.expires_at=Math.floor(Date.now()/1000)+Number(normalized.expires_in);
  return normalized
}
function readStoredSyncSession(){
  try{return normalizeSyncSession(JSON.parse(localStorage.getItem(SYNC_SESSION_KEY)||'null'))}catch{return null}
}
function persistSyncSession(){
  try{
    if(syncSession)localStorage.setItem(SYNC_SESSION_KEY,JSON.stringify(syncSession));
    else localStorage.removeItem(SYNC_SESSION_KEY);
    return true
  }catch(e){console.error('ログイン情報を端末へ保存できませんでした',e);return false}
}
function clearSyncRefreshTimer(){clearTimeout(syncRefreshTimer);syncRefreshTimer=null}
function sessionExpiresSoon(session=syncSession,marginMs=SYNC_REFRESH_MARGIN_MS){
  const expiresAt=Number(session?.expires_at)*1000;
  return !Number.isFinite(expiresAt)||expiresAt-Date.now()<=marginMs
}
function scheduleSyncRefresh(delayMs){
  clearSyncRefreshTimer();
  if(!syncSession?.refresh_token)return;
  const expiresAt=Number(syncSession.expires_at)*1000;
  const delay=Number.isFinite(delayMs)?delayMs:Number.isFinite(expiresAt)?Math.max(0,expiresAt-Date.now()-SYNC_REFRESH_MARGIN_MS):SYNC_REFRESH_RETRY_MS;
  syncRefreshTimer=setTimeout(()=>refreshSyncSession(),delay)
}
function loadSyncSession(){
  const stored=readStoredSyncSession();
  if(!stored)return;
  syncSession=stored;
  if(stored.user)syncUser=stored.user;
  scheduleSyncRefresh()
}
function invalidateSyncSession(){
  clearSyncRefreshTimer();syncSession=null;syncUser=null;persistSyncSession();updateSyncUI()
}
async function performSyncSessionRefresh(){
  if(!syncSession?.refresh_token)return false;
  try{
    const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:syncHeaders(false),body:JSON.stringify({refresh_token:syncSession.refresh_token})});
    if(!r.ok){
      if([400,401,403].includes(r.status))invalidateSyncSession();
      else{scheduleSyncRefresh(SYNC_REFRESH_RETRY_MS);setSyncStatus('err','接続待ち','ログイン状態を保持したまま再接続します')}
      return false
    }
    const refreshed=normalizeSyncSession(await r.json());
    if(!refreshed){invalidateSyncSession();return false}
    const refreshedUser=refreshed.user||syncUser||syncSession.user||null;
    syncSession=refreshedUser?{...refreshed,user:refreshedUser}:refreshed;
    if(refreshedUser)syncUser=refreshedUser;
    if(!persistSyncSession())setSyncStatus('err','保存エラー','端末のパスワード・ストレージ設定を確認してください');
    scheduleSyncRefresh();updateSyncUI();return true
  }catch(e){
    console.error(e);scheduleSyncRefresh(SYNC_REFRESH_RETRY_MS);setSyncStatus('err','接続待ち','ログイン状態を保持したまま再接続します');return false
  }
}
async function refreshSyncSession(){
  if(!syncSession?.refresh_token)return false;
  if(syncRefreshPromise)return syncRefreshPromise;
  const refreshToken=syncSession.refresh_token;
  const refresh=async()=>{
    const stored=readStoredSyncSession();
    if(stored&&stored.refresh_token!==refreshToken){
      syncSession=stored;if(stored.user)syncUser=stored.user;scheduleSyncRefresh();updateSyncUI();return true
    }
    return performSyncSessionRefresh()
  };
  syncRefreshPromise=(async()=>{
    if(navigator.locks?.request)return navigator.locks.request('kakeibo-session-refresh',refresh);
    return refresh()
  })();
  try{return await syncRefreshPromise}finally{syncRefreshPromise=null}
}
async function supabaseFetch(path,options={},retry=true){
  if(!syncSession?.access_token)throw new Error('not signed in');
  const doFetch=()=>fetch(SUPABASE_URL+path,{...options,headers:{...syncHeaders(true),...(options.headers||{})}});
  let r=await doFetch();if(r.status===401&&retry&&await refreshSyncSession())r=await doFetch();return r
}
async function fetchSyncUser(){
  if(!syncSession?.access_token)return null;
  const cachedUser=syncUser||syncSession.user||null;
  try{
    let r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:syncHeaders(true)});
    if(r.status===401&&await refreshSyncSession())r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:syncHeaders(true)});
    if(!r.ok)throw new Error('user fetch failed');
    syncUser=await r.json();syncSession={...syncSession,user:syncUser};persistSyncSession();return syncUser
  }catch(e){
    console.error(e);
    if(syncSession){syncUser=cachedUser;setSyncStatus('err','接続待ち','ログイン状態を保持したまま再接続します')}
    else syncUser=null;
    return syncUser
  }
}
function hasMeaningfulLocalData(){
  if(Array.isArray(state?.transactions)&&state.transactions.length>0)return true;
  for(const type of TYPES){
    const currentCategories=catsFor(type.key);
    const defaultCategories=DEFAULT_CATS[type.key]||[];
    if(currentCategories.length!==defaultCategories.length||currentCategories.some((category,index)=>category!==defaultCategories[index]))return true
  }
  for(const month of Object.values(state?.budgets||{})){
    if(!month||typeof month!=='object')continue;
    for(const type of TYPES){
      const values=month[type.key]||{};
      for(const category of catsFor(type.key)){
        if(finiteMoney(values[category])!==finiteMoney(DEFAULT_BUDGET[type.key]?.[category]))return true
      }
    }
  }
  return false
}
function cloudVersion(row){const version=Number(row?.sync_version);return Number.isSafeInteger(version)&&version>=1?version:null}
function rememberCloudRow(row){const version=cloudVersion(row);if(version!==null)syncCloudVersion=version;return version}
async function fetchCloudState(){
  const r=await supabaseFetch(`/rest/v1/kakeibo_user_state?select=state,updated_at,sync_version&user_id=eq.${encodeURIComponent(syncUser.id)}&limit=1`,{method:'GET',headers:{Accept:'application/json'}});
  if(!r.ok)throw new Error(`cloud read ${r.status}`);const rows=await r.json();return rows[0]||null
}
async function insertCloudState(snapshot){
  const r=await supabaseFetch('/rest/v1/kakeibo_user_state',{method:'POST',headers:{Prefer:'return=representation',Accept:'application/json'},body:JSON.stringify({user_id:syncUser.id,state:snapshot,sync_version:1})});
  if(r.status===409)return null;
  if(!r.ok)throw new Error(`cloud insert ${r.status}`);
  const rows=await r.json();return rows[0]||null
}
async function updateCloudState(snapshot,expectedVersion){
  const nextVersion=expectedVersion+1;
  const path=`/rest/v1/kakeibo_user_state?user_id=eq.${encodeURIComponent(syncUser.id)}&sync_version=eq.${expectedVersion}`;
  const r=await supabaseFetch(path,{method:'PATCH',headers:{Prefer:'return=representation',Accept:'application/json'},body:JSON.stringify({state:snapshot,sync_version:nextVersion})});
  if(!r.ok)throw new Error(`cloud update ${r.status}`);
  const rows=await r.json();return rows[0]||null
}
async function resolveCloudConflict(latest){
  const latestVersion=cloudVersion(latest);
  if(!latest||latestVersion===null)throw new Error('cloud conflict read failed');
  const choice=await chooseSyncSource('別の端末でクラウドデータが更新されています。残したいデータを選んでください。');
  syncPending=false;
  if(choice==='cloud'){
    await applyCloudState(latest);setSyncStatus('ok','同期済み','別の端末の最新データを読み込みました');return true
  }
  if(choice==='local'){
    const saved=await updateCloudState(deepCopy(state),latestVersion);
    if(!saved){syncCloudVersion=undefined;setSyncStatus('err','同期の確認が必要','同期中に別の端末で再更新されました。「今すぐ同期」を押してください');return false}
    rememberCloudRow(saved);setSyncStatus('ok','同期済み',`最終同期 ${new Date().toLocaleString('ja-JP')}`);return true
  }
  syncCloudVersion=undefined;setSyncStatus('','同期を中止しました','端末とクラウドのデータは変更されていません');return false
}
async function uploadCloudState(){
  if(!syncUser)return false;
  if(syncBusy){syncPending=true;return false}
  syncBusy=true;setSyncStatus('busy','同期中','クラウドへ保存しています…');
  try{
    if(syncCloudVersion===undefined){
      const latest=await fetchCloudState();
      if(latest)return await resolveCloudConflict(latest);
      syncCloudVersion=0
    }
    const snapshot=deepCopy(state);
    const saved=syncCloudVersion===0?await insertCloudState(snapshot):await updateCloudState(snapshot,syncCloudVersion);
    if(!saved){
      const latest=await fetchCloudState();
      return await resolveCloudConflict(latest)
    }
    rememberCloudRow(saved);setSyncStatus('ok','同期済み',`最終同期 ${new Date().toLocaleString('ja-JP')}`);return true
  }catch(e){console.error(e);setSyncStatus('err','同期エラー','通信状況を確認して「今すぐ同期」を押してください');return false}
  finally{
    syncBusy=false;
    if(syncPending){syncPending=false;scheduleCloudSync()}
  }
}
function scheduleCloudSync(){if(!syncUser)return;clearTimeout(syncSaveTimer);syncSaveTimer=setTimeout(()=>uploadCloudState(),700)}
async function applyCloudState(row){
  if(!row?.state)return false;suppressCloudSync=true;
  try{rememberCloudRow(row);state=normalizeState(row.state);localStorage.setItem('kakeibo-v1',JSON.stringify(state));render();return true}
  finally{suppressCloudSync=false}
}
let syncChoiceResolve=null;
function finishSyncChoice(choice){
  const dialog=document.getElementById('syncChoiceDialog');
  const resolve=syncChoiceResolve;
  syncChoiceResolve=null;
  if(dialog?.open)dialog.close();
  if(resolve)resolve(choice)
}
function chooseSyncSource(message='この端末とクラウドの両方に家計簿データがあります。残したいデータを選んでください。'){
  const dialog=document.getElementById('syncChoiceDialog');
  const text=document.getElementById('syncChoiceMessage');
  if(!dialog)return Promise.resolve(null);
  if(text)text.textContent=message;
  if(syncChoiceResolve)finishSyncChoice(null);
  return new Promise(resolve=>{
    syncChoiceResolve=resolve;
    dialog.showModal();
    document.getElementById('syncUseCloudBtn')?.focus()
  })
}
async function initialCloudSync(){
  if(!syncUser)return;setSyncStatus('busy','同期中','クラウドデータを確認しています…');
  try{
    const cloud=await fetchCloudState();
    if(!cloud){syncCloudVersion=0;await uploadCloudState();return}
    if(cloudVersion(cloud)===null)throw new Error('cloud version missing');
    if(hasMeaningfulLocalData()){
      const choice=await chooseSyncSource('この端末とクラウドの両方に家計簿データがあります。残したいデータを選んでください。');
      if(choice==='cloud'){
        await applyCloudState(cloud);setSyncStatus('ok','同期済み','クラウドのデータを読み込みました')
      }else if(choice==='local'){
        rememberCloudRow(cloud);await uploadCloudState()
      }else{
        syncCloudVersion=undefined;setSyncStatus('','同期を中止しました','データは変更されていません')
      }
    }else{await applyCloudState(cloud);setSyncStatus('ok','同期済み','クラウドのデータを読み込みました')}
  }catch(e){console.error(e);setSyncStatus('err','同期エラー','クラウドデータを取得できませんでした')}
}
async function signInCloud(){
  const email=syncEmail.value.trim(),password=syncPassword.value;if(!email||!password){alert('メールアドレスとパスワードを入力してください');return}
  syncCloudVersion=undefined;syncPending=false;
  setSyncStatus('busy','ログイン中','認証しています…');
  try{
    const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:syncHeaders(false),body:JSON.stringify({email,password})});
    const data=await r.json();if(!r.ok)throw new Error(data?.msg||data?.error_description||'ログインできませんでした');
    syncSession=normalizeSyncSession(data);syncUser=data.user||null;
    if(!persistSyncSession()){syncSession=null;syncUser=null;throw new Error('ログイン情報をこの端末に保存できませんでした')}
    scheduleSyncRefresh();syncUser=await fetchSyncUser();if(!syncUser)throw new Error('ユーザー情報を取得できませんでした');
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
    if(data.access_token){syncSession=normalizeSyncSession(data);syncUser=data.user||null;if(!persistSyncSession()){syncSession=null;syncUser=null;throw new Error('ログイン情報をこの端末に保存できませんでした')}scheduleSyncRefresh();syncUser=await fetchSyncUser();updateSyncUI();await initialCloudSync()}
    else setSyncStatus('ok','確認メールを送信しました','メール内の確認リンクを開いたあと、この画面からログインしてください')
  }catch(e){setSyncStatus('err','登録失敗',e.message||'登録できませんでした')}
}
async function signOutCloud(){
  try{if(syncSession?.access_token)await fetch(`${SUPABASE_URL}/auth/v1/logout`,{method:'POST',headers:syncHeaders(true)})}catch{}
  clearTimeout(syncSaveTimer);syncSaveTimer=null;clearSyncRefreshTimer();syncPending=false;syncCloudVersion=undefined;
  syncSession=null;syncUser=null;persistSyncSession();updateSyncUI()
}
async function manualCloudSync(){
  if(!syncUser){alert('先にログインしてください');return}
  try{
    const cloud=await fetchCloudState();if(!cloud){syncCloudVersion=0;await uploadCloudState();return}
    if(cloudVersion(cloud)===null)throw new Error('cloud version missing');
    const choice=await chooseSyncSource('どちらのデータを最新データとして使用するか選んでください。');
    if(choice==='cloud'){
      await applyCloudState(cloud);setSyncStatus('ok','同期済み','クラウドのデータを読み込みました')
    }else if(choice==='local'){
      rememberCloudRow(cloud);await uploadCloudState()
    }else{
      setSyncStatus('','同期を中止しました','データは変更されていません')
    }
  }catch(e){console.error(e);setSyncStatus('err','同期エラー','同期できませんでした')}
}
async function initCloudSync(){
  // Bind every sync control before awaiting session restoration / initial sync.
  // Otherwise an existing session can open syncChoiceDialog while its buttons still have no handlers.
  const form=document.getElementById('syncSignedOut'),b=document.getElementById('syncSignUpBtn'),c=document.getElementById('syncSignOutBtn'),d=document.getElementById('syncNowBtn');
  if(form)form.addEventListener('submit',e=>{e.preventDefault();signInCloud()});if(b)b.onclick=signUpCloud;if(c)c.onclick=signOutCloud;if(d)d.onclick=manualCloudSync;
  const dialog=document.getElementById('syncChoiceDialog');
  const cloudBtn=document.getElementById('syncUseCloudBtn');
  const localBtn=document.getElementById('syncUseLocalBtn');
  if(cloudBtn)cloudBtn.onclick=()=>finishSyncChoice('cloud');
  if(localBtn)localBtn.onclick=()=>finishSyncChoice('local');
  if(dialog)dialog.addEventListener('cancel',e=>{e.preventDefault();finishSyncChoice(null)});

  loadSyncSession();
  if(syncSession){syncUser=await fetchSyncUser();updateSyncUI();if(syncUser)await initialCloudSync()}else updateSyncUI();

  window.addEventListener('online',()=>{if(syncSession&&sessionExpiresSoon())refreshSyncSession()});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&syncSession&&sessionExpiresSoon())refreshSyncSession()});
  window.addEventListener('storage',event=>{
    if(event.key!==SYNC_SESSION_KEY)return;
    if(!event.newValue){clearSyncRefreshTimer();syncSession=null;syncUser=null;updateSyncUI();return}
    const stored=readStoredSyncSession();
    if(!stored)return;
    syncSession=stored;syncUser=stored.user||syncUser;scheduleSyncRefresh();updateSyncUI()
  })
}
