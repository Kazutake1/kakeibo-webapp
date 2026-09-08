from pathlib import Path

# v2.6.36 retry: stabilize weekly comparison without blocking visible donut charts on phone.

app = Path('app.js')
s = app.read_text(encoding='utf-8')

old = "function showPanel(k){\n  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.dataset.panel===k));\n  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===k));\n  if(k==='expense'||k==='income'){renderCalendar();renderMobileDaily()}\n  if(k==='budget'){renderBudgetEditor();renderItemManager()}\n}"
new = "function showPanel(k){\n  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.dataset.panel===k));\n  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===k));\n  if(k==='expense'||k==='income'){renderCalendar();renderMobileDaily()}\n  if(k==='budget'){renderBudgetEditor();renderItemManager()}\n  if(k==='dashboard')scheduleChartDraw();\n}"
assert old in s, 'showPanel block not found'
s = s.replace(old, new, 1)

old = "function renderCurrentMonthViews(){renderMobileRecent();document.querySelector('#monthLabel').textContent=`${current.getFullYear()}年${current.getMonth()+1}月`;renderSummary();renderBudgetOverview();renderVariableStatus();renderCalendar();renderBudgetEditor();renderItemManager();renderExpenseHistory();requestAnimationFrame(()=>requestAnimationFrame(drawCharts))}"
new = "function renderCurrentMonthViews(){renderMobileRecent();document.querySelector('#monthLabel').textContent=`${current.getFullYear()}年${current.getMonth()+1}月`;renderSummary();renderBudgetOverview();renderVariableStatus();renderCalendar();renderBudgetEditor();renderItemManager();renderExpenseHistory();scheduleChartDraw()}"
assert old in s, 'renderCurrentMonthViews block not found'
s = s.replace(old, new, 1)

old = "function drawCharts(){\n  drawWeekly();\n  drawDonut('donutChart','donutLegend',TYPES.filter(t=>t.key!=='income').map(t=>[t.label,effectiveTypeSum(t.key)]));\n  drawDonut('variableDonut','variableLegend',catsFor('variable').map(c=>[c,sum(monthTx().filter(t=>t.type==='variable'&&t.category===c).map(t=>t.amount))]))\n}"
new = "let chartDrawTimer=null;\nlet chartDrawSeq=0;\nfunction chartCanvasVisible(id){\n  const panel=document.querySelector('.panel[data-panel=\"dashboard\"]');\n  const canvas=document.getElementById(id);\n  if(!panel?.classList.contains('active')||!panel.getClientRects().length||!canvas)return false;\n  const rect=canvas.parentElement?.getBoundingClientRect();\n  return !!rect&&rect.width>=2&&rect.height>=2;\n}\nfunction scheduleChartDraw(delay=80){\n  const seq=++chartDrawSeq;\n  clearTimeout(chartDrawTimer);\n  chartDrawTimer=setTimeout(()=>{\n    requestAnimationFrame(()=>requestAnimationFrame(()=>{\n      if(seq===chartDrawSeq)drawCharts();\n    }));\n  },delay);\n}\nfunction drawCharts(){\n  let drawn=false;\n  if(chartCanvasVisible('weeklyChart')){drawWeekly();drawn=true}\n  if(chartCanvasVisible('donutChart')){drawDonut('donutChart','donutLegend',TYPES.filter(t=>t.key!=='income').map(t=>[t.label,effectiveTypeSum(t.key)]));drawn=true}\n  if(chartCanvasVisible('variableDonut')){drawDonut('variableDonut','variableLegend',catsFor('variable').map(c=>[c,sum(monthTx().filter(t=>t.type==='variable'&&t.category===c).map(t=>t.amount))]));drawn=true}\n  return drawn;\n}"
assert old in s, 'drawCharts block not found'
s = s.replace(old, new, 1)

