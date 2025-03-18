require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const axios = require('axios');
const fs = require('fs');

// Utils
const ErrorHandler = require('./src/utils/errorHandler');

// Routes
const storesWebhookRoute = require('./src/ecIntegration/storesWebhook');
const formManagementRoute = require('./src/formManagement/googleFormCreator');
const dataProcessingRoute = require('./src/dataProcessing/formResponseHandler');
const aiFortuneRoute = require('./src/aiFortune/claudeApiManager');
const pdfGenerationRoute = require('./src/pdfGeneration/pdfGenerator');
const emailSenderRoute = require('./src/emailSending/emailSender');
// React用コンポーネントなのでサーバー側では使用しない
// const adminRoute = require('./src/admin/dashboard');
const formLinkSenderRoute = require('./src/formAutomation/formLinkSender');
const formCheckSchedulerRoute = require('./src/scheduler/formCheckScheduler');

// 新しいAPIルート
const apiRouter = require('./src/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/webhook', storesWebhookRoute.router);
app.use('/api/form', formManagementRoute.router);
app.use('/api/data', dataProcessingRoute.router);
app.use('/api/ai', aiFortuneRoute.router);
app.use('/api/pdf', pdfGenerationRoute.router);
app.use('/api/email', emailSenderRoute.router);
// app.use('/api/admin', adminRoute.router); // React用コンポーネントなのでコメントアウト
app.use('/api/form-link', formLinkSenderRoute.router);
app.use('/api/scheduler', formCheckSchedulerRoute.router);

// 新しいAPIルートを追加
app.use('/', apiRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  ErrorHandler.handleError(err);
  res.status(500).json({ error: 'サーバーエラーが発生しました' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`サーバーが起動しました: http://localhost:${PORT}`);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', time: new Date().toISOString() });
});

// Setup logging directory
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

module.exports = app;
