# 画像モザイク処理アプリケーション

Vue.js/Nuxt.jsで構築された画像処理Webアプリケーションです。ユーザーがアップロードした画像に対して、選択した領域にモザイク処理や黒塗り処理を適用できます。

## 機能

- **画像アップロード**: ドラッグ&ドロップまたはクリックで画像をアップロード
- **処理モード選択**: 
  - モザイク処理: 選択領域にピクセル化モザイク効果を適用
  - 黒塗り処理: 選択領域を黒で塗りつぶし
- **範囲選択**: マウスまたはタッチで処理範囲を選択
- **アンドゥ機能**: 最大64回の処理を元に戻し
- **リセット機能**: 元画像に戻す
- **画像ダウンロード**: 処理後の画像をPNG形式でダウンロード
- **レスポンシブデザイン**: モバイル・デスクトップ対応
- **ダークモード**: システム設定に応じた自動切り替え

## 技術スタック

- **フレームワーク**: Nuxt.js 3.17.6
- **言語**: TypeScript, Vue 3 Composition API
- **テスト**: Vitest + Vue Test Utils
- **リンター**: ESLint + Prettier
- **開発ツール**: Vite
- **デプロイ**: Cloudflare Pages

## セットアップ

依存関係をインストール:

```bash
npm install
```

## 開発

開発サーバーを起動 (`http://localhost:3000`):

```bash
npm run dev
```

## テスト

単体テストを実行:

```bash
# テストを実行
npm run test

# テストを一回だけ実行
npm run test:run
```

## コード品質

リンターとフォーマッターを実行:

```bash
# ESLintによるコードチェック
npm run lint

# ESLintによる自動修正
npm run lint:fix

# Prettierによるフォーマット
npm run format

# フォーマットチェック
npm run format:check
```

## プロダクション

本番用ビルド:

```bash
npm run build
```

ローカルでプロダクションビルドをプレビュー:

```bash
npm run preview
```

## デプロイ

このアプリケーションはCloudflare Pagesにデプロイされています。GitHubリポジトリと連携し、mainブランチへのプッシュ時に自動デプロイが実行されます。

## プロジェクト構成

```
├── components/
│   └── ImageMosaic.vue     # メインの画像処理コンポーネント
├── test/                   # テストファイル
│   ├── coordinate-calculation.test.ts
│   ├── state-management.test.ts
│   ├── undo-functionality.test.ts
│   └── setup.ts
├── app.vue                 # ルートコンポーネント
├── nuxt.config.ts         # Nuxt設定
├── vitest.config.ts       # テスト設定
└── eslint.config.js       # ESLint設定
```
