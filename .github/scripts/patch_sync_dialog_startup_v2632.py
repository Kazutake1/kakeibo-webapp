from pathlib import Path

# v2.6.32: bind sync dialog controls before any startup cloud sync can open the dialog.

app = Path('app.js')
s = app.read_text(encoding='utf-8')
old = '''async function initCloudSync(){
  loadSyncSession();
  if(syncSession){syncUser=await fetchSyncUser();updateSyncUI();if(syncUser)await initialCloudSync()}else updateSyncUI();
  const a=document.getElementById('syncSignInBtn'),b=document.getElementById('syncSignUpBtn'),c=document.getElementById('syncSignOutBtn'),d=document.getElementById('syncNowBtn');
  if(a)a.onclick=signInCloud;if(b)b.onclick=signUpCloud;if(c)c.onclick=signOutCloud;if(d)d.onclick=manualCloudSync;
  const dialog=document.getElementById('syncChoiceDialog');
  const cloudBtn=document.getElementById('syncUseCloudBtn');
  const localBtn=document.getElementById('syncUseLocalBtn');
  if(cloudBtn)cloudBtn.onclick=()=>finishSyncChoice('cloud');
  if(localBtn)localBtn.onclick=()=>finishSyncChoice('local');
  if(dialog)dialog.addEventListener('cancel',e=>{e.preventDefault();finishSyncChoice(null)})
}
'''
new = '''async function initCloudSync(){
  // Bind every sync control before awaiting session restoration / initial sync.
  // Otherwise an existing session can open syncChoiceDialog while its buttons still have no handlers.
  const a=document.getElementById('syncSignInBtn'),b=document.getElementById('syncSignUpBtn'),c=document.getElementById('syncSignOutBtn'),d=document.getElementById('syncNowBtn');
  if(a)a.onclick=signInCloud;if(b)b.onclick=signUpCloud;if(c)c.onclick=signOutCloud;if(d)d.onclick=manualCloudSync;
  const dialog=document.getElementById('syncChoiceDialog');
  const cloudBtn=document.getElementById('syncUseCloudBtn');
  const localBtn=document.getElementById('syncUseLocalBtn');
  if(cloudBtn)cloudBtn.onclick=()=>finishSyncChoice('cloud');
  if(localBtn)localBtn.onclick=()=>finishSyncChoice('local');
  if(dialog)dialog.addEventListener('cancel',e=>{e.preventDefault();finishSyncChoice(null)});

  loadSyncSession();
  if(syncSession){syncUser=await fetchSyncUser();updateSyncUI();if(syncUser)await initialCloudSync()}else updateSyncUI();
}
'''
assert old in s, 'expected v2.6.31 initCloudSync block not found'
s = s.replace(old, new, 1)
app.write_text(s, encoding='utf-8')

index = Path('index.html')
s = index.read_text(encoding='utf-8')
assert 'style.css?v=2.6.31' in s and 'app.js?v=2.6.31' in s, 'v2.6.31 asset refs not found'
assert 'v2.6.31 Stable' in s, 'v2.6.31 version label not found'
s = s.replace('style.css?v=2.6.31', 'style.css?v=2.6.32', 1)
s = s.replace('app.js?v=2.6.31', 'app.js?v=2.6.32', 1)
s = s.replace('v2.6.31 Stable', 'v2.6.32 Stable')
index.write_text(s, encoding='utf-8')

sw = Path('sw.js')
s = sw.read_text(encoding='utf-8')
assert "kakeibo-v2.6.31-stable" in s, 'v2.6.31 cache name not found'
assert "./style.css?v=2.6.31" in s and "./app.js?v=2.6.31" in s, 'v2.6.31 APP_SHELL refs not found'
s = s.replace("kakeibo-v2.6.31-stable", "kakeibo-v2.6.32-stable", 1)
s = s.replace("./style.css?v=2.6.31", "./style.css?v=2.6.32", 1)
s = s.replace("./app.js?v=2.6.31", "./app.js?v=2.6.32", 1)
sw.write_text(s, encoding='utf-8')

readme = Path('README.md')
s = readme.read_text(encoding='utf-8')
assert s.startswith('# 家計簿Webアプリ v2.6.31 Stable'), 'README version heading unexpected'
marker = '## v2.6.31 Stable\n'
pos = s.find(marker)
assert pos != -1, 'v2.6.31 release section not found'
release = '''# 家計簿Webアプリ v2.6.32 Stable

Excel家計簿をベースにした iPhone / iPad / Mac 対応のレスポンシブPWAです。

## v2.6.32 Stable
- 既にログイン済みの状態で起動した際、同期選択ダイアログがボタン登録前に開いて操作不能になる不具合を修正
- 同期ダイアログを含む操作ボタンのイベント登録を、セッション復元・初回クラウド同期より先に実行するよう変更
- 同期方向・保存データ・その他の機能仕様は変更なし

'''
s = release + s[pos:]
readme.write_text(s, encoding='utf-8')

test = Path('tests/ui-regression.spec.js')
s = test.read_text(encoding='utf-8')
s = s.replace('release assets use v2.6.31 cache-busting URLs', 'release assets use v2.6.32 cache-busting URLs')
s = s.replace('style.css?v=2.6.31', 'style.css?v=2.6.32')
s = s.replace('app.js?v=2.6.31', 'app.js?v=2.6.32')
name = "existing signed-in session can use sync choice dialog during startup"
if name not in s:
    s += r'''


test('existing signed-in session can use sync choice dialog during startup', async ({ page }) => {
  await openApp(page);
  const date=currentDateKey();
  await page.evaluate(({date})=>{
    document.getElementById('syncUseCloudBtn').onclick=null;
    document.getElementById('syncUseLocalBtn').onclick=null;
    state.transactions=[{id:'local-startup',date,type:'variable',category:'セブンイレブン',item:'local',amount:100,amountExpression:'100',memo:''}];
    localStorage.setItem('kakeibo-v1',JSON.stringify(state));
    localStorage.setItem('kakeibo-sync-session-v1',JSON.stringify({access_token:'test-access',refresh_token:'test-refresh'}));
    fetchSyncUser=async()=>{
      syncUser={id:'startup-sync-user',email:'test@example.com'};
      return syncUser;
    };
    fetchCloudState=async()=>({state:{transactions:[],budgets:{},categories:{}},updated_at:'2026-09-06T00:00:00Z'});
    window.__startupSyncInit=initCloudSync();
  },{date});

  const dialog=page.locator('#syncChoiceDialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('#syncUseCloudBtn').click();
  await expect(dialog).not.toBeVisible();
  await page.evaluate(()=>window.__startupSyncInit);
  await expect(page.locator('#syncStatusTitle')).toHaveText('同期済み');
  await expect(page.locator('#syncStatusDetail')).toHaveText('クラウドのデータを読み込みました');
});
'''
    test.write_text(s, encoding='utf-8')
