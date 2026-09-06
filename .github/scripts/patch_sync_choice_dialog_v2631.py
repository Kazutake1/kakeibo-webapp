from pathlib import Path

# v2.6.31: replace browser confirm prompts for cloud sync direction with a dedicated two-choice dialog.

index = Path('index.html')
s = index.read_text(encoding='utf-8')
assert 'style.css?v=2.6.30' in s, 'expected v2.6.30 stylesheet reference not found'
assert 'app.js?v=2.6.30' in s, 'expected v2.6.30 app reference not found'
assert 'v2.6.30 Stable' in s, 'expected v2.6.30 version label not found'

sync_dialog = '''\n<dialog id="syncChoiceDialog" class="sync-choice-dialog" aria-labelledby="syncChoiceTitle" aria-describedby="syncChoiceMessage">
  <div class="sync-choice-shell">
    <div class="sync-choice-head">
      <span class="sync-choice-kicker">クラウド同期</span>
      <div class="dialog-head" id="syncChoiceTitle">同期するデータを選んでください</div>
    </div>
    <div class="sync-choice-body">
      <p id="syncChoiceMessage" class="sync-choice-message">この端末とクラウドの両方に家計簿データがあります。残したいデータを選んでください。</p>
      <div class="sync-choice-options">
        <button type="button" class="sync-choice-option sync-choice-cloud" id="syncUseCloudBtn">
          <span class="sync-choice-option-title">クラウドのデータを使う</span>
          <span class="sync-choice-option-detail">クラウドのデータをこの端末に読み込みます。<strong>この端末の現在のデータは上書きされます。</strong></span>
        </button>
        <button type="button" class="sync-choice-option sync-choice-local" id="syncUseLocalBtn">
          <span class="sync-choice-option-title">この端末のデータを使う</span>
          <span class="sync-choice-option-detail">この端末のデータをクラウドに保存します。<strong>クラウドの現在のデータは上書きされます。</strong></span>
        </button>
      </div>
      <p class="sync-choice-warning">※ 選ばなかった側の現在のデータは上書きされます。</p>
    </div>
  </div>
</dialog>
'''
marker = '<dialog id="budgetDialog">'
assert marker in s, 'budget dialog marker not found'
assert 'id="syncChoiceDialog"' not in s, 'sync choice dialog already exists'
s = s.replace(marker, sync_dialog + '\n' + marker, 1)
s = s.replace('style.css?v=2.6.30', 'style.css?v=2.6.31', 1)
s = s.replace('app.js?v=2.6.30', 'app.js?v=2.6.31', 1)
s = s.replace('v2.6.30 Stable', 'v2.6.31 Stable')
index.write_text(s, encoding='utf-8')

app = Path('app.js')
s = app.read_text(encoding='utf-8')
old_initial = '''async function initialCloudSync(){
  if(!syncUser)return;setSyncStatus('busy','同期中','クラウドデータを確認しています…');
  try{
    const cloud=await fetchCloudState();
    if(!cloud){await uploadCloudState();return}
    if(hasMeaningfulLocalData()){
      const useCloud=confirm('クラウド上にも家計簿データがあります。\\\\n\\\\n「OK」: クラウドのデータをこの端末へ読み込む\\\\n「キャンセル」: この端末のデータでクラウドを上書きする');
      if(useCloud){await applyCloudState(cloud);setSyncStatus('ok','同期済み','クラウドのデータを読み込みました')}else await uploadCloudState()
    }else{await applyCloudState(cloud);setSyncStatus('ok','同期済み','クラウドのデータを読み込みました')}
  }catch(e){console.error(e);setSyncStatus('err','同期エラー','クラウドデータを取得できませんでした')}
}
'''
assert old_initial in s, 'initialCloudSync block not found'
new_initial = '''let syncChoiceResolve=null;
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
    if(!cloud){await uploadCloudState();return}
    if(hasMeaningfulLocalData()){
      const choice=await chooseSyncSource('この端末とクラウドの両方に家計簿データがあります。残したいデータを選んでください。');
      if(choice==='cloud'){
        await applyCloudState(cloud);setSyncStatus('ok','同期済み','クラウドのデータを読み込みました')
      }else if(choice==='local'){
        await uploadCloudState()
      }else{
        setSyncStatus('','同期を中止しました','データは変更されていません')
      }
    }else{await applyCloudState(cloud);setSyncStatus('ok','同期済み','クラウドのデータを読み込みました')}
  }catch(e){console.error(e);setSyncStatus('err','同期エラー','クラウドデータを取得できませんでした')}
}
'''
s = s.replace(old_initial, new_initial, 1)

