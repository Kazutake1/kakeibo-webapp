from pathlib import Path

# v2.6.27: match the gap above expense history to the existing gap
# between the mobile monthly calendar and the daily expense card.
style = Path('style.css')
s = style.read_text(encoding='utf-8')
marker = '/* v2.6.27: match expense history spacing to mobile calendar spacing */'
if marker not in s:
    s += '\n\n' + marker + '\n@media(max-width:700px){\n  .expense-history-card{margin-top:12px}\n}\n'
style.write_text(s, encoding='utf-8')

index = Path('index.html')
i = index.read_text(encoding='utf-8')
if 'v2.6.26 Stable' not in i:
    raise SystemExit('index version target not found')
i = i.replace('v2.6.26 Stable', 'v2.6.27 Stable')
index.write_text(i, encoding='utf-8')

readme = Path('README.md')
r = readme.read_text(encoding='utf-8')
if '# 家計簿Webアプリ v2.6.26 Stable' not in r:
    raise SystemExit('README version target not found')
r = r.replace('# 家計簿Webアプリ v2.6.26 Stable', '# 家計簿Webアプリ v2.6.27 Stable', 1)
entry = '\n## v2.6.27 Stable\n- スマホ・iPadの支出ページで、「支出の項目」と「支出履歴」の間隔を、カレンダーと「支出の項目」の間隔と同じ12pxに統一\n- その他の機能・表示仕様は変更なし\n'
pos = r.find('\n## v2.6.26 Stable')
if pos >= 0:
    r = r[:pos] + entry + r[pos:]
else:
    r += entry
readme.write_text(r, encoding='utf-8')

sw = Path('sw.js')
w = sw.read_text(encoding='utf-8')
if 'kakeibo-v2.6.26-stable' not in w:
    raise SystemExit('service worker cache target not found')
w = w.replace('kakeibo-v2.6.26-stable', 'kakeibo-v2.6.27-stable', 1)
sw.write_text(w, encoding='utf-8')

test = Path('tests/ui-regression.spec.js')
t = test.read_text(encoding='utf-8')
test_marker = "test('mobile expense history gap matches calendar gap'"
if test_marker not in t:
    t += "\n\ntest('mobile expense history gap matches calendar gap', async ({ page }) => {\n  await page.setViewportSize({ width: 390, height: 844 });\n  await openApp(page);\n  await page.locator('#mobileNav [data-tab=\"expense\"]').click();\n  const spacing = await page.evaluate(() => {\n    const calendar = document.getElementById('expenseMonthCalendar');\n    const history = document.querySelector('.expense-history-card');\n    return {\n      calendarBottom: getComputedStyle(calendar).marginBottom,\n      historyTop: getComputedStyle(history).marginTop\n    };\n  });\n  expect(spacing.calendarBottom).toBe('12px');\n  expect(spacing.historyTop).toBe(spacing.calendarBottom);\n});\n"
test.write_text(t, encoding='utf-8')
