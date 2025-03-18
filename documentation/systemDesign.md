graph LR
    A[Stores決済] --> B[Webhook処理]
    B --> C[フォーム生成]
    C --> D[顧客入力]
    D --> E[データ検証]
    E --> F[AI鑑定]
    F --> G[PDF生成]
    G --> H[メール配信]

sequenceDiagram
    participant Customer
    participant Stores
    participant Webhook
    participant Form
    participant AI
    participant PDF
    participant Mail

    Customer->>Stores: 商品購入
    Stores->>Webhook: 決済完了通知
    Webhook->>Form: フォーム生成
    Form->>Customer: フォームURL送信
    Customer->>Form: 情報入力
    Form->>AI: データ転送
    AI->>PDF: 鑑定結果生成
    PDF->>Mail: PDF添付
    Mail->>Customer: 結果送信;