old_manual = '''async function manualCloudSync(){
  if(!syncUser){alert('先にログインしてください');return}
  try{
    const cloud=await fetchCloudState();if(!cloud){await uploadCloudState();return}
    const useCloud=confirm('同期方法を選んでください。\\\\n\\\\n「OK」: クラウド → この端末\\\\n「キャンセル」: この端末 → クラウド');
    if(useCloud){await applyCloudState(cloud);setSyncStatus('ok','同期済み','クラウドのデータを読み込みました')}else await uploadCloudState()
  }catch(e){console.error(e);setSyncStatus('err','同期エラー','同期できませんでした')}
}
'''
assert old_manual in s, 'manualCloudSync block not found'
new_manual = '''async function manualCloudSync(){
  if(!syncUser){alert('先にログインしてください');return}
  try{
    const cloud=await fetchCloudState();if(!cloud){await uploadCloudState();return}
    const choice=await chooseSyncSource('どちらのデータを最新データとして使用するか選んでください。');
    if(choice==='cloud'){
      await applyCloudState(cloud);setSyncStatus('ok','同期済み','クラウドのデータを読み込みました')
    }else if(choice==='local'){
      await uploadCloudState()
    }else{
      setSyncStatus('','同期を中止しました','データは変更されていません')
    }
  }catch(e){console.error(e);setSyncStatus('err','同期エラー','同期できませんでした')}
}
'''
s = s.replace(old_manual, new_manual, 1)

