from pathlib import Path

# v2.6.40: rename only the mobile full-entry card and remove its redundant badge.
index=Path('index.html')
s=index.read_text(encoding='utf-8')
old='''        <div class="mobile-full-head"><strong>詳細入力</strong><span class="mobile-full-badge">全項目</span></div>
        <div class="mobile-full-body">
          <button class="secondary full-entry-btn" id="quickFullBtn" type="button">詳細入力を開く</button>
        </div>'''
new='''        <div class="mobile-full-head"><strong>全項目を入力</strong></div>
        <div class="mobile-full-body">
          <button class="secondary full-entry-btn" id="quickFullBtn" type="button">入力画面を開く</button>
        </div>'''
assert s.count(old)==1, 'Expected existing full-entry card exactly once'
s=s.replace(old,new,1)
for before,after in [
    ('style.css?v=2.6.39','style.css?v=2.6.40'),
    ('app.js?v=2.6.39','app.js?v=2.6.40'),
    ('v2.6.39 Stable','v2.6.40 Stable')]:
    assert s.count(before)==1, f'Expected exactly one index reference: {before}'
    s=s.replace(before,after,1)
index.write_text(s,encoding='utf-8')

sw=Path('sw.js')
s=sw.read_text(encoding='utf-8')
for before,after in [
    ('kakeibo-v2.6.39-stable','kakeibo-v2.6.40-stable'),
    ('./style.css?v=2.6.39','./style.css?v=2.6.40'),
    ('./app.js?v=2.6.39','./app.js?v=2.6.40')]:
    assert s.count(before)==1, f'Expected exactly one service-worker reference: {before}'
    s=s.replace(before,after,1)
sw.write_text(s,encoding='utf-8')

readme=Path('README.md')
s=readme.read_text(encoding='utf-8')
old_head='# 家計簿Webアプリ v2.6.39 Stable'
assert s.startswith(old_head+'\n'), 'Unexpected README version'
s=s.replace(old_head,'# 家計簿Webアプリ v2.6.40 Stable',1)
marker='## v2.6.39 Stable\n'
assert marker in s, 'v2.6.39 release notes missing'
release='''## v2.6.40 Stable
- スマホ版の「詳細入力」カードを「全項目を入力」に改名し、操作ボタンを「入力画面を開く」に変更
- 見出しと重複する「全項目」バッジを削除
- 入力ダイアログ、データ保存、その他の画面・機能は変更なし

'''
s=s.replace(marker,release+marker,1)
readme.write_text(s,encoding='utf-8')

tests=Path('tests/ui-regression.spec.js')
s=tests.read_text(encoding='utf-8')
for before,after in [
    ('release assets use v2.6.39 cache-busting URLs','release assets use v2.6.40 cache-busting URLs'),
    ('style.css?v=2.6.39','style.css?v=2.6.40'),
    ('app.js?v=2.6.39','app.js?v=2.6.40')]:
    assert before in s, f'Expected test reference missing: {before}'
    s=s.replace(before,after)
old_expect="""  await expect(full).toContainText('詳細入力');
  await expect(full).toContainText('全項目');

  await full.locator('#quickFullBtn').click();"""
new_expect="""  await expect(full.locator('.mobile-full-head strong')).toHaveText('全項目を入力');
  await expect(full.locator('.mobile-full-badge')).toHaveCount(0);
  await expect(full.locator('#quickFullBtn')).toHaveText('入力画面を開く');

  await full.locator('#quickFullBtn').click();"""
assert s.count(old_expect)==1, 'Expected current smartphone full-entry test block exactly once'
s=s.replace(old_expect,new_expect,1)
tests.write_text(s,encoding='utf-8')
print('Applied scoped v2.6.40 label and badge changes')
