from pathlib import Path

# v2.6.29: only adjust the desktop expense calendar weekly total row.

app = Path('app.js')
s = app.read_text(encoding='utf-8')
old = '''    html+=`<tr><td class="cal-cat"><b>${label}合計</b></td>${ds.map(d=>{\n      if(!d)return '<td></td>';\n      const date=ym()+'-'+String(d).padStart(2,'0');\n      const a=sum(tx.filter(t=>t.date===date).map(t=>t.amount));\n      return `<td class="${type==='income'?'income-cell':''}"><b>${a?money(a):''}</b></td>`\n    }).join('')}<td></td></tr>`;'''
new = '''    if(type==='variable'){
      const weekTotal=sum(tx.filter(t=>ds.includes(+t.date.slice(-2))).map(t=>t.amount));
      html+=`<tr class="expense-week-total-row"><td class="cal-cat"><b>${label}合計</b></td>${ds.map(d=>{
        if(!d)return '<td class="cal-cell expense-week-total-cell"></td>';
        const date=ym()+'-'+String(d).padStart(2,'0');
        const a=sum(tx.filter(t=>t.date===date).map(t=>t.amount));
        return `<td class="cal-cell expense-week-total-cell"><b>${a?money(a):''}</b></td>`
      }).join('')}<td class="cal-cell expense-week-total-cell"><b>${money(weekTotal)}</b></td></tr>`;
    }else{
      html+=`<tr><td class="cal-cat"><b>${label}合計</b></td>${ds.map(d=>{
        if(!d)return '<td></td>';
        const date=ym()+'-'+String(d).padStart(2,'0');
        const a=sum(tx.filter(t=>t.date===date).map(t=>t.amount));
        return `<td class="${type==='income'?'income-cell':''}"><b>${a?money(a):''}</b></td>`
      }).join('')}<td></td></tr>`;
    }'''
if old not in s:
    raise SystemExit('target calendar total block not found')
s = s.replace(old, new, 1)
app.write_text(s, encoding='utf-8')

index = Path('index.html')
i = index.read_text(encoding='utf-8')
if 'v2.6.28 Stable' not in i:
    raise SystemExit('index version target not found')
i = i.replace('v2.6.28 Stable', 'v2.6.29 Stable', 1)
index.write_text(i, encoding='utf-8')

readme = Path('README.md')
r = readme.read_text(encoding='utf-8')
if '# 家計簿Webアプリ v2.6.28 Stable' not in r:
    raise SystemExit('README version target not found')
r = r.replace('# 家計簿Webアプリ v2.6.28 Stable', '# 家計簿Webアプリ v2.6.29 Stable', 1)
entry = '''\n## v2.6.29 Stable\n- PC版の支出カレンダーで「支出合計」行の高さを他の項目行と同じに統一\n- 「支出合計」行の右端「合計」列に、その週の支出合計を表示\n- 収入カレンダーを含むその他の機能・表示仕様は変更なし\n'''
pos = r.find('\n## v2.6.28 Stable')
if pos < 0:
    raise SystemExit('README insertion point not found')
r = r[:pos] + entry + r[pos:]
readme.write_text(r, encoding='utf-8')

sw = Path('sw.js')
w = sw.read_text(encoding='utf-8')
if "kakeibo-v2.6.28-stable" not in w:
    raise SystemExit('service worker cache target not found')
w = w.replace('kakeibo-v2.6.28-stable', 'kakeibo-v2.6.29-stable', 1)
sw.write_text(w, encoding='utf-8')

test = Path('tests/ui-regression.spec.js')
t = test.read_text(encoding='utf-8')
marker = "test('desktop expense weekly total row matches item row height and shows week sum'"
if marker not in t:
    t += '''\n\ntest('desktop expense weekly total row matches item row height and shows week sum', async ({ page }) => {\n  const date=currentDateKey();\n  await openApp(page,{transactions:[\n    {id:'week-total-test',date,type:'variable',category:'セブンイレブン',item:'test',amount:4321,amountExpression:'4321',memo:''}\n  ]});\n  await page.locator('#tabs [data-tab="expense"]').click();\n\n  const totalRows=page.locator('#expenseCalendarWrap .expense-week-total-row');\n  expect(await totalRows.count()).toBeGreaterThan(0);\n\n  const heights=await totalRows.evaluateAll(rows=>rows.map(row=>({\n    total:row.getBoundingClientRect().height,\n    previous:row.previousElementSibling?.getBoundingClientRect().height||0\n  })));\n  for(const pair of heights){\n    expect(Math.abs(pair.total-pair.previous)).toBeLessThanOrEqual(1);\n  }\n\n  const weekTotals=page.locator('#expenseCalendarWrap .expense-week-total-row .expense-week-total-cell:last-child');\n  await expect(weekTotals.filter({hasText:'¥4,321'})).toHaveCount(1);\n});\n'''
test.write_text(t, encoding='utf-8')
