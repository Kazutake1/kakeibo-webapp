from pathlib import Path

# v2.6.33: make the daily-history delete button clearly red in light mode only.

style = Path('style.css')
s = style.read_text(encoding='utf-8')
old = '''    .daily-history-buttons .history-delete{\n      color:var(--danger);\n      border-color:rgba(223,90,103,.32);\n      background:rgba(223,90,103,.05);\n    }'''
new = '''    .daily-history-buttons .history-delete{\n      color:#dc2626;\n      border-color:#fecaca;\n      background:#fff1f2;\n    }'''
assert old in s, 'daily history delete block not found'
s = s.replace(old, new, 1)
# v2.6.9 has a higher-specificity light-mode rule with !important for all history buttons.
# Add an equally explicit delete-button override after it so the red styling actually wins.
assert '/* v2.6.33: light-mode daily-history delete button */' not in s, 'v2.6.33 style already exists'
s += '''\n\n/* v2.6.33: light-mode daily-history delete button */\nbody:not(.dark-mode) .daily-history-buttons .history-delete{\n  color:#dc2626!important;\n  border-color:#fecaca!important;\n  background:#fff1f2!important;\n}\n'''
style.write_text(s, encoding='utf-8')

index = Path('index.html')
s = index.read_text(encoding='utf-8')
assert 'style.css?v=2.6.32' in s and 'app.js?v=2.6.32' in s, 'v2.6.32 asset refs not found'
assert 'v2.6.32 Stable' in s, 'v2.6.32 version label not found'
s = s.replace('style.css?v=2.6.32', 'style.css?v=2.6.33', 1)
s = s.replace('app.js?v=2.6.32', 'app.js?v=2.6.33', 1)
s = s.replace('v2.6.32 Stable', 'v2.6.33 Stable')
index.write_text(s, encoding='utf-8')

sw = Path('sw.js')
s = sw.read_text(encoding='utf-8')
assert "kakeibo-v2.6.32-stable" in s, 'v2.6.32 cache name not found'
assert "./style.css?v=2.6.32" in s and "./app.js?v=2.6.32" in s, 'v2.6.32 APP_SHELL refs not found'
s = s.replace("kakeibo-v2.6.32-stable", "kakeibo-v2.6.33-stable", 1)
s = s.replace("./style.css?v=2.6.32", "./style.css?v=2.6.33", 1)
s = s.replace("./app.js?v=2.6.32", "./app.js?v=2.6.33", 1)
sw.write_text(s, encoding='utf-8')

readme = Path('README.md')
s = readme.read_text(encoding='utf-8')
assert s.startswith('# 家計簿Webアプリ v2.6.32 Stable'), 'README version heading unexpected'
marker = '## v2.6.32 Stable\n'
pos = s.find(marker)
assert pos != -1, 'v2.6.32 release section not found'
release = '''# 家計簿Webアプリ v2.6.33 Stable\n\nExcel家計簿をベースにした iPhone / iPad / Mac 対応のレスポンシブPWAです。\n\n## v2.6.33 Stable\n- ライトモードの入力履歴ダイアログで「削除」ボタンを明確な赤色表示に変更\n- ダークモードの削除ボタン表示・削除処理・その他の機能仕様は変更なし\n\n'''
s = release + s[pos:]
readme.write_text(s, encoding='utf-8')

test = Path('tests/ui-regression.spec.js')
s = test.read_text(encoding='utf-8')
s = s.replace('release assets use v2.6.32 cache-busting URLs', 'release assets use v2.6.33 cache-busting URLs')
s = s.replace('style.css?v=2.6.32', 'style.css?v=2.6.33')
s = s.replace('app.js?v=2.6.32', 'app.js?v=2.6.33')
name = "light mode daily-history delete button is red"
if name not in s:
    s += r'''


test('light mode daily-history delete button is red', async ({ page }) => {
  const date=currentDateKey();
  await openApp(page, { transactions: [
    {id:'delete-red-test',date,type:'variable',category:'セブンイレブン',item:'test',amount:213,amountExpression:'213',memo:''}
  ]});
  await page.evaluate(({date})=>{
    const [y,m,d]=date.split('-').map(Number);
    mobileDailyDate=new Date(y,m-1,d);
    dailyHistoryType='variable';
    dailyHistoryCategory='セブンイレブン';
    renderDailyHistory();
    dailyHistoryDialog.showModal();
  },{date});
  const button=page.locator('#dailyHistoryDialog .history-delete');
  await expect(button).toBeVisible();
  const styles=await button.evaluate(el=>{
    const s=getComputedStyle(el);
    return {color:s.color,borderColor:s.borderColor,background:s.backgroundColor};
  });
  expect(styles.color).toBe('rgb(220, 38, 38)');
  expect(styles.borderColor).toBe('rgb(254, 202, 202)');
  expect(styles.background).toBe('rgb(255, 241, 242)');
});
'''

test.write_text(s, encoding='utf-8')
