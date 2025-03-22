# AI占いサービス (AI Fortune Service)

AIを活用した占いサービスのシステムです。お客様の購入情報をもとに、AI（Claude）が個別の占い結果を自動生成し、美しいPDFとしてお届けします。

![AI占いサービスの概要](https://placekitten.com/800/400)

## 👋 はじめに

このガイドでは、非エンジニアの方でも簡単にAI占いサービスをセットアップして運用できるよう、分かりやすく説明します。

**このサービスでできること：**

- お客様がECサイト（Stores）で商品を購入すると自動的に処理が始まります
- 個人情報やご相談内容を入力するフォームをお客様に自動送信します
- お客様の回答をもとにAIが占い結果を生成します
- 生成した結果をPDFに変換し、自動的にメール送信します

## 📋 必要なもの

サービスを開始するには以下が必要です：

1. **Anthropic社のClaude APIキー** - AI占い生成のため
2. **Stores.jpアカウント** - 決済処理のため
3. **Gmailアカウント** - メール送信のため

## 🚀 はじめ方（非エンジニア向け手順）

### ステップ1: システムをインストールする

技術担当者に依頼して以下の作業を行ってもらいましょう：

```bash
# システムのインストール
git clone https://github.com/yourusername/ai-fortune-service.git
cd ai-fortune-service
npm install
```

### ステップ2: 必要なAPIキーを取得する

#### Claude APIキーの取得方法

1. [Anthropicのウェブサイト](https://www.anthropic.com/)にアクセスします
2. アカウントを作成し、ログインします
3. ダッシュボードから「API Keys」を選択します
4. 「Create API Key」ボタンをクリックします
5. キーの名前（例：「AI占いサービス用」）を入力し、作成します
6. 表示されたAPIキーをコピーして安全な場所に保存します（⚠️ このキーは二度と表示されません）

#### Storesとの連携方法

1. [Stores管理画面](https://stores.jp/)にログインします
2. 「設定」→「Webhook設定」を選択します
3. 「Webhook URL」に以下のURLを入力します：

   ```plaintext
   https://あなたのサイトのURL/webhook/stores
   ```

4. イベントタイプで「注文完了時」を選択します
5. 「保存」をクリックします

#### Gmailアカウントの設定

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセスします
2. 新しいプロジェクトを作成します
3. 「APIとサービス」→「ライブラリ」を選択します
4. 「Gmail API」を検索して有効にします
5. 「認証情報」ページで「認証情報を作成」→「OAuth クライアント ID」を選択します
6. アプリケーションタイプで「ウェブアプリケーション」を選択します
7. 承認済みのリダイレクトURIに以下を追加します：

   ```plaintext
   https://あなたのサイトのURL/auth/google/callback
   ```

8. 「作成」をクリックし、表示されたクライアントIDとクライアントシークレットを保存します
9. さらに、「サービスアカウント」を作成し、JSONキーをダウンロードします

### ステップ3: 環境設定ファイルを作成する

`.env`ファイルを作成し、以下の情報を入力します：

```env
# 基本設定
PORT=3000
NODE_ENV=production

# Claude API設定
CLAUDE_API_KEY=your_claude_api_key_here

# Google API設定（Gmail送信用）
GMAIL_CLIENT_ID=your_gmail_client_id_here
GMAIL_CLIENT_SECRET=your_gmail_client_secret_here
GMAIL_REFRESH_TOKEN=your_gmail_refresh_token_here

# Stores設定
STORES_API_KEY=your_stores_api_key_here
STORES_SECRET=your_stores_secret_here

# ストレージ設定（PDF保存用）
STORAGE_SERVICE_KEY=your_storage_key_here

# メール設定
EMAIL_FROM=your_email@gmail.com
EMAIL_FROM_NAME=AI占いサービス

# システム設定
ENABLE_SCHEDULER=true
SCHEDULER_CRON=*/30 * * * *
```

### ステップ4: サービスを起動する

```bash
npm start
```

サーバーが正常に起動すると、ターミナルに「サーバーが起動しました（ポート: 3000）」というメッセージが表示されます。

## 🧙‍♀️ サービスの使い方

### 1. 占いサービス商品をStoresで設定する

1. Stores管理画面から新しい商品を作成します
2. 商品名、価格、説明を設定します
3. 商品の説明に占いの種類（総合運、恋愛運、金運など）を明記します
4. 商品を公開します

### 2. お客様の購入から結果送信までの流れ

1. お客様が商品を購入すると、自動的にシステムが起動します
2. お客様のメールアドレスに入力フォームが送信されます
3. お客様がフォームに回答すると、AIが占い結果を生成します
4. システムが占い結果をPDFに変換し、お客様にメール送信します
5. 管理者にも処理完了の通知が送られます

### 3. 管理画面の使い方

管理画面にアクセスするには：

1. ブラウザで `https://あなたのサイトのURL/admin` にアクセスします
2. ログイン情報を入力します（初期設定：ユーザー名 `admin`、パスワード `password`）
3. 管理画面から以下の操作が可能です：
   - 注文状況の確認
   - 占い結果の閲覧
   - 手動で占い結果の再生成
   - 顧客情報の管理
   - システム設定の変更

## 🔄 占いテンプレートのカスタマイズ

占い結果の文体やスタイルをカスタマイズするには：

1. 管理画面の「テンプレート設定」を開きます
2. 「プロンプトテンプレート」を選択します
3. 占いの種類（総合運、恋愛運など）ごとにAIへの指示文を編集できます
4. テンプレートには以下の変数が使えます：
   - `{{name}}` - お客様の名前
   - `{{birthDate}}` - お客様の生年月日
   - `{{consultation}}` - お客様の相談内容

## 📱 お客様への案内文例

ECサイトの商品説明やメール案内に使える文例：

```plaintext
【AI占い師による個別鑑定】
あなたの生年月日と現在のお悩みをもとに、最先端AIが詳細な占い結果を作成します。
購入後、入力フォームのリンクをメールでお送りしますので、必要事項をご記入ください。
結果は24時間以内に美しいPDFレポートとしてメールでお届けします。
```

## ⚠️ よくあるトラブルと解決法

### 「APIキーが無効です」というエラーが表示される

- Claude APIキーが正しく設定されているか確認してください
- APIキーの先頭と末尾に余分なスペースがないことを確認してください

### フォームリンクがお客様に届かない

- Gmail設定が正しいか確認してください
- お客様のメールアドレスが正しいか確認してください
- 迷惑メールフォルダを確認するようお客様に案内してください

### 占い結果が生成されない

- スケジューラーが有効になっているか確認してください
- ログファイル（`logs/error.log`）でエラーを確認してください
- Claude APIのクレジット残高を確認してください

### 請求や料金について

- Claude APIは使用量に応じて課金されます（平均的な占い1件あたり約20-30円）
- 毎月の使用状況はAnthropicのダッシュボードで確認できます

## 📞 サポート

技術的な問題やご質問がある場合は、以下にお問い合わせください：

- メール: [support@example.com](mailto:support@example.com)
- 電話: 03-1234-5678（平日10:00-18:00）

---

## 新機能: 自動PDF生成とメール送信 (2024年追加)

注文が確定した際に、自動的に占い結果PDFを生成し、顧客にメールで送信する機能を実装しました。

### 主な機能

1. **自動PDF生成**
   - 占い結果をカスタマイズされたPDFとして生成
   - 顧客情報、商品情報、占い結果を含む美しいデザイン
   - 日本語フォントに対応

2. **メール送信**
   - 生成されたPDFを添付ファイルとして自動送信
   - カスタマイズ可能なメールテンプレート
   - Gmail APIを利用した安定した配信

3. **自動処理システム**
   - 注文ウェブフック受信時の即時処理
   - スケジューラーによる定期的な保留注文の処理
   - 管理画面からの手動処理機能

### 設定方法

1. 環境変数の設定:
   ```
   # 自動PDF生成設定
   AUTO_GENERATE_PDF=true
   FORTUNE_SCHEDULER_CRON=*/5 * * * *
   PROCESS_PENDING_ON_STARTUP=true
   
   # PDF設定
   PDF_TEMP_DIR=./temp
   PDF_FONT_PATH=./fonts/NotoSansJP-Regular.otf
   ```

2. 必要なパッケージ:
   ```bash
   npm install --save pdfkit node-cron nodemailer
   ```

3. フォントの設定:
   - フォントディレクトリ (`fonts/`) を作成
   - 日本語対応フォント (例: NotoSansJP-Regular.otf) を配置

### API エンドポイント

| エンドポイント                    | 説明                             |
|----------------------------------|----------------------------------|
| GET /api/fortune-worker/status   | 処理状況を確認                    |
| POST /api/fortune-worker/run     | 待機中のすべての注文を処理        |
| POST /api/fortune-worker/order/:id | 指定した注文IDのみ処理           |

### スケジューラー

スケジューラーは `ENABLE_SCHEDULER=true` の場合に有効になり、`FORTUNE_SCHEDULER_CRON` で指定した間隔で実行されます。デフォルトでは5分ごとに実行されます。

### 処理フロー

1. STORES 決済完了 → Webhook受信
2. 顧客情報と注文情報を保存
3. 占い生成リクエスト登録
4. APIが占い結果を生成
5. PDF生成処理が実行（即時または定期的）
6. 顧客にPDFをメールで送信
7. 注文ステータスを更新

---

© 2025 AI占いサービス All Rights Reserved
