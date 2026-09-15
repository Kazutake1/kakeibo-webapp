from pathlib import Path

# v2.6.37: separate smartphone quick variable-expense input from full transaction input.

index = Path('index.html')
s = index.read_text(encoding='utf-8')
old_block = '''      <div class="mobile-quick-entry" id="mobileQuickEntry">
        <div class="mobile-quick-head"><strong>今日の支出を入力</strong><span class="mobile-quick-date" id="quickDateLabel"></span></div>
        <div class="mobile-quick-body">
          <div class="quick-grid">
            <div class="field"><label>項目</label><select id="quickCategory"></select></div>
            <div class="field"><label>店名・内容（任意）</label><input id="quickItem" placeholder="例：セブンイレブン"></div>
            <div class="field quick-amount"><label>金額</label><input type="text" id="quickAmount" inputmode="decimal" autocomplete="off" placeholder="例：680+1250+320"><div class="quick-result" id="quickAmountResult" aria-live="polite"></div></div>
          </div>
          <div class="quick-actions"><button class="primary" id="quickSaveBtn">今日の支出を保存</button><button class="quick-secondary" id="quickFullBtn" type="button">詳細入力</button></div>
        </div>
      </div>'''
new_block = '''      <div class="mobile-quick-entry" id="mobileQuickEntry">
        <div class="mobile-quick-head"><strong>今日の変動費を入力</strong><span class="mobile-quick-date" id="quickDateLabel"></span></div>
        <div class="mobile-quick-body">
          <div class="quick-grid">
            <div class="field"><label>項目</label><select id="quickCategory"></select></div>
            <div class="field"><label>店名・内容（任意）</label><input id="quickItem" placeholder="例：セブンイレブン"></div>
            <div class="field quick-amount"><label>金額</label><input type="text" id="quickAmount" inputmode="decimal" autocomplete="off" placeholder="例：680+1250+320"><div class="quick-result" id="quickAmountResult" aria-live="polite"></div></div>
          </div>
          <div class="quick-actions"><button class="primary" id="quickSaveBtn">今日の変動費を保存</button></div>
        </div>
      </div>
      <div class="mobile-full-entry" id="mobileFullEntry">
        <div class="mobile-full-head"><strong>詳細入力</strong><span class="mobile-full-badge">全項目</span></div>
        <div class="mobile-full-body">
          <p class="mobile-full-note">収入・社会保険／税金・貯蓄・自己投資・固定費・特別費・変動費は、ここから入力できます。</p>
          <button class="secondary full-entry-btn" id="quickFullBtn" type="button">詳細入力を開く</button>
        </div>
      </div>'''
assert old_block in s, 'mobile quick-entry block not found'
s = s.replace(old_block, new_block, 1)
assert 'style.css?v=2.6.36' in s and 'app.js?v=2.6.36' in s, 'v2.6.36 asset refs not found'
s = s.replace('style.css?v=2.6.36', 'style.css?v=2.6.37', 1)
s = s.replace('app.js?v=2.6.36', 'app.js?v=2.6.37', 1)
assert 'v2.6.36 Stable' in s, 'v2.6.36 about badge not found'
s = s.replace('v2.6.36 Stable', 'v2.6.37 Stable')
index.write_text(s, encoding='utf-8')

style = Path('style.css')
s = style.read_text(encoding='utf-8')
marker = '/* v2.6.37: separate smartphone variable quick input and full entry */'
assert marker not in s, 'v2.6.37 styles already present'
s += r'''

/* v2.6.37: separate smartphone variable quick input and full entry */
.mobile-full-entry{display:none}
@media(max-width:700px){
  .mobile-full-entry{
    display:block;
    margin-bottom:14px;
    overflow:hidden;
    border:0;
    border-radius:26px;
    background:var(--card);
    box-shadow:0 14px 32px rgba(41,108,187,.12)
  }
  .mobile-full-head{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    padding:18px 18px 10px
  }
  .mobile-full-head strong{font-size:18px;color:var(--text)}
  .mobile-full-badge{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    padding:6px 10px;
    border-radius:999px;
    background:var(--accent-soft);
    color:var(--accent);
    font-size:12px;
    font-weight:800
  }
  .mobile-full-body{padding:0 18px 18px}
  .mobile-full-note{
    margin:0 0 12px;
    color:var(--muted);
    font-size:13px;
    line-height:1.65
  }
  .full-entry-btn{width:100%;min-height:54px;font-size:16px;font-weight:750}
  .mobile-quick-entry .quick-actions{grid-template-columns:1fr}
}
body.dark-mode .mobile-full-entry{background:var(--card)!important}
body.dark-mode .mobile-full-badge{background:#183753;color:#8ec8ff}
body.dark-mode .mobile-full-note{color:var(--muted)}
'''
style.write_text(s, encoding='utf-8')

