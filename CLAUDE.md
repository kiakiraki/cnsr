# CNSR - 画像モザイク処理アプリケーション

## プロジェクト概要

CNSRは、Nuxt.js/Vue.jsで構築された画像処理Webアプリケーションです。ユーザーがアップロードした画像に対して、選択した領域にモザイク処理や黒塗り/白塗り処理を適用できるプライバシー保護を目的としたツールです。

## 主要機能

- **画像アップロード**: ドラッグ&ドロップ、クリック、Ctrl+V（ペースト）に対応
- **処理モード**:
  - モザイク処理（ピクセル化効果）
  - 黒塗り処理（情報隠蔽）
  - 白塗り処理（背景透明化）
- **範囲選択**: マウス/タッチで処理領域を選択
- **アンドゥ機能**: 最大64回の処理を元に戻し可能
- **画像ダウンロード**: PNG形式での保存
- **レスポンシブデザイン**: モバイル・デスクトップ対応
- **ダークモード**: システム設定に応じた自動切り替え

## 技術スタック

- **フレームワーク**: Nuxt.js 4.0.1 (SSR無効化)
- **言語**: TypeScript, Vue 3 Composition API
- **テスト**: Vitest + Vue Test Utils
- **コード品質**: ESLint + Prettier
- **デプロイ**: Cloudflare Pages

## ファイル構成

```
├── components/
│   └── ImageMosaic.vue     # メイン画像処理コンポーネント
├── test/                   # テストスイート
│   ├── coordinate-calculation.test.ts
│   ├── state-management.test.ts
│   ├── undo-functionality.test.ts
│   ├── download-functionality.test.ts
│   └── setup.ts
├── app.vue                 # ルートコンポーネント
├── nuxt.config.ts         # Nuxt設定（Cloudflare Pages用）
├── vitest.config.ts       # テスト設定
└── eslint.config.js       # ESLint設定
```

## 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# テスト実行
npm run test

# コード品質チェック
npm run lint

# フォーマット
npm run format

# ビルド
npm run build
```

## 重要な技術的詳細

1. **SSR無効化**: `ssr: false` でクライアントサイドレンダリング
2. **Canvas API**: 画像処理にHTML5 Canvasを使用
3. **履歴管理**: 最大64回のアンドゥ機能を実装
4. **ファイル処理**: 複数の画像形式に対応（JPEG, PNG, WebP等）
5. **レスポンシブ**: タッチデバイスでの操作も考慮

## Claude開発時の注意点

- Canvas操作が多用されているため、ブラウザAPI前提のコード
- 状態管理はVue 3のComposition APIを使用
- テストカバレッジが重要（座標計算、状態管理、アンドゥ機能）
- Cloudflare Pages用の設定が含まれている
- TypeScriptでの型安全性を重視
- プライバシー保護ツールとしての性質を理解して開発する

## 実行環境

- Node.js 18以上
- モダンブラウザ（Canvas API, File API対応）
- デスクトップ・モバイル両対応
