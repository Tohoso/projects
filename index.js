const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const axios = require('axios');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// 環境設定
dotenv.config();

// ルート定義
// const adminRoute = require('./src/admin/dashboard');
const formLinkSenderRoute = require('./src/formAutomation/formLinkSender');
const formCheckSchedulerRoute = require('./src/scheduler/formCheckScheduler');
const storesOrderManager = require('./src/ecIntegration/storesOrderManager');
const storesProductManager = require('./src/ecIntegration/storesProductManager');
const orderManagement = require('./src/admin/orderManagement');
// 自動PDF生成関連のルート
const fortuneGenerator = require('./src/workers/fortuneGenerator');
// スケジューラー
const fortuneScheduler = require('./src/scheduler/fortuneScheduler');

// 新しいAPIルート
const apiRouter = require('./src/api');

// Webhookルート
const storesWebhook = require('./src/ecIntegration/storesWebhook');

// アプリケーション作成
const app = express();
const PORT = process.env.PORT || 3000;

// セキュリティとミドルウェア設定
app.use(helmet());
app.use(compression());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 開発環境であればリクエストログを表示
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// レート制限（DoS対策）
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 100, // IP毎に100リクエストまで
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', environment: process.env.NODE_ENV });
});

// APIルート
// app.use('/api/admin', adminRoute.router); // React用コンポーネントなのでコメントアウト
app.use('/api/form-link', formLinkSenderRoute.router);
app.use('/api/scheduler', formCheckSchedulerRoute.router);
app.use('/api/stores/orders', storesOrderManager.router);
app.use('/api/stores/products', storesProductManager.router);
app.use('/api/admin', orderManagement);
// 自動PDF生成ワーカーのAPIルート
app.use('/api/fortune-worker', fortuneGenerator.router);
// スケジューラー管理用APIルート
app.use('/api/fortune-scheduler', fortuneScheduler.router);

// 新しいAPIルートを追加
app.use('/api/v1', apiRouter);

// Webhookルート
app.use('/webhook', storesWebhook.router);

// テストやデバッグ用のエンドポイント
app.use('/api/test', require('./test-api'));

// PDF出力ディレクトリの静的配信
app.use('/fortunes', express.static(path.join(__dirname, process.env.PDF_TEMP_DIR || 'temp')));

// フォント管理
app.use('/fonts', express.static(path.join(__dirname, 'fonts')));

// エラー処理ミドルウェア
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'サーバーエラーが発生しました'
  });
});

// ディレクトリの存在確認
const tempDir = path.join(__dirname, process.env.PDF_TEMP_DIR || 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
  console.log(`Created temp directory: ${tempDir}`);
}

const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
  console.log(`Created log directory: ${logDir}`);
}

// 自動PDF生成スケジューラーの初期化
if (process.env.ENABLE_SCHEDULER === 'true') {
  const { initializeScheduler } = require('./src/scheduler/fortuneScheduler');
  const scheduler = initializeScheduler();
  console.log('自動PDF生成スケジューラーの初期化結果:', scheduler);
}

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  
  // サーバー起動時に一度、待機中の注文を処理（オプション）
  if (process.env.PROCESS_PENDING_ON_STARTUP === 'true') {
    console.log('サーバー起動時の待機中注文処理を開始します...');
    fortuneGenerator.runWorker().catch((err) => {
      console.error('起動時の注文処理でエラーが発生しました:', err);
    });
  }
});

// エラーハンドリング
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // 異常終了を防ぐが、プロセスの状態が不安定な可能性があるため注意
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // 未処理のpromiseエラーをログに残すが、プロセスは終了させない
});

module.exports = app;
