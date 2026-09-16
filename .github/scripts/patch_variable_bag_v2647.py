from pathlib import Path


def replace_once(file_name, old, new):
    file = Path(file_name)
    text = file.read_text(encoding='utf-8')
    assert text.count(old) == 1, (file_name, 'expected exactly one match', text.count(old))
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


# Use the existing decorative SVG icon system; no external image or asset is needed.
replace_once('app.js',
    "const icon=key==='variable'?'':`<span class=\"metric-icon\" aria-hidden=\"true\">${summaryCardIcon(key)}</span>`;",
    'const icon=`<span class="metric-icon" aria-hidden="true">${summaryCardIcon(key)}</span>`;')
replace_once('app.js',
    "    fixed:'<rect x=\"3\" y=\"5\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M7 3v4M17 3v4M3 10h18\"/>'",
    "    fixed:'<rect x=\"3\" y=\"5\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M7 3v4M17 3v4M3 10h18\"/>',\n    variable:'<path d=\"M5 9h14l1 12H4L5 9ZM9 10V7a3 3 0 0 1 6 0v3\"/>'")

# Only accommodate the new icon in the existing 80px variable card header.
css = Path('style.css')
text = css.read_text(encoding='utf-8')
assert 'v2.6.47' not in text
css.write_text(text + '''\n\n/* v2.6.47: selected shopping bag for variable expenses, preserving the 80px card. */\n@media(max-width:700px){\n  .summary>.metric:nth-child(5){grid-template-rows:22px minmax(0,1fr) 8px;gap:3px}\n  .summary>.metric:nth-child(5) .metric-heading{min-height:0;height:22px}\n  .summary>.metric:nth-child(5) .metric-icon{width:22px;height:22px;flex:0 0 22px}\n  .summary>.metric:nth-child(5) .metric-icon svg{width:14px;height:14px}\n}\n''', encoding='utf-8')

# Release cache-busting; do not change application logic or storage.
for file_name in ['index.html', 'sw.js']:
    file = Path(file_name)
    text = file.read_text(encoding='utf-8')
    assert '2.6.46' in text and '2.6.47' not in text
    file.write_text(text.replace('2.6.46', '2.6.47'), encoding='utf-8')

readme = Path('README.md')
text = readme.read_text(encoding='utf-8')
assert text.startswith('# 家計簿Webアプリ v2.6.46 Stable\n')
readme.write_text(text.replace('# 家計簿Webアプリ v2.6.46 Stable\n', '# 家計簿Webアプリ v2.6.47 Stable\n', 1).replace('## v2.6.46 Stable', '## v2.6.47 Stable\n- 概要の変動費カードに選択された案3のショッピングバッグの線画アイコンを追加\n- iPhoneのカード高さ80px、金額・残額・進捗バーの位置、他のカード、集計・保存・同期は維持\n\n## v2.6.46 Stable', 1), encoding='utf-8')

# Existing icon-count test must now expect all five card headings to have an icon.
tests = Path('tests/ui-regression.spec.js')
text = tests.read_text(encoding='utf-8')
assert text.count("await expect(cards.locator('.metric-icon')).toHaveCount(4);") == 1
assert text.count("await expect(cards.locator('.metric-icon svg')).toHaveCount(4);") == 1
assert 'v2.6.46' in text
text = text.replace("await expect(cards.locator('.metric-icon')).toHaveCount(4);", "await expect(cards.locator('.metric-icon')).toHaveCount(5);")
text = text.replace("await expect(cards.locator('.metric-icon svg')).toHaveCount(4);", "await expect(cards.locator('.metric-icon svg')).toHaveCount(5);")
text = text.replace('v2.6.46', 'v2.6.47')
text += '''\n\ntest('selected shopping bag icon appears only as the fifth new icon without disrupting cards', async ({page})=>{\n  for(const theme of ['light','dark']){\n    for(const width of [320,390,430,820,1440]){\n      await page.setViewportSize({width,height:900});\n      await openApp(page,{theme});\n      const cards=page.locator('#summaryCards .metric');\n      await expect(cards.locator('.metric-icon')).toHaveCount(5);\n      const variable=cards.nth(4);\n      const icon=variable.locator('.metric-icon');\n      const bag=icon.locator('svg path');\n      await expect(icon).toBeVisible();\n      await expect(bag).toHaveAttribute('d','M5 9h14l1 12H4L5 9ZM9 10V7a3 3 0 0 1 6 0v3');\n      const geometry=await variable.evaluate(el=>{\n        const card=el.getBoundingClientRect();\n        const heading=el.querySelector('.metric-heading').getBoundingClientRect();\n        const icon=el.querySelector('.metric-icon').getBoundingClientRect();\n        const amount=el.querySelector('.value').getBoundingClientRect();\n        const remainder=el.querySelector('.sub').getBoundingClientRect();\n        const progress=el.querySelector('.variable-budget-bar').getBoundingClientRect();\n        return {height:card.height,iconTop:icon.top,iconBottom:icon.bottom,headingTop:heading.top,headingBottom:heading.bottom,barTop:progress.top,barBottom:progress.bottom,amountBottom:amount.bottom,remainderBottom:remainder.bottom,rightGap:progress.right-remainder.right,cardBottom:card.bottom};\n      });\n      expect(geometry.iconTop).toBeGreaterThanOrEqual(geometry.headingTop-1);\n      expect(geometry.iconBottom).toBeLessThanOrEqual(geometry.headingBottom+1);\n      if(width<=700){\n        expect(Math.abs(geometry.height-80)).toBeLessThanOrEqual(1);\n        expect(geometry.barTop).toBeGreaterThan(geometry.amountBottom);\n        expect(geometry.barTop).toBeGreaterThan(geometry.remainderBottom);\n        expect(geometry.barBottom).toBeLessThanOrEqual(geometry.cardBottom-4);\n        expect(Math.abs(geometry.rightGap)).toBeLessThanOrEqual(1);\n      }\n      await expect(variable.locator('.variable-budget-bar')).toHaveCount(1);\n    }\n  }\n});\n'''
tests.write_text(text, encoding='utf-8')
print('Patched only app.js, style.css, index.html, sw.js, README.md, and UI tests for v2.6.47.')