old = "function prepCanvas(id){const c=document.getElementById(id);let r=c.getBoundingClientRect();let w=Math.max(1,r.width||c.parentElement?.clientWidth||300);let h=Math.max(id==='weeklyChart'?300:180,r.height||c.parentElement?.clientHeight||250);const dpr=devicePixelRatio||1;c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);let x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);return [x,w,h]}"
new = "function prepCanvas(id){const c=document.getElementById(id);const r=c.getBoundingClientRect();const pr=c.parentElement?.getBoundingClientRect();const w=r.width||pr?.width||0;const h=r.height||pr?.height||0;if(w<2||h<2)return null;const dpr=devicePixelRatio||1;c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);return [x,w,h]}"
assert old in s, 'prepCanvas block not found'
s = s.replace(old, new, 1)

old = "function drawWeekly(){\n  let [ctx,w,h]=prepCanvas('weeklyChart');"
new = "function drawWeekly(){\n  const prepared=prepCanvas('weeklyChart');\n  if(!prepared)return false;\n  let [ctx,w,h]=prepared;"
assert old in s, 'drawWeekly start not found'
s = s.replace(old, new, 1)

old = "  if(typeof drawCharts==='function') requestAnimationFrame(()=>drawCharts());"
new = "  if(typeof scheduleChartDraw==='function') scheduleChartDraw();"
assert old in s, 'applyTheme chart redraw not found'
s = s.replace(old, new, 1)

old = "window.addEventListener('resize',()=>{clearTimeout(window.__rt);window.__rt=setTimeout(drawCharts,150)});\nif('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});\nlet chartResizeTimer;window.addEventListener('resize',()=>{clearTimeout(chartResizeTimer);chartResizeTimer=setTimeout(()=>requestAnimationFrame(drawCharts),120)});"
new = "window.addEventListener('resize',()=>scheduleChartDraw(140));\nif('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});"
assert old in s, 'duplicate resize listeners not found'
s = s.replace(old, new, 1)

app.write_text(s, encoding='utf-8')

style = Path('style.css')
s = style.read_text(encoding='utf-8')
marker = '/* v2.6.36: stabilize weekly comparison canvas */'
assert marker not in s, 'v2.6.36 style already present'
s += "\n\n/* v2.6.36: stabilize weekly comparison canvas */\n.weekly-canvas canvas{display:block}\n"
style.write_text(s, encoding='utf-8')

index = Path('index.html')
s = index.read_text(encoding='utf-8')
assert 'style.css?v=2.6.35' in s and 'app.js?v=2.6.35' in s, 'v2.6.35 asset refs not found'
assert 'v2.6.35 Stable' in s, 'v2.6.35 version label not found'
s = s.replace('style.css?v=2.6.35', 'style.css?v=2.6.36', 1)
s = s.replace('app.js?v=2.6.35', 'app.js?v=2.6.36', 1)
s = s.replace('v2.6.35 Stable', 'v2.6.36 Stable')
index.write_text(s, encoding='utf-8')

sw = Path('sw.js')
s = sw.read_text(encoding='utf-8')
assert "kakeibo-v2.6.35-stable" in s, 'v2.6.35 cache name not found'
assert "./style.css?v=2.6.35" in s and "./app.js?v=2.6.35" in s, 'v2.6.35 app shell refs not found'
s = s.replace("kakeibo-v2.6.35-stable", "kakeibo-v2.6.36-stable", 1)
s = s.replace("./style.css?v=2.6.35", "./style.css?v=2.6.36", 1)
s = s.replace("./app.js?v=2.6.35", "./app.js?v=2.6.36", 1)
sw.write_text(s, encoding='utf-8')

readme = Path('README.md')
s = readme.read_text(encoding='utf-8')
assert s.startswith('# 家計簿Webアプリ v2.6.35 Stable'), 'README heading unexpected'
old_intro = '# 家計簿Webアプリ v2.6.35 Stable\n\nExcel家計簿をベースにした iPhone / iPad / Mac 対応のレスポンシブPWAです。\n\n'
assert old_intro in s, 'README intro not found'
release = '''# 家計簿Webアプリ v2.6.36 Stable\n\nExcel家計簿をベースにした iPhone / iPad / Mac 対応のレスポンシブPWAです。\n\n## v2.6.36 Stable\n- PC・iPad版の「変動費 週間比較」で、概要ページが非表示中にCanvasが仮サイズで再描画され、戻った際に棒グラフが崩れる不具合を修正\n- 表示中で実寸が確定したグラフだけを描画し、スマホ版のドーナツグラフ表示も従来どおり維持\n- 概要ページへ戻った時・ウィンドウサイズ変更時の再描画を1本化し、レイアウト確定後に実行するよう安定化\n- グラフの集計方法・週予算14,000円・配色・高さ・その他の機能仕様は変更なし\n\n'''
s = s.replace(old_intro, release, 1)
readme.write_text(s, encoding='utf-8')

