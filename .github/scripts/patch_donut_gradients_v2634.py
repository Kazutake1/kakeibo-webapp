from pathlib import Path

# v2.6.34: blue gradient for expense composition donut, green gradient for variable-category donut.

app = Path('app.js')
s = app.read_text(encoding='utf-8')
needle = "function chartColor(index){const palette=chartColors();return palette[index%palette.length]}\n"
insert = """function chartColor(index){const palette=chartColors();return palette[index%palette.length]}\nfunction donutColor(canvasId,index,count){\n  const total=Math.max(1,count);\n  const t=total<=1?0:Math.min(1,Math.max(0,index/(total-1)));\n  const isVariable=canvasId==='variableDonut';\n  const hue=isVariable?145:216;\n  const saturation=isVariable?62:82;\n  const startLightness=isVariable?28:34;\n  const endLightness=76;\n  const lightness=Math.round(startLightness+(endLightness-startLightness)*t);\n  return `hsl(${hue}, ${saturation}%, ${lightness}%)`\n}\n"""
assert needle in s, 'chartColor anchor not found'
s = s.replace(needle, insert, 1)
assert "ctx.fillStyle=chartColor(i);" in s, 'donut slice color call not found'
s = s.replace("ctx.fillStyle=chartColor(i);", "ctx.fillStyle=donutColor(canvasId,i,allData.length);", 1)
legend_old = '<i class="dot" style="background:${chartColor(i)}"></i>'
legend_new = '<i class="dot" style="background:${donutColor(canvasId,i,allData.length)}"></i>'
assert legend_old in s, 'donut legend color call not found'
s = s.replace(legend_old, legend_new, 1)
app.write_text(s, encoding='utf-8')

index = Path('index.html')
s = index.read_text(encoding='utf-8')
assert 'style.css?v=2.6.33' in s and 'app.js?v=2.6.33' in s, 'v2.6.33 asset refs not found'
assert 'v2.6.33 Stable' in s, 'v2.6.33 version label not found'
s = s.replace('style.css?v=2.6.33', 'style.css?v=2.6.34', 1)
s = s.replace('app.js?v=2.6.33', 'app.js?v=2.6.34', 1)
s = s.replace('v2.6.33 Stable', 'v2.6.34 Stable')
index.write_text(s, encoding='utf-8')

sw = Path('sw.js')
s = sw.read_text(encoding='utf-8')
assert "kakeibo-v2.6.33-stable" in s, 'v2.6.33 cache name not found'
assert "./style.css?v=2.6.33" in s and "./app.js?v=2.6.33" in s, 'v2.6.33 APP_SHELL refs not found'
s = s.replace("kakeibo-v2.6.33-stable", "kakeibo-v2.6.34-stable", 1)
s = s.replace("./style.css?v=2.6.33", "./style.css?v=2.6.34", 1)
s = s.replace("./app.js?v=2.6.33", "./app.js?v=2.6.34", 1)
sw.write_text(s, encoding='utf-8')

readme = Path('README.md')
s = readme.read_text(encoding='utf-8')
assert s.startswith('# 家計簿Webアプリ v2.6.33 Stable'), 'README version heading unexpected'
marker = '## v2.6.33 Stable\n'
pos = s.find(marker)
assert pos != -1, 'v2.6.33 release section not found'
release = '''# 家計簿Webアプリ v2.6.34 Stable\n\nExcel家計簿をベースにした iPhone / iPad / Mac 対応のレスポンシブPWAです。\n\n## v2.6.34 Stable\n- 「支出構成」のドーナツグラフを、項目の上から下へ濃い青から淡い青へ変化するグラデーション配色に変更\n- 「変動費カテゴリ」のドーナツグラフを、項目の上から下へ濃い緑から淡い緑へ変化するグラデーション配色に変更\n- 0円項目を含む凡例の並び順・週間比較グラフの配色・その他の機能仕様は変更なし\n\n'''
s = release + s[pos:]
readme.write_text(s, encoding='utf-8')

test = Path('tests/ui-regression.spec.js')
s = test.read_text(encoding='utf-8')
s = s.replace('release assets use v2.6.33 cache-busting URLs', 'release assets use v2.6.34 cache-busting URLs')
s = s.replace('style.css?v=2.6.33', 'style.css?v=2.6.34')
s = s.replace('app.js?v=2.6.33', 'app.js?v=2.6.34')
name = "donut legends use ordered blue and green gradients"
if name not in s:
    s += r'''


test('donut legends use ordered blue and green gradients', async ({ page }) => {
  await openApp(page);
  const colors=await page.evaluate(()=>({
    expense:Array.from({length:6},(_,i)=>donutColor('donutChart',i,6)),
    variable:Array.from({length:10},(_,i)=>donutColor('variableDonut',i,10)),
    weeklyFirst:chartColor(0),
    weeklySecond:chartColor(1)
  }));

  expect(colors.expense[0]).toBe('hsl(216, 82%, 34%)');
  expect(colors.expense.at(-1)).toBe('hsl(216, 82%, 76%)');
  expect(new Set(colors.expense).size).toBe(colors.expense.length);
  expect(colors.variable[0]).toBe('hsl(145, 62%, 28%)');
  expect(colors.variable.at(-1)).toBe('hsl(145, 62%, 76%)');
  expect(new Set(colors.variable).size).toBe(colors.variable.length);
  expect(colors.weeklyFirst).not.toBe(colors.weeklySecond);

  const expenseDots=page.locator('#donutLegend .donut-legend-name .dot');
  const variableDots=page.locator('#variableLegend .donut-legend-name .dot');
  await expect(expenseDots).toHaveCount(6);
  await expect(variableDots).toHaveCount(10);
  const expenseComputed=await expenseDots.evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).backgroundColor));
  const variableComputed=await variableDots.evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).backgroundColor));
  expect(new Set(expenseComputed).size).toBe(6);
  expect(new Set(variableComputed).size).toBe(10);
});
'''
test.write_text(s, encoding='utf-8')
