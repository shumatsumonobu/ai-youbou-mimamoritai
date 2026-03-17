# 設計メモ

## アーキテクチャ

```
[ブラウザ] → [Express サーバー] → [Google Sheets API] → スプレッドシート
                                 → [Gemini API]        → 構造化JSON出力
```

`config.json` 1ファイルで全制御。columns / filters / alerts / table / ai の5セクションが独立。
初回起動時に `config.default.json` を自動生成（デフォルトリセット用）。

## ディレクトリ構成

```
ai-youbou-mimamoritai/
├── server.js              # Express サーバー（API 7本）
├── config.json            # 全設定（カラム・アラート・テーブル・AI）
├── lib/
│   ├── sheets.js          # Google Sheets API（サービスアカウント認証）
│   ├── summarizer.js      # Gemini API（ペルソナ + 構造化出力）
│   └── config-helpers.js  # colByRole ユーティリティ
├── public/
│   ├── index.html         # メイン画面（テーブル + AI召喚 + 行コメント）
│   └── settings.html      # 設定画面（カラム・フィルター・アラート編集）
├── service-account-sheets.json  # Sheets用サービスアカウント（git管理外）
├── service-account-gemini.json  # Gemini用サービスアカウント（git管理外・任意）
├── .env                   # 環境変数（git管理外）
└── .gitignore
```

## 技術スタック

- **ランタイム**: Node.js
- **フレームワーク**: Express
- **Google Sheets API**: `googleapis`（サービスアカウント認証）
- **AI**: `@google/genai` — Gemini 2.5 Flash（構造化JSON出力）。APIキー or サービスアカウント（Vertex AI）切り替え可能
- **フロント**: Tailwind CSS CDN + vanilla JS
- **テーブル**: Tabulator（列固定・フィルタ・ソート）
- **フォント**: Zen Maru Gothic + Noto Sans JP

## API エンドポイント

| メソッド | パス | 用途 |
|---|---|---|
| GET | /api/config | フロント用設定（ai セクション除外） |
| GET | /api/config/full | 設定画面用（columns + filters + alerts） |
| GET | /api/config/default | デフォルト設定取得（リセット用） |
| POST | /api/config | 設定保存（columns + filters + alerts を上書き） |
| GET | /api/issues | スプレッドシートから全行取得 |
| GET | /api/personas | ペルソナ一覧 |
| POST | /api/summarize | AI全体サマリー生成 |
| POST | /api/comment | AI個別コメント生成 |

## config.json の構造

### columns

カラム定義の配列。各カラムには `role`（論理名）と `name`（スプシ上の列名）がある。

- `role` でコード内から参照（`status`, `owner`, `dueDate` など）
- `name` でスプレッドシートの実際の列名とマッピング
- `field` を持つカラムはプルダウン列（値・ラベル・色・グループを定義）

### alerts

アラートルールの配列。4タイプ:
- `overdue` — 期限超過（未完了のみ）
- `nearDeadline` — 期限間近（日数指定）
- `statusMatch` — 特定ステータスに一致
- `fieldMatch` — 特定フィールド値に一致

`scoreColors` でスコア表示の色しきい値を定義。

### filters

メイン画面に表示するフィルター項目の role 配列。`field.values` を持つカラムはチェックボックス、持たないカラムはセレクトボックスで自動表示。

### table

- `visibleColumns` — テーブルに表示するカラムの role 配列
- `frozenColumns` — 固定列の role 配列

### ai

- `sendColumns` — AIに送信するカラムの role 配列
- `model` — Gemini モデル名
- `generation` — temperature / topP / topK
- `thinkingBudget` — Gemini の思考バジェット

## スプレッドシートの列構成（デフォルト設定）

デフォルトでは8列。AIには分析に必要な7列を送信:

| 列名 | role | AIに送信 |
|---|---|---|
| No | id | - |
| タイトル | title | o |
| 担当者 | owner | o |
| ステータス | status | o |
| 優先度 | priority | o |
| カテゴリ | client | o |
| 期限 | dueDate | o |
| 四半期 | quarter | o |

列名はスプレッドシートのヘッダーと一致させる。設定画面または config.json で変更可能。

## ステータスの値（デフォルト設定）

| 値 | 分類 |
|---|---|
| 未着手 | 未完了 |
| 作業中 | 未完了 |
| レビュー | 未完了 |
| 完了 | 完了 |

## ペルソナ

4体。summarizer.js に定義:

| キー | キャラ | 口調のルール |
|---|---|---|
| dog | 忠犬 | 全文に鳴き声必須。危険→ワンワンワン、心配→クゥーン |
| oni | 鬼マネージャー | 敬語禁止。命令形・キレ口調のみ。呼び捨て |
| osaka | 関西のおばちゃん | 全文関西弁。標準語禁止。ツッコミ必須 |
| gal | ギャル | ギャル語。〜じゃん・〜くない？絵文字禁止 |

## コンフィグ化の設計経緯

元々はカラム名・ステータス値がハードコードされていた。他ユーザーが自分のスプレッドシートで使えるよう、`config.json` に集約。

変更前のハードコード箇所:
- sheets.js: `keep` 配列、`Feature` フィルタ
- summarizer.js: プロンプト内のステータス値、スキーマ説明のカラム名
- index.html: テーブル列定義、ステータスチェックボックス、色分け、要注意判定

全て config.json から動的に生成する方式に変更済み。設定画面（settings.html）からブラウザ上で編集可能。
