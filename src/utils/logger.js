/**
 * ロギングユーティリティ
 * アプリケーション全体で一貫したログ記録を提供します
 */
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// ログディレクトリの作成
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// ログフォーマットの定義
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Winstonロガーの作成
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'ai-fortune-service' },
  transports: [
    // エラーログはerror.logに書き込み
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // すべてのログはcombined.logに書き込み
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// 開発環境では、コンソールにもログを出力
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

/**
 * リクエスト情報を含むログ出力用のミドルウェア
 */
logger.middleware = (req, res, next) => {
  // リクエスト開始時刻を記録
  const start = Date.now();
  
  // レスポンス送信後にログを記録
  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;
    
    // ステータスコードに応じてログレベルを変更
    if (res.statusCode >= 500) {
      logger.error(message, { 
        ip: req.ip, 
        userId: req.user?.id, 
        userAgent: req.get('user-agent'),
        requestId: req.id
      });
    } else if (res.statusCode >= 400) {
      logger.warn(message, { 
        ip: req.ip, 
        userId: req.user?.id, 
        userAgent: req.get('user-agent'),
        requestId: req.id
      });
    } else {
      logger.info(message, { 
        ip: req.ip, 
        userId: req.user?.id, 
        userAgent: req.get('user-agent'),
        requestId: req.id
      });
    }
  });
  
  next();
};

module.exports = logger;
