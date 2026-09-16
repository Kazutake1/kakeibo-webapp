from pathlib import Path


def replace_once(path, old, new):
    text = path.read_text(encoding='utf-8')
    if text.count(old) != 1:
        raise RuntimeError(f'{path}: expected exactly one match, found {text.count(old)} for {old[:75]!r}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


css = Path('style.css')
text = css.read_text(encoding='utf-8')
section_start = text.index('/* v2.6.44: compact iPhone summary cards only.')
start = text.index('  .summary>.metric:nth-child(5){', section_start)
end = text.index('  .summary>.metric:nth-child(5) .value{', start)
old = text[start:end]
expected = '''  .summary>.metric:nth-child(5){
    box-sizing:border-box;
    height:160px;
    min-height:160px;
    max-height:160px;
    padding:16px!important;
    display:grid;
    grid-template-columns:minmax(0,1fr) auto;
    grid-template-rows:auto minmax(0,1fr) auto;
    gap:8px;
  }
  .summary>.metric:nth-child(5) .metric-heading{grid-column:1/-1;grid-row:1}
'''
assert old == expected, 'Unexpected iPhone variable-card styles; avoid editing unrelated rules'
new = '''  /* v2.6.45: match the four 80px cards; retain amount, right-aligned remainder and bar. */
  .summary>.metric:nth-child(5){
    box-sizing:border-box;
    height:80px;
    min-height:80px;
    max-height:80px;
    padding:8px 12px!important;
    display:grid;
    grid-template-columns:minmax(0,1fr) auto;
    grid-template-rows:16px minmax(0,1fr) 8px;
    gap:4px;
  }
  .summary>.metric:nth-child(5) .metric-heading{grid-column:1/-1;grid-row:1;min-height:0;height:16px;align-self:center}
  .summary>.metric:nth-child(5) .metric-heading .label{font-size:12px;line-height:16px}
'''
css.write_text(text[:start] + new + text[end:], encoding='utf-8')

spec = Path('tests/ui-regression.spec.js')
replace_once(spec,
    "test('iPhone overview cards are exactly 80px and variable card is 160px with aligned remaining budget', async ({page})=>{",
    "test('iPhone overview cards are all exactly 80px with aligned variable remaining budget', async ({page})=>{")
replace_once(spec,
    "    expect(Math.abs(geometry.heights[4]-160)).toBeLessThanOrEqual(1);",
    "    expect(Math.abs(geometry.heights[4]-80)).toBeLessThanOrEqual(1);")
replace_once(spec,
    "        summaryOverflow:root.scrollWidth-root.clientWidth",
    "        summaryOverflow:root.scrollWidth-root.clientWidth,\n        variableTop:fifth.getBoundingClientRect().top,\n        variableBottom:fifth.getBoundingClientRect().bottom,\n        titleTop:fifth.querySelector('.metric-heading').getBoundingClientRect().top,\n        barTop:bar.top,\n        barBottom:bar.bottom,\n        amountBottom:amount.bottom,\n        remainingBottom:remaining.bottom")
replace_once(spec,
    "    expect(geometry.barRight).toBeLessThan(geometry.cardRight);",
    "    expect(geometry.barRight).toBeLessThan(geometry.cardRight);\n    expect(geometry.titleTop).toBeGreaterThanOrEqual(geometry.variableTop);\n    expect(geometry.barTop).toBeGreaterThan(geometry.amountBottom);\n    expect(geometry.barTop).toBeGreaterThan(geometry.remainingBottom);\n    expect(geometry.barBottom).toBeLessThanOrEqual(geometry.variableBottom-4);")
replace_once(spec, 'release assets use v2.6.44 cache-busting URLs', 'release assets use v2.6.45 cache-busting URLs')
spec_text = spec.read_text(encoding='utf-8')
assert spec_text.count('2.6.44') == 2, 'Unexpected old version references in UI tests'
spec.write_text(spec_text.replace('2.6.44', '2.6.45'), encoding='utf-8')

index = Path('index.html')
html = index.read_text(encoding='utf-8')
assert html.count('2.6.44') >= 3 and '2.6.45' not in html
index.write_text(html.replace('2.6.44', '2.6.45'), encoding='utf-8')

sw = Path('sw.js')
sw_text = sw.read_text(encoding='utf-8')
assert sw_text.count('2.6.44') == 3 and '2.6.45' not in sw_text
sw.write_text(sw_text.replace('2.6.44', '2.6.45'), encoding='utf-8')

readme = Path('README.md')
text = readme.read_text(encoding='utf-8')
assert text.startswith('# 家計簿Webアプリ v2.6.44 Stable\n')
text = text.replace('# 家計簿Webアプリ v2.6.44 Stable', '# 家計簿Webアプリ v2.6.45 Stable', 1)
needle = '## v2.6.44 Stable\n'
assert text.count(needle) == 1
text = text.replace(needle, '## v2.6.45 Stable\n- iPhone版の概要にある変動費カードだけ、160pxから80pxへ高さを変更し、残り予算額と進捗バーをカード内に収める\n- 残り予算額の右端と進捗バーの右端の位置、ほかのカード、iPad/PC版、計算・保存・同期は変更なし\n\n' + needle, 1)
readme.write_text(text, encoding='utf-8')

print('Applied iPhone-only variable height change: 160px -> 80px; release assets v2.6.45')