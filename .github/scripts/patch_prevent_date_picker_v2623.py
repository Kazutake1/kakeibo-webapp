from pathlib import Path

# Prevent iPad/Safari from auto-focusing the date input when the transaction dialog opens.
app = Path('app.js')
s = app.read_text(encoding='utf-8')
old = " txDialog.showModal()}\nwindow.editTx=openTx;"
new = " txDialog.tabIndex=-1;txDialog.showModal();txDate.blur();txDialog.focus()}\nwindow.editTx=openTx;"
if old not in s:
    raise SystemExit('openTx target not found')
s = s.replace(old, new, 1)
app.write_text(s, encoding='utf-8')

# Version bump only; no other UI changes.
index = Path('index.html')
i = index.read_text(encoding='utf-8').replace('v2.6.22 Stable','v2.6.23 Stable')
index.write_text(i, encoding='utf-8')

readme = Path('README.md')
r = readme.read_text(encoding='utf-8')
r = r.replace('# 家計簿Webアプリ v2.6.22 Stable','# 家計簿Webアプリ v2.6.23 Stable',1)
entry = '\n## v2.6.23 Stable\n- iPadで支出・収入の日別カレンダーから入力画面を開いた際、日付入力欄へ自動フォーカスされて小さなネイティブカレンダーが同時表示される問題を修正\n- 日付入力欄そのものは「収支を追加」画面内に残し、必要なときだけ手動で変更可能\n- その他の機能・表示仕様は変更なし\n'
pos = r.find('\n## v2.6.22 Stable')
if pos >= 0:
    r = r[:pos] + entry + r[pos:]
else:
    r += entry
readme.write_text(r, encoding='utf-8')

sw = Path('sw.js')
w = sw.read_text(encoding='utf-8').replace('kakeibo-v2.6.22-stable','kakeibo-v2.6.23-stable')
sw.write_text(w, encoding='utf-8')

# Regression test: opening an iPad calendar cell must not leave focus on the date input.
test = Path('tests/ui-regression.spec.js')
t = test.read_text(encoding='utf-8')
marker = "test('iPad: calendar entry dialog does not auto-focus date input'"
if marker not in t:
    t += "\n\ntest('iPad: calendar entry dialog does not auto-focus date input', async ({ page }) => {\n  await page.setViewportSize({ width: 1024, height: 768 });\n  await openApp(page);\n  await page.locator('#tabs [data-tab=\"expense\"]').click();\n  const cell = page.locator('#expenseCalendarWrap .cal-cell[onclick*=\"quickAddType\"]').first();\n  await cell.click();\n  await expect(page.locator('#txDialog')).toBeVisible();\n  const activeId = await page.evaluate(() => document.activeElement?.id || '');\n  expect(activeId).not.toBe('txDate');\n});\n"
    test.write_text(t, encoding='utf-8')