old_init = '''async function initCloudSync(){
  loadSyncSession();
  if(syncSession){syncUser=await fetchSyncUser();updateSyncUI();if(syncUser)await initialCloudSync()}else updateSyncUI();
  const a=document.getElementById('syncSignInBtn'),b=document.getElementById('syncSignUpBtn'),c=document.getElementById('syncSignOutBtn'),d=document.getElementById('syncNowBtn');
  if(a)a.onclick=signInCloud;if(b)b.onclick=signUpCloud;if(c)c.onclick=signOutCloud;if(d)d.onclick=manualCloudSync
}
'''
assert old_init in s, 'initCloudSync block not found'
new_init = '''async function initCloudSync(){
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
s = s.replace(old_init, new_init, 1)
app.write_text(s, encoding='utf-8')

style = Path('style.css')
s = style.read_text(encoding='utf-8')
assert '/* v2.6.31: dedicated cloud sync choice dialog */' not in s, 'sync dialog CSS already exists'
s += '''\n\n/* v2.6.31: dedicated cloud sync choice dialog */
.sync-choice-dialog{width:min(92vw,620px);max-width:620px;padding:0;overflow:hidden}
.sync-choice-dialog .sync-choice-shell{background:var(--card);color:var(--text)}
.sync-choice-head{padding:18px 20px 14px;border-bottom:1px solid var(--line-soft);background:var(--header2)}
.sync-choice-kicker{display:block;margin-bottom:5px;font-size:11px;font-weight:800;letter-spacing:.08em;color:var(--muted)}
.sync-choice-dialog .dialog-head{padding:0;background:transparent;color:var(--text);font-size:20px;line-height:1.35}
.sync-choice-body{padding:18px 20px 20px}
.sync-choice-message{margin:0 0 15px;color:var(--text);font-size:14px;line-height:1.7}
.sync-choice-options{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sync-choice-option{display:flex;flex-direction:column;gap:8px;min-width:0;min-height:150px;padding:17px;text-align:left;border:1px solid var(--line);border-radius:14px;background:var(--card);color:var(--text);cursor:pointer;transition:border-color .15s ease,box-shadow .15s ease,transform .15s ease}
.sync-choice-option:hover,.sync-choice-option:focus-visible{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 14%,transparent);outline:none}
.sync-choice-option:active{transform:translateY(1px)}
.sync-choice-option-title{font-size:16px;font-weight:800;line-height:1.4}
.sync-choice-option-detail{font-size:12px;line-height:1.7;color:var(--muted)}
.sync-choice-option-detail strong{display:block;margin-top:5px;color:var(--danger);font-size:12px}
.sync-choice-cloud .sync-choice-option-title{color:var(--accent)}
.sync-choice-local .sync-choice-option-title{color:var(--good)}
.sync-choice-warning{margin:14px 0 0;padding:10px 12px;border-radius:10px;background:color-mix(in srgb,var(--danger) 8%,transparent);color:var(--danger);font-size:11px;line-height:1.6;font-weight:700}
body.dark-mode .sync-choice-dialog .sync-choice-shell{background:var(--card)}
body.dark-mode .sync-choice-option{background:#152231;border-color:var(--line)}
@media(max-width:700px){
  .sync-choice-dialog{width:min(94vw,560px)}
  .sync-choice-head{padding:16px 16px 12px}
  .sync-choice-dialog .dialog-head{font-size:18px}
  .sync-choice-body{padding:15px 16px 17px}
  .sync-choice-options{grid-template-columns:1fr;gap:10px}
  .sync-choice-option{min-height:0;padding:15px}
}
'''
style.write_text(s, encoding='utf-8')

sw = Path('sw.js')
s = sw.read_text(encoding='utf-8')
assert "kakeibo-v2.6.30-stable" in s, 'expected v2.6.30 cache name not found'
assert "./style.css?v=2.6.30" in s and "./app.js?v=2.6.30" in s, 'expected v2.6.30 app shell URLs not found'
s = s.replace("kakeibo-v2.6.30-stable", "kakeibo-v2.6.31-stable", 1)
s = s.replace("./style.css?v=2.6.30", "./style.css?v=2.6.31", 1)
s = s.replace("./app.js?v=2.6.30", "./app.js?v=2.6.31", 1)
sw.write_text(s, encoding='utf-8')

readme = Path('README.md')
s = readme.read_text(encoding='utf-8')
assert s.startswith('# 家計簿Webアプリ v2.6.30 Stable'), 'README version heading unexpected'
marker = '## v2.6.30 Stable\n'
pos = s.find(marker)
assert pos != -1, 'v2.6.30 release section not found'
release = '''# 家計簿Webアプリ v2.6.31 Stable

Excel家計簿をベースにした iPhone / iPad / Mac 対応のレスポンシブPWAです。

## v2.6.31 Stable
- クラウド同期時のブラウザ標準「OK / キャンセル」確認を、2つの明確な選択ボタンを持つ専用ダイアログへ変更
- 「クラウドのデータを使う」「この端末のデータを使う」の各操作で、どちら側が上書きされるかを明記
- 同期処理・保存データ・その他の機能仕様は変更なし

'''
s = release + s[pos:]
readme.write_text(s, encoding='utf-8')

test = Path('tests/ui-regression.spec.js')
s = test.read_text(encoding='utf-8')
s = s.replace("release assets use v2.6.30 cache-busting URLs", "release assets use v2.6.31 cache-busting URLs")
s = s.replace("style.css?v=2.6.30", "style.css?v=2.6.31")
s = s.replace("app.js?v=2.6.30", "app.js?v=2.6.31")
if "cloud sync direction uses dedicated two-choice dialog" not in s:
    s += '''\n\n
test('cloud sync direction uses dedicated two-choice dialog', async ({ page }) => {
  await openApp(page);
  const resultPromise=page.evaluate(() => chooseSyncSource('どちらのデータを最新データとして使用するか選んでください。'));
  const dialog=page.locator('#syncChoiceDialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('同期するデータを選んでください');
  await expect(dialog).toContainText('クラウドのデータを使う');
  await expect(dialog).toContainText('この端末のデータを使う');
  await expect(dialog).toContainText('この端末の現在のデータは上書きされます');
  await expect(dialog).toContainText('クラウドの現在のデータは上書きされます');
  await expect(dialog.locator('button')).toHaveCount(2);
  await dialog.locator('#syncUseCloudBtn').click();
  expect(await resultPromise).toBe('cloud');

  const localPromise=page.evaluate(() => chooseSyncSource());
  await expect(dialog).toBeVisible();
  await dialog.locator('#syncUseLocalBtn').click();
  expect(await localPromise).toBe('local');
});
'''
test.write_text(s, encoding='utf-8')
