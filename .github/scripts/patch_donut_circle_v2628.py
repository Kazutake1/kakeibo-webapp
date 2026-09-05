from pathlib import Path

# v2.6.28: keep donut charts perfectly circular on Safari/iPhone/iPad without changing other UI.

app = Path('app.js')
s = app.read_text(encoding='utf-8')
old = "function prepCanvas(id){const c=document.getElementById(id);let r=c.getBoundingClientRect();let w=Math.max(1,r.width||c.parentElement?.clientWidth||300);let h=Math.max(id==='weeklyChart'?300:180,r.height||c.parentElement?.clientHeight||250);const dpr=devicePixelRatio||1;c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);let x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);return [x,w,h]}\n"
if old not in s:
    raise SystemExit('prepCanvas target not found')
new = old + "function prepDonutCanvas(id){const c=document.getElementById(id);const wrap=c.parentElement;const r=wrap.getBoundingClientRect();const size=Math.max(1,Math.min(r.width||wrap.clientWidth||300,r.height||wrap.clientHeight||300));const dpr=devicePixelRatio||1;c.style.width='100%';c.style.height='100%';c.width=Math.round(size*dpr);c.height=Math.round(size*dpr);const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);return [x,size,size]}\n"
s = s.replace(old, new, 1)
old_draw = "function drawDonut(canvasId,legendId,data){\n  let [ctx,w,h]=prepCanvas(canvasId);"
if old_draw not in s:
    raise SystemExit('drawDonut target not found')
s = s.replace(old_draw, "function drawDonut(canvasId,legendId,data){\n  let [ctx,w,h]=prepDonutCanvas(canvasId);", 1)
app.write_text(s, encoding='utf-8')

style = Path('style.css')
c = style.read_text(encoding='utf-8')
marker = '/* v2.6.28: force donut canvases to a square drawing area */'
if marker not in c:
    c += '''\n\n/* v2.6.28: force donut canvases to a square drawing area */\n.donut-canvas-wrap{\n  width:min(310px,100%);\n  height:auto!important;\n  aspect-ratio:1 / 1;\n  margin-left:auto;\n  margin-right:auto;\n}\n.donut-canvas-wrap canvas{width:100%;height:100%;display:block}\n@container (max-width:620px){\n  .card:has(#donutChart) .donut-canvas-wrap,.card:has(#variableDonut) .donut-canvas-wrap{\n    width:min(240px,100%);\n    height:auto!important;\n  }\n}\n@media (min-width:701px) and (max-width:1366px){\n  .donut-card .donut-canvas-wrap{\n    width:min(280px,100%);\n    height:auto!important;\n  }\n}\n@media (min-width:1367px){\n  .donut-card .donut-canvas-wrap{\n    width:min(330px,100%);\n    height:auto!important;\n  }\n}\n'''
style.write_text(c, encoding='utf-8')

index = Path('index.html')
i = index.read_text(encoding='utf-8')
if 'v2.6.27 Stable' not in i:
    raise SystemExit('index version target not found')
i = i.replace('v2.6.27 Stable', 'v2.6.28 Stable')
index.write_text(i, encoding='utf-8')

readme = Path('README.md')
r = readme.read_text(encoding='utf-8')
if '# 家計簿Webアプリ v2.6.27 Stable' not in r:
    raise SystemExit('README version target not found')
r = r.replace('# 家計簿Webアプリ v2.6.27 Stable', '# 家計簿Webアプリ v2.6.28 Stable', 1)
entry = '\n## v2.6.28 Stable\n- 「支出構成」「変動費カテゴリ」のドーナツグラフ描画領域を正方形に固定し、円が楕円に歪まないよう修正\n- Safariを含む端末でCanvasの縦横サイズを同一にして描画\n- その他の機能・表示仕様は変更なし\n'
pos = r.find('\n## v2.6.27 Stable')
if pos >= 0:
    r = r[:pos] + entry + r[pos:]
else:
    r += entry
readme.write_text(r, encoding='utf-8')

sw = Path('sw.js')
w = sw.read_text(encoding='utf-8')
if 'kakeibo-v2.6.27-stable' not in w:
    raise SystemExit('service worker cache target not found')
w = w.replace('kakeibo-v2.6.27-stable', 'kakeibo-v2.6.28-stable', 1)
sw.write_text(w, encoding='utf-8')

test = Path('tests/ui-regression.spec.js')
t = test.read_text(encoding='utf-8')
test_marker = "test('donut canvases stay perfectly square on smartphone and iPad'"
if test_marker not in t:
    t += r'''\n\ntest('donut canvases stay perfectly square on smartphone and iPad', async ({ page }) => {\n  for (const viewport of [{ width: 390, height: 844 }, { width: 1024, height: 768 }]) {\n    await page.setViewportSize(viewport);\n    await openApp(page);\n    for (const id of ['donutChart','variableDonut']) {\n      const dims = await page.locator(`#${id}`).evaluate(el => {\n        const rect = el.getBoundingClientRect();\n        return { cssWidth: rect.width, cssHeight: rect.height, backingWidth: el.width, backingHeight: el.height };\n      });\n      expect(Math.abs(dims.cssWidth - dims.cssHeight)).toBeLessThanOrEqual(1);\n      expect(dims.backingWidth).toBe(dims.backingHeight);\n    }\n  }\n});\n'''
test.write_text(t, encoding='utf-8')
