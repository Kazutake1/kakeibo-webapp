from pathlib import Path


def replace_one(path, before, after):
    text = path.read_text(encoding='utf-8')
    assert text.count(before) == 1, f'{path}: expected one matching block, found {text.count(before)}'
    path.write_text(text.replace(before, after, 1), encoding='utf-8')


# Keep the 80px fixed heights and all other card styling, including variable card, unchanged.
css = Path('style.css')
replace_one(
    css,
    '    max-height:80px;\n    padding:8px 12px!important;\n    gap:0;\n  }\n  .summary>.metric:nth-child(-n+4) .metric-heading{',
    '    max-height:80px;\n    padding:6px 12px!important;\n    gap:0;\n  }\n  .summary>.metric:nth-child(-n+4) .metric-heading{',
)
replace_one(
    css,
    '  .summary>.metric:nth-child(-n+4) .value{\n    margin-top:1px;',
    '  .summary>.metric:nth-child(-n+4) .value{\n    margin-top:6px;',
)

# Bump cache-busting URLs so reloading the iPhone obtains the updated stylesheet.
for filename in ('index.html', 'sw.js'):
    path = Path(filename)
    text = path.read_text(encoding='utf-8')
    assert '2.6.45' in text, filename
    path.write_text(text.replace('2.6.45', '2.6.46'), encoding='utf-8')

readme = Path('README.md')
text = readme.read_text(encoding='utf-8')
old_header = '# 家計簿Webアプリ v2.6.45 Stable'
assert text.startswith(old_header)
text = text.replace(old_header, '# 家計簿Webアプリ v2.6.46 Stable', 1)
anchor = '## v2.6.45 Stable\n'
assert text.count(anchor) == 1
text = text.replace(anchor, '## v2.6.46 Stable\n- iPhone版の収入・支出・収支・固定費カードだけ、80pxの高さを維持して項目名と金額の間隔を調整\n- 変動費カード、iPad/PC、その他の機能・レイアウトは変更なし\n\n' + anchor, 1)
readme.write_text(text, encoding='utf-8')

tests = Path('tests/ui-regression.spec.js')
text = tests.read_text(encoding='utf-8')
assert "test('release assets use v2.6.44 cache-busting URLs'" not in text
assert text.count('release assets use v2.6.44') == 0
assert text.count('style.css?v=2.6.44') == 0
# Current test has a fixed release-version assertion.
assert text.count('style.css?v=2.6.45') == 1
assert text.count('app.js?v=2.6.45') == 1
text = text.replace('2.6.45', '2.6.46')
text += '''\n\ntest('iPhone four compact summary cards have breathing room between title and amount', async ({page})=>{\n  for(const theme of ['light','dark']){\n    for(const width of [320,375,390,430]){\n      await page.setViewportSize({width,height:844});\n      await openApp(page,{theme});\n      const geometry=await page.locator('#summaryCards .metric').evaluateAll(cards=>cards.map(card=>{\n        const rect=card.getBoundingClientRect();\n        const heading=card.querySelector('.metric-heading').getBoundingClientRect();\n        const amount=card.querySelector('.value').getBoundingClientRect();\n        const sub=card.querySelector('.sub')?.getBoundingClientRect();\n        const style=getComputedStyle(card);\n        return {height:rect.height,paddingTop:style.paddingTop,amountMargin:getComputedStyle(card.querySelector('.value')).marginTop,headingGap:amount.top-heading.bottom,amountBottom:amount.bottom,subBottom:sub?.bottom??0,cardBottom:rect.bottom};\n      }));\n      for(const card of geometry.slice(0,4)){\n        expect(Math.abs(card.height-80)).toBeLessThanOrEqual(1);\n        expect(card.paddingTop).toBe('6px');\n        expect(card.amountMargin).toBe('6px');\n        expect(card.headingGap).toBeGreaterThanOrEqual(5);\n        expect(card.amountBottom).toBeLessThanOrEqual(card.cardBottom-2);\n        if(card.subBottom)expect(card.subBottom).toBeLessThanOrEqual(card.cardBottom-2);\n      }\n      expect(Math.abs(geometry[4].height-80)).toBeLessThanOrEqual(1);\n    }\n  }\n  for(const width of [820,1440]){\n    await page.setViewportSize({width,height:900});\n    await openApp(page);\n    const card=page.locator('#summaryCards .metric').first();\n    expect(await card.locator('.value').evaluate(el=>getComputedStyle(el).marginTop)).toBe('9px');\n  }\n});\n'''
tests.write_text(text, encoding='utf-8')
