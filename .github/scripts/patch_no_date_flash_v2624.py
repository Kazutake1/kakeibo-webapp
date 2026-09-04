from pathlib import Path

# Prevent the transaction date input from becoming the dialog's automatic focus target.
# tabindex=-1 keeps the control fully usable by touch/click while removing it from sequential/autofocus targeting.
index = Path('index.html')
i = index.read_text(encoding='utf-8')
old = '<input type="date" id="txDate" required>'
new = '<input type="date" id="txDate" tabindex="-1" required>'
if old not in i:
    raise SystemExit('txDate target not found')
i = i.replace(old, new, 1)
i = i.replace('v2.6.23 Stable','v2.6.24 Stable')
index.write_text(i, encoding='utf-8')

# Keep existing focus handoff; the important change is that txDate can no longer be auto-focused during showModal().
app = Path('app.js')
s = app.read_text(encoding='utf-8')
if 'txDialog.showModal();txDate.blur();txDialog.focus()' not in s:
    raise SystemExit('current openTx focus logic not found')
app.write_text(s, encoding='utf-8')

readme = Path('README.md')
r = readme.read_text(encoding='utf-8')
r = r.replace('# 家計簿Webアプリ v2.6.23 Stable','# 家計簿Webアプリ v2.6.24 Stable',1)
entry = '\n## v2.6.24 Stable\n- iPadで「収支を追加」画面を開く際、日付入力欄をダイアログの自動フォーカス対象から外し、小さなネイティブカレンダーが一瞬でも表示されないよう修正\n- 日付入力欄は画面内に残し、タップすれば従来どおり日付変更可能\n- その他の機能・表示仕様は変更なし\n'
pos = r.find('\n## v2.6.23 Stable')
if pos >= 0:
    r = r[:pos] + entry + r[pos:]
else:
    r += entry
readme.write_text(r, encoding='utf-8')

sw = Path('sw.js')
w = sw.read_text(encoding='utf-8').replace('kakeibo-v2.6.23-stable','kakeibo-v2.6.24-stable')
sw.write_text(w, encoding='utf-8')

# Regression: date input must be excluded from automatic dialog focus while remaining enabled and editable.
test = Path('tests/ui-regression.spec.js')
t = test.read_text(encoding='utf-8')
marker = "test('iPad: transaction date cannot be automatic dialog focus target'"
if marker not in t:
    t += "\n\ntest('iPad: transaction date cannot be automatic dialog focus target', async ({ page }) => {\n  await page.setViewportSize({ width: 1024, height: 768 });\n  await openApp(page);\n  await page.locator('#tabs [data-tab=\"expense\"]').click();\n  const cell = page.locator('#expenseCalendarWrap .cal-cell[onclick*=\"quickAddType\"]').first();\n  await cell.click();\n  await expect(page.locator('#txDialog')).toBeVisible();\n  const date = page.locator('#txDate');\n  await expect(date).toBeEnabled();\n  expect(await date.getAttribute('tabindex')).toBe('-1');\n  const activeId = await page.evaluate(() => document.activeElement?.id || '');\n  expect(activeId).not.toBe('txDate');\n});\n"
    test.write_text(t, encoding='utf-8')
