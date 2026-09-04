from pathlib import Path

# Hide only the small native date input shown under the selected date on smartphone pages.
style = Path('style.css')
s = style.read_text(encoding='utf-8')
marker = '/* v2.6.21: hide small native date picker on smartphone daily pages */'
if marker not in s:
    s += '\n\n' + marker + '\n@media(max-width:700px){\n  .daily-native-date{display:none!important}\n}\n'
style.write_text(s, encoding='utf-8')

index = Path('index.html')
i = index.read_text(encoding='utf-8')
i = i.replace('v2.6.20 Stable', 'v2.6.21 Stable')
index.write_text(i, encoding='utf-8')

sw = Path('sw.js')
w = sw.read_text(encoding='utf-8')
w = w.replace("kakeibo-v2.6.20-stable", "kakeibo-v2.6.21-stable")
sw.write_text(w, encoding='utf-8')

readme = Path('README.md')
r = readme.read_text(encoding='utf-8')
r = r.replace('# 家計簿Webアプリ v2.6.20 Stable', '# 家計簿Webアプリ v2.6.21 Stable', 1)
entry = '## v2.6.21 Stable\n- スマホ版の支出・収入ページで、選択日の下に表示されていた小さな日付カレンダー入力を非表示\n- メインの月間カレンダー、日付選択、入力画面、その他の機能・表示仕様は変更なし\n\n'
anchor = '## v2.6.20 Stable\n'
if entry not in r:
    r = r.replace(anchor, entry + anchor, 1)
readme.write_text(r, encoding='utf-8')

# Guardrails: no application logic changes.
assert marker in s
assert '.daily-native-date{display:none!important}' in s
assert 'v2.6.21 Stable' in i
assert "kakeibo-v2.6.21-stable" in w
assert '## v2.6.21 Stable' in r
