from pathlib import Path

# v2.6.30: cache-bust CSS/JS asset URLs so normal reloads pick up the latest release.

index = Path('index.html')
s = index.read_text(encoding='utf-8')
assert 'href="style.css"' in s, 'style.css link not found'
assert '<script src="app.js"></script>' in s, 'app.js script not found'
assert 'v2.6.29 Stable' in s, 'expected v2.6.29 label not found'
s = s.replace('href="style.css"', 'href="style.css?v=2.6.30"', 1)
s = s.replace('<script src="app.js"></script>', '<script src="app.js?v=2.6.30"></script>', 1)
s = s.replace('v2.6.29 Stable', 'v2.6.30 Stable')
index.write_text(s, encoding='utf-8')

sw = Path('sw.js')
s = sw.read_text(encoding='utf-8')
assert "const CACHE_NAME='kakeibo-v2.6.29-stable';" in s, 'old cache name not found'
assert "const APP_SHELL=['./','./index.html','./style.css','./app.js','./manifest.json','./icon-192.png','./icon-512.png'];" in s, 'APP_SHELL not in expected form'
s = s.replace("const CACHE_NAME='kakeibo-v2.6.29-stable';", "const CACHE_NAME='kakeibo-v2.6.30-stable';", 1)
s = s.replace(
    "const APP_SHELL=['./','./index.html','./style.css','./app.js','./manifest.json','./icon-192.png','./icon-512.png'];",
    "const APP_SHELL=['./','./index.html','./style.css?v=2.6.30','./app.js?v=2.6.30','./manifest.json','./icon-192.png','./icon-512.png'];",
    1,
)
sw.write_text(s, encoding='utf-8')

readme = Path('README.md')
s = readme.read_text(encoding='utf-8')
assert s.startswith('# 家計簿Webアプリ v2.6.29 Stable'), 'README version heading unexpected'
release = """# 家計簿Webアプリ v2.6.30 Stable

Excel家計簿をベースにした iPhone / iPad / Mac 対応のレスポンシブPWAです。

## v2.6.30 Stable
- `style.css` と `app.js` の読み込みURLにリリース番号を付与し、通常のリロードでも最新版のCSS/JavaScriptを取得しやすいよう改善
- Service Worker のキャッシュ対象も同じバージョン付きURLへ更新
- 支出カレンダーを含む機能・表示仕様そのものは変更なし

"""
marker = '## v2.6.29 Stable\n'
pos = s.find(marker)
assert pos != -1, 'v2.6.29 release section not found'
old_preamble_end = pos
s = release + s[old_preamble_end:]
readme.write_text(s, encoding='utf-8')

# Add a narrowly scoped regression test for release asset versioning.
test = Path('tests/ui-regression.spec.js')
s = test.read_text(encoding='utf-8')
needle = "test('desktop expense weekly total row matches item row height and shows week sum', async ({ page }) => {"
assert needle in s, 'expected existing regression test not found'
if "release assets use v2.6.30 cache-busting URLs" not in s:
    s += """


test('release assets use v2.6.30 cache-busting URLs', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('link[rel="stylesheet"]')).toHaveAttribute('href', 'style.css?v=2.6.30');
  const appSrc = await page.locator('script[src*="app.js"]').getAttribute('src');
  expect(appSrc).toBe('app.js?v=2.6.30');
});
"""
    test.write_text(s, encoding='utf-8')