test = Path('tests/ui-regression.spec.js')
s = test.read_text(encoding='utf-8')
s = s.replace("release assets use v2.6.35 cache-busting URLs", "release assets use v2.6.36 cache-busting URLs")
s = s.replace("style.css?v=2.6.35", "style.css?v=2.6.36")
s = s.replace("app.js?v=2.6.35", "app.js?v=2.6.36")
name = "weekly chart keeps stable canvas size after hidden-panel redraws on iPad and PC"
if name not in s:
    s += r'''


test('weekly chart keeps stable canvas size after hidden-panel redraws on iPad and PC', async ({ page }) => {
  for (const viewport of [
    { width: 900, height: 768, expectedHeight: 350 },
    { width: 1024, height: 768, expectedHeight: 400 },
    { width: 1440, height: 900, expectedHeight: 400 }
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openApp(page);
    await page.waitForTimeout(250);

    const before = await page.locator('#weeklyChart').evaluate(el => {
      const rect = el.getBoundingClientRect();
      return { cssWidth: rect.width, cssHeight: rect.height, backingWidth: el.width, backingHeight: el.height, dpr: devicePixelRatio || 1 };
    });
    expect(Math.abs(before.cssHeight - viewport.expectedHeight)).toBeLessThanOrEqual(1);
    expect(Math.abs(before.backingWidth - Math.round(before.cssWidth * before.dpr))).toBeLessThanOrEqual(1);
    expect(Math.abs(before.backingHeight - Math.round(before.cssHeight * before.dpr))).toBeLessThanOrEqual(1);

    await page.locator('#tabs [data-tab="expense"]').click();
    const hiddenDrawResult = await page.evaluate(() => drawCharts());
    expect(hiddenDrawResult).toBe(false);
    const hiddenBacking = await page.locator('#weeklyChart').evaluate(el => ({ width: el.width, height: el.height }));
    expect(hiddenBacking.width).toBe(before.backingWidth);
    expect(hiddenBacking.height).toBe(before.backingHeight);

    await page.evaluate(() => render());
    await page.waitForTimeout(180);
    const afterHiddenRender = await page.locator('#weeklyChart').evaluate(el => ({ width: el.width, height: el.height }));
    expect(afterHiddenRender.width).toBe(before.backingWidth);
    expect(afterHiddenRender.height).toBe(before.backingHeight);

    await page.locator('#tabs [data-tab="dashboard"]').click();
    await page.waitForTimeout(250);
    const after = await page.locator('#weeklyChart').evaluate(el => {
      const rect = el.getBoundingClientRect();
      return { cssWidth: rect.width, cssHeight: rect.height, backingWidth: el.width, backingHeight: el.height, dpr: devicePixelRatio || 1 };
    });
    expect(Math.abs(after.cssHeight - viewport.expectedHeight)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.backingWidth - Math.round(after.cssWidth * after.dpr))).toBeLessThanOrEqual(1);
    expect(Math.abs(after.backingHeight - Math.round(after.cssHeight * after.dpr))).toBeLessThanOrEqual(1);

    await page.evaluate(() => { scheduleChartDraw(); scheduleChartDraw(); scheduleChartDraw(); });
    await page.waitForTimeout(250);
    const repeated = await page.locator('#weeklyChart').evaluate(el => ({
      cssWidth: el.getBoundingClientRect().width,
      cssHeight: el.getBoundingClientRect().height,
      backingWidth: el.width,
      backingHeight: el.height
    }));
    expect(Math.abs(repeated.cssWidth - after.cssWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(repeated.cssHeight - after.cssHeight)).toBeLessThanOrEqual(1);
    expect(repeated.backingWidth).toBe(after.backingWidth);
    expect(repeated.backingHeight).toBe(after.backingHeight);
  }
});
'''
test.write_text(s, encoding='utf-8')
