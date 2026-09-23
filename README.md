# 家計簿Webアプリ v2.6.72 Stable

Excel家計簿をベースにした、iPhone・iPad・PC・Mac対応のレスポンシブPWAです。

公開版: [https://kazutake1.github.io/kakeibo-webapp/](https://kazutake1.github.io/kakeibo-webapp/)

## 主な機能

- 収入・税金・貯蓄・自己投資・固定費・特別費・変動費の月単位管理
- 支出カレンダー、収入推移、支出構成、変動費週間比較の表示
- 予算設定、計算式による金額入力、取引の追加・編集・削除
- 端末内保存と、ログイン時のSupabaseクラウド同期
- JSON形式のバックアップ書き出し・読み込み
- ライト／ダークモード、PWA、オフライン表示

## ファイル構成

| ファイル | 役割 |
| --- | --- |
| `index.html` | 画面構造と各CSS・JavaScriptの読み込み |
| `style-base.css` | 基礎レイアウトとレスポンシブ表示 |
| `style-components.css` | 共通部品、カレンダー、グラフ周辺 |
| `style-theme.css` | ライト／ダークテーマ |
| `style-pages.css` | 画面別の調整 |
| `app-data.js` | データ構造、正規化、端末内保存 |
| `app-sync.js` | ログインとSupabase同期 |
| `app-charts.js` | グラフの集計と描画 |
| `app-ui.js` | 画面描画とユーザー操作 |
| `sw.js` | PWAキャッシュとオフライン処理 |
| `manifest.json`、`icon-*.png` | PWA設定とアイコン |
| `tests/` | Playwright回帰テスト |
| `scripts/sync-version.mjs` | バージョン番号の同期と検証 |
| `CHANGELOG.md` | バージョンごとの変更履歴 |

## データ保存と同期

- 家計簿データはブラウザの`localStorage`へ`kakeibo-v1`として保存されます。
- ログイン中はSupabaseの本人専用データと同期します。
- 認証情報は有効期限前に自動更新し、一時的な通信エラーでもログイン状態を保持します。
- ログインフォームは端末のパスワード管理機能による自動入力に対応します。
- クラウド同期では世代番号を確認し、古いデータによる無確認の上書きを防ぎます。
- 家計簿の実データはGitHubリポジトリへ保存しません。
- JSONバックアップを利用して、手動で書き出し・復元できます。

## 開発環境

- Node.js 20
- npm
- Playwright（Chromium・WebKit）
- Python 3（ローカルテスト用Webサーバー）

```bash
npm ci
npx playwright install chromium webkit
npm test
```

GitHub Actionsでは、JavaScriptの構文、バージョン同期、ファイル構成、Chromium・WebKitでのUI回帰を確認します。

## バージョン管理

バージョン番号の基準は`package.json`です。次のリリースへ更新するときは、変更履歴を`CHANGELOG.md`へ追加してから実行します。

```bash
npm run version:set -- 2.6.71
npm run version:check
```

`index.html`、`sw.js`、`package-lock.json`、READMEの表示バージョンが同期され、`CHANGELOG.md`に同じバージョンの見出しがあることも検証されます。

## 公開手順

1. GitHubの`main`を基準に作業ブランチを作成する。
2. 指定箇所だけを変更し、`CHANGELOG.md`へ履歴を追加する。
3. バージョン同期と回帰テストを実行する。
4. Pull RequestのGitHub Actions成功後に`main`へ統合する。
5. GitHub Pagesへの反映と公開版のアセットを確認する。

## 変更履歴

全バージョンの変更内容は[CHANGELOG.md](CHANGELOG.md)を参照してください。
