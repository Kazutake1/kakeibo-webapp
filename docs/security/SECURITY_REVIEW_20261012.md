# 家計簿アプリ セキュリティ改善・検証報告（2026-10-12）

## 基準と作業境界

- 再取得したmain: `a92bae64901d17336c533198ee0132baf3d74019`（v2.6.74）。
- 専用ブランチ: `security/budget-session-validation-20261012`。
- PR #22: `security/actions-node24-20261012` / `5f6523a2b3163603be60ff869dd9940e28aad94f`。未マージで、既存のSHA固定・Node 24更新を再変更していない。
- 本番の家計簿データ・Supabase設定・RLSを変更していない。先行CIの模擬通信漏れについては下記の検証補足を参照。mainへのマージ・本番公開は実施しない。
- 保存キー・JSON形式（transactions / budgets / categories）とクラウドの世代番号方式を維持。候補バージョンは未公開v2.6.75。

## 調査と安全な修正

### DEFAULT_BUDGET

元の値は初期値だけではなく、不足項目の補完と「端末に意味のあるデータがあるか」の同期判定にも使われていた。予算のない月は直前月、直前月もなければ旧初期値を使う。閲覧時に初期予算がメモリ上だけに生成され、保存されていない利用者も存在する。

`localStorage`の不在や空のbudgetsだけでは、新規利用者と未保存の旧利用者を確実に識別できない。初期値を0へ置換すると固定費・収支・予算補完・同期選択が変わるため、実施していない。

今回の分離:

- `LEGACY_DEFAULT_BUDGET`: 元の金額をそのまま保持した、全階層で凍結した互換基準。
- `initialBudgetSource()`: 初期値生成専用。毎回コピーを返す。
- `legacyBudgetValue()`: 不足項目補完専用。
- `isLegacyBudgetValue()`: 同期時の比較専用。

新規用の別金額テンプレートは未導入。金額・保存形式・未保存利用者の計算は変更しない。過去の削除済み項目に正の予算が残る場合は、現在のカテゴリー一覧外でも同期の選択確認を出せるよう修正した。既存のデフォルト予算だけのデータ判定は互換性のため維持している。

今後新規用金額を変える場合は、利用者を明示的に識別する設計と旧予算の保護手順をChatで先に承認する。保存形式の変更なしという現条件では、自動で新旧を判定する移行を採用しない。

### 認証・クラウド同期の競合

合成データによる再現で、ログアウト前の初回クラウド読込がログアウト後に端末データへ反映される問題を確認した。修正後、通信開始時のユーザーID・セッション世代と現在状態が一致しない応答を捨てる。

同じ保護をログインの遅延応答、ユーザー情報取得の失敗、同期競合の選択待ち、手動同期、アップロード完了、401再認証に適用した。ログアウト時には選択ダイアログと待機中の同期を終了する。別タブのログアウト通知は初回復元の待機前に登録する。保存済みトークンは文字列型を確認する。

一時的な通信障害でログイン情報を削除する仕様にはしていない。認証トークンが無効になった場合のログイン情報削除も、家計簿データを削除しない。ログアウト前に既にサーバーへ送信済みの書込は取り消せないため、今回の保護は遅延応答・旧アカウント状態を現在画面へ反映しない範囲である。

## npm audit

`npm ci --no-audit --no-fund`後に`npm audit --json`を実施。ロック済み依存関係の検出脆弱性は0件（critical / high / moderate / low / infoすべて0）。Playwrightの実解決バージョンは1.62.1。依存バージョンは変更していない。`audit fix`および`audit fix --force`は使用していない。

新しい検証用CIでも`npm audit --audit-level=low`を実行する。監査の0件は実行時点の公開アドバイザリーに対する結果で、アプリ全体の無脆弱性を意味しない。

## CSP導入の影響調査（本番未導入）

調査時のHTMLイベント属性は17テンプレート箇所。行数ではなく、動的に生成するソース上の属性出現数であり、実際の項目数に応じて生成数は増える。

| ファイル | HTMLのonclick属性 | 主な移行対象 |
|---|---:|---|
| index.html | 0 | 6本の外部JavaScriptはすべて同一オリジン |
| app-ui.js | 13 | 支出フィルター、編集・削除、予算折畳、予算編集、日別項目、収入詳細、カレンダーセル |
| app-daily.js | 2 | 日別履歴の編集・削除 |
| app-items.js | 2 | 項目の編集・削除 |
| app-charts.js | 0 | グラフ凡例はHTMLイベント属性なし |

