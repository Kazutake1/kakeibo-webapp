from pathlib import Path

# Version label only.
index = Path('index.html')
s = index.read_text(encoding='utf-8')
if 'v2.6.18 Stable' not in s:
    raise SystemExit('Expected v2.6.18 Stable in index.html')
index.write_text(s.replace('v2.6.18 Stable', 'v2.6.19 Stable'), encoding='utf-8')

# Make the smartphone expense-composition donut use the same responsive layout
# already used by the variable-category donut. No other styling is changed.
css = Path('style.css')
c = css.read_text(encoding='utf-8')
old = '''/* v2.6.16: iPad overview fixes */
/* Keep the variable-expense donut legend inside narrow overview cards. */
.card:has(#variableDonut){container-type:inline-size}
@container (max-width:620px){
  .card:has(#variableDonut) .donut-layout{grid-template-columns:1fr;gap:12px;min-height:0}
  .card:has(#variableDonut) .donut-canvas-wrap{height:240px}
  .card:has(#variableDonut) .donut-side-legend{min-width:0;padding-bottom:4px}
}
'''
new = '''/* v2.6.16 / v2.6.19: narrow overview donut layout */
/* Keep both donut legends inside narrow overview cards using the same design. */
.card:has(#donutChart),.card:has(#variableDonut){container-type:inline-size}
@container (max-width:620px){
  .card:has(#donutChart) .donut-layout,.card:has(#variableDonut) .donut-layout{grid-template-columns:1fr;gap:12px;min-height:0}
  .card:has(#donutChart) .donut-canvas-wrap,.card:has(#variableDonut) .donut-canvas-wrap{height:240px}
  .card:has(#donutChart) .donut-side-legend,.card:has(#variableDonut) .donut-side-legend{min-width:0;padding-bottom:4px}
}
'''
if old not in c:
    raise SystemExit('Expected v2.6.16 narrow variable donut CSS block not found')
c = c.replace(old, new, 1)
css.write_text(c, encoding='utf-8')

# Cache bump only.
sw = Path('sw.js')
w = sw.read_text(encoding='utf-8')
if 'kakeibo-v2.6.18-stable' not in w:
    raise SystemExit('Expected v2.6.18 service-worker cache')
sw.write_text(w.replace('kakeibo-v2.6.18-stable', 'kakeibo-v2.6.19-stable'), encoding='utf-8')

# README records only the requested smartphone display fix.
readme = Path('README.md')
r = readme.read_text(encoding='utf-8')
if '# 家計簿Webアプリ v2.6.18 Stable' not in r:
    raise SystemExit('Expected v2.6.18 README heading')
r = r.replace('# 家計簿Webアプリ v2.6.18 Stable', '# 家計簿Webアプリ v2.6.19 Stable', 1)
entry = '''## v2.6.19 Stable
- スマホ版の「支出構成」を「変動費カテゴリ」と同じレスポンシブデザインに統一
- 狭い画面ではドーナツと凡例を縦配置にし、カード内の見切れを防止
- その他の機能・表示仕様は変更なし

'''
r = r.replace('## v2.6.18 Stable\n', entry + '## v2.6.18 Stable\n', 1)
readme.write_text(r, encoding='utf-8')

# Add a focused regression check for the requested smartphone behavior.
test = Path('tests/ui-regression.spec.js')
t = test.read_text(encoding='utf-8')
name = 'smartphone expense composition matches variable category donut layout'
if name not in t:
    t += '''

test('smartphone expense composition matches variable category donut layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);

  for (const canvasId of ['donutChart', 'variableDonut']) {
    const card = page.locator('.card').filter({ has: page.locator(`#${canvasId}`) }).first();
    const layout = card.locator('.donut-layout');
    const columns = await layout.evaluate(el => getComputedStyle(el).gridTemplateColumns.trim().split(/\\s+/).length);
    expect(columns).toBe(1);
    const geometry = await card.evaluate(el => ({ clientWidth: el.clientWidth, scrollWidth: el.scrollWidth }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  }
});
'''
test.write_text(t, encoding='utf-8')