sw = Path('sw.js')
s = sw.read_text(encoding='utf-8')
assert "kakeibo-v2.6.36-stable" in s, 'v2.6.36 cache name not found'
assert "./style.css?v=2.6.36" in s and "./app.js?v=2.6.36" in s, 'v2.6.36 APP_SHELL refs not found'
s = s.replace("kakeibo-v2.6.36-stable", "kakeibo-v2.6.37-stable", 1)
s = s.replace("./style.css?v=2.6.36", "./style.css?v=2.6.37", 1)
s = s.replace("./app.js?v=2.6.36", "./app.js?v=2.6.37", 1)
sw.write_text(s, encoding='utf-8')

readme = Path('README.md')
s = readme.read_text(encoding='utf-8')
old_intro = '# 家計簿Webアプリ v2.6.36 Stable\n\nExcel家計簿をベースにした iPhone / iPad / Mac 対応のレスポンシブPWAです。\n\n'
assert old_intro in s, 'README intro not found'
release = '''# 家計簿Webアプリ v2.6.37 Stable\n\nExcel家計簿をベースにした iPhone / iPad / Mac 対応のレスポンシブPWAです。\n\n## v2.6.37 Stable\n- スマホ版の概要ページで、変動費専用の「今日の変動費を入力」と全項目対応の「詳細入力」を別カードに分離\n- クイック入力の見出し・保存ボタンを「変動費」であることが明確な文言へ変更\n- 詳細入力カードには「全項目」と明記し、従来の全種別を入力できる収支ダイアログを開く\n- PC・iPad版、入力データの保存仕様、その他の機能は変更なし\n\n'''
s = s.replace(old_intro, release, 1)
readme.write_text(s, encoding='utf-8')

test = Path('tests/ui-regression.spec.js')
s = test.read_text(encoding='utf-8')
s = s.replace('release assets use v2.6.36 cache-busting URLs', 'release assets use v2.6.37 cache-busting URLs')
s = s.replace('style.css?v=2.6.36', 'style.css?v=2.6.37')
s = s.replace('app.js?v=2.6.36', 'app.js?v=2.6.37')
name = 'smartphone separates variable quick entry from full entry'
if name not in s:
    s += r'''


test('smartphone separates variable quick entry from full entry', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);

  const quick=page.locator('#mobileQuickEntry');
  const full=page.locator('#mobileFullEntry');
  await expect(quick).toBeVisible();
  await expect(full).toBeVisible();
  await expect(quick).toContainText('今日の変動費を入力');
  await expect(quick.locator('#quickSaveBtn')).toHaveText('今日の変動費を保存');
  await expect(quick.locator('#quickFullBtn')).toHaveCount(0);
  await expect(full).toContainText('詳細入力');
  await expect(full).toContainText('全項目');
  await expect(full).toContainText('収入');
  await expect(full).toContainText('固定費');
  await expect(full).toContainText('変動費');

  await full.locator('#quickFullBtn').click();
  await expect(page.locator('#txDialog')).toBeVisible();
  const typeLabels=await page.locator('#txType option').allTextContents();
  expect(typeLabels).toContain('収入');
  expect(typeLabels).toContain('固定費');
  expect(typeLabels).toContain('変動費');

  await page.locator('#txCancel').click();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(full).toBeHidden();
});
'''
test.write_text(s, encoding='utf-8')
