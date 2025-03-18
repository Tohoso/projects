/**
 * API ルーターのメインエントリーポイント
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// ルーター
const adminRouter = require('../admin/routes/admin-api');

// エクスプレスアプリケーションの作成
const app = express();

// ミドルウェアの設定
app.use(helmet()); // セキュリティヘッダーの設定
app.use(morgan('combined')); // リクエストログ
app.use(express.json()); // JSONボディパーサー
app.use(express.urlencoded({ extended: true })); // URL-encodedボディパーサー

// CORS設定
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*', // 本番環境では適切なオリジンを設定する
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// APIルートの登録
app.use('/api/admin', adminRouter);

// ヘルスチェックエンドポイント
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404エラーハンドラー
app.use((req, res, next) => {
  res.status(404).json({ error: 'Not Found' });
});

// エラーハンドラー
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = app;