JavaScriptで関数を代入する`element.onclick = () => ...`は、HTML文字列に含めるonclickとは別であり、HTML属性と同じ移行対象として数えていない。インラインscript・eval・Functionによるコード生成は確認されなかった。

インラインstyleはソース上22箇所（index 7 / app-ui 13 / app-charts 2）。加えてグラフ・進捗・レイアウトでstyleプロパティを使用する。厳格なstyle-srcも同時に適用すると見た目が変わるため、別工程として調査が必要。

検証専用のレスポンスに`script-src 'self'; script-src-attr 'none'`を付加し、外部スクリプトと通常ナビが動作する一方、HTML属性による予算編集がブロックされることを確認するテストを追加した。これはCSP導入完了を示すテストではなく、現構成で壊れる操作を明示する検証。

推奨する次工程（未実施）:

1. 動的HTML操作を機能単位でdata属性＋イベント委譲へ移行し、編集・削除・日付移動の回帰を固定。
2. 開発環境でscript-src-attr制限を確認し、styleの移行を別に扱う。
3. 同一オリジンのスクリプト・PWA Worker・画像と、必要なSupabase接続先だけを許可するポリシーを設計。
4. HTTPヘッダーを制御できる構成でReport-Onlyを検証してから強制ポリシーを導入。Report-Onlyはmetaタグでは利用できないため、GitHub Pagesにmetaを足すだけでは同じ手順にならない。

全17箇所の移行と公開基盤の変更は、ユーザーの承認なしで実装していない。

## 検証内容

既存72テストを削除せず、25テストを追加。全97テストをChromiumとWebKitの各プロジェクトで実行する（計194件）。既存のiPad専用テストが両ブラウザを明示起動する部分も維持。

- 予算: 凍結・コピー、未保存初期値、部分保存、明示0円、過去月、前月継承、過去項目と同期判定。
- XSS: 引用符・img/onerror・コード文字列を項目名・取引ID・内容・メモへ入力。iPhone幅とiPad幅で一覧・グラフ凡例・収支詳細等を描画し、実行されずHTMLが生成されないことを確認。
- バックアップ: 実際のダウンロード→JSON読込、過去取引・予算の一致、認証情報の非混入、不正JSONと保存容量失敗時の既存データ維持。
- 認証: 再読込後の維持、同時更新の一本化、トークン回転、401失効と503保持、不正型、ログアウト後の遅延ログイン、別ユーザー情報の競合、別タブログアウト。
- 同期: 既存の世代番号競合テスト、初回読込とログアウト、選択キャンセル、旧形式payload、端末保存失敗時のロールバック。同一ユーザーの別タブ更新中の初回読込・送信、ユーザー切替時の送信停止、401前後の別タブ更新を追加。
- CSP: 制限を試す検証レスポンスだけにポリシーを挿入。

認証・セキュリティテストではService Workerをblockして、Supabase宛通信を遮断・模擬する。通常UI・PWAテストのWorkerは有効のまま。実ユーザー・実端末のローカルデータや本番DBは使用していない。本番RLSの実データ検証や実機Safari検証は実施していない。

ローカルの構文・バージョン確認とnpm auditは成功。ブラウザ本体の取得が環境制限で失敗したため、全面ブラウザ回帰は専用ブランチのGitHub Actionsで実行する。

mainの予算計算と修正後の計算を、未保存・部分保存・0円・独自項目・過去項目を含む300個の合成fixtureで比較し、4つの対象月の結果がすべて一致した。`npm audit --omit=dev`でも検出脆弱性は0件だった。

## 最終検証結果とPR

- 実装・全面検証SHA: `c4e160092c45232a76eba7ee097aef0883036ad4`。
- PRの通常UI CI: https://github.com/Kazutake1/kakeibo-webapp/actions/runs/38251931300 （194件成功）。
- PRの専用CI: https://github.com/Kazutake1/kakeibo-webapp/actions/runs/38251931130 （194件成功＋以前タイムアウトしたケースの12回繰り返し成功）。
- pushの専用CI: https://github.com/Kazutake1/kakeibo-webapp/actions/runs/38251922652 （194件成功＋12回繰り返し成功）。
- npm ci・npm audit・構文・バージョン確認も成功。失敗時の自動retryは追加していない。
- PR #23: https://github.com/Kazutake1/kakeibo-webapp/pull/23 （未マージ）。
- 最新mainを終了前に再取得し、`a92bae64901d17336c533198ee0132baf3d74019`のままであることを確認。
- 先行CIはUbuntuのAzureミラーが約100KB/秒となり環境準備が停滞。Ubuntu 24.04、公式HTTPSミラー、依存準備とブラウザ取得の分離、各5分上限を専用workflowに設定した後の上記CIで成功。準備段階のタイムアウトをアプリのテスト失敗と区別する。
- この報告書・引き継ぎファイルの追記は、検証済みアプリコード・テスト・依存関係を変更しない。

### 最終レビューで見つかった問題と追加修正

初回の184件成功後、PRの別実行で182件成功・2件タイムアウトを確認した。最終レビューでは、同一ユーザーの別タブでの通常の認証更新も世代変更として扱い、送信が止まって「同期中」の表示が残る問題を再現した。

認証世代をログアウト・アカウント境界に限定し、同一ユーザーのトークン更新は進行中の処理を継続するよう修正した。401時は別タブで更新済みのトークンを利用し、認証更新を待つ途中で回転した場合も再試行する。別アカウントへの切替では古い送信を止め、同期確認が必要な状態を表示する。合成再現では、同一ユーザーは送信1回・同期済み、アカウント切替は送信0回・同期確認となった。

タイムアウトは失敗traceを解析した。認証ケースではService Workerによって一部のGETがpage.routeの模擬通信を迂回し、本番APIの401応答から別の認証更新が始まってテストの待機と競合した。合成の無効トークンのみを使用し、実ユーザー認証・本番の家計簿データの読込・書込は行っていない。修正後は認証／セキュリティの模擬テストだけWorkerをblockし、起動時の同期完了を待ってから制御した更新を開始する。

iPadの失敗traceでは個別の検証は通り、3画面幅×5ページ×5タブの連続確認中に30秒の総時間を超えた。この複合ケースだけ60秒にし、個別のexpectは7秒のまま、全ての表示・位置・ヒット確認を維持した。以前タイムアウトした認証ケースとWebKit iPadケースを両プロジェクトで各3回（計12件）繰り返し、すべて成功した。

### 修正ファイル

| 区分 | ファイル |
|---|---|
| 予算互換性 | app-data.js |
| 認証・同期保護 | app-sync.js |
| 全面ブラウザ構成 | playwright.config.js |
| 追加の25検証・模擬通信分離 | tests/security-validation.spec.js / tests/auth-session.spec.js |
| 複合iPadテストの時間調整 | tests/ipad-navigation.spec.js |
| 今回専用CI | .github/workflows/security-validation.yml |
| 未公開候補のバージョン・キャッシュ整合 | package.json / package-lock.json / index.html / sw.js / README.md / CHANGELOG.md |
| 報告・Chat引き継ぎ | docs/security/SECURITY_REVIEW_20261012.md / docs/security/CHAT_HANDOFF_20261012.md |

PR #22のworkflowとCSSは変更していない。既存テストの削除・検証条件の削減はしていない。認証テストは通信分離と開始条件、iPadの複合テストは全体制限だけを調整した。

## 未解決事項とデータ保護の注意

- 新規利用者だけの初期値変更・旧値の公開コードからの除去は、新旧判定と移行の承認待ち。
- CSP本番導入とonclickの全移行は未実施。
- ログイン維持のためlocalStorageにセッションを保持する方式を維持。JavaScriptから読めるためXSSに対する残存リスクがある。同じ`kazutake1.github.io`の別アプリも同一オリジンであり、URLのパスやキー名だけでは隔離できない。独立オリジンやサーバーを含む変更は別設計・承認が必要。
- 既存のインポート正規化には取引5万件、項目名80文字、メモ500文字、ファイル10MB等の制限がある。不正データの正規化や制限超過は既存仕様。今回検証したのは正常な現形式の合成データの往復であり、任意の制限超過バックアップの完全復元は保証しない。上限変更や移行は未実施。
- PR #22と今回PRは別管理。両方ともmainへのマージ・本番公開はユーザー承認後。

## 参考資料

- Supabase Auth sessions: https://supabase.com/docs/guides/auth/sessions
- Supabase Advanced guide: https://supabase.com/docs/guides/auth/server-side/advanced-guide
- Supabase changelog: https://supabase.com/changelog.md（今回のホスト型Auth利用に直接適用する破壊的変更は確認されなかった）
- MDN script-src-attr: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src-attr
- MDN localStorage: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
- MDN CSP Report-Only: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy-Report-Only

- Playwright network routing / Service Workers: https://playwright.dev/docs/network#missing-network-events-and-service-workers
- Playwright per-test timeout: https://playwright.dev/docs/test-timeouts
