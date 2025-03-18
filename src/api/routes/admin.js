/**
 * 管理者用APIエンドポイント
 */
const express = require('express');
const router = express.Router();
const { validationResult, body } = require('express-validator');
const fs = require('fs/promises');
const path = require('path');
const logger = require('../../utils/logger');
const { generatePDF } = require('../../pdfGeneration/pdfGenerator');
const { sendEmail } = require('../../emailSending/emailSender');

// データ保存用ディレクトリの設定
const dataDir = path.join(__dirname, '../../../data');
const fortunesDir = path.join(dataDir, 'fortunes');

/**
 * 認証ミドルウェア
 * 本番環境では適切な認証機構を実装すること
 */
const authMiddleware = (req, res, next) => {
  // ここでは簡易的な認証チェックのみ実装
  // 本番環境では適切なJWT検証やセッション管理が必要
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '認証が必要です' });
  }
  
  const token = authHeader.split(' ')[1];
  
  // 開発環境用の簡易トークン
  // 本番環境では適切なトークン検証が必要
  if (token !== process.env.ADMIN_API_TOKEN && token !== 'dev-token') {
    return res.status(403).json({ error: '権限がありません' });
  }
  
  next();
};

// すべてのルートに認証ミドルウェアを適用
router.use(authMiddleware);

/**
 * 鑑定結果の編集
 * POST /api/admin/fortune/edit
 */
router.post('/fortune/edit', [
  body('requestId').isString().notEmpty().withMessage('リクエストIDは必須です'),
  body('content').isString().notEmpty().withMessage('鑑定内容は必須です')
], async (req, res) => {
  // 入力バリデーション
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { requestId, content } = req.body;

  try {
    // データディレクトリが存在することを確認
    await fs.mkdir(fortunesDir, { recursive: true });

    // 鑑定データのファイルパス
    const fortuneFilePath = path.join(fortunesDir, `${requestId}.json`);
    
    // 既存データの読み込み
    let fortuneData;
    try {
      const fileContent = await fs.readFile(fortuneFilePath, 'utf8');
      fortuneData = JSON.parse(fileContent);
    } catch (err) {
      // ファイルが存在しない場合は新規作成
      fortuneData = {
        id: requestId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'edited',
        customerInfo: {
          // 実際の実装ではここに顧客情報が必要
          id: 'unknown',
          email: 'unknown',
          name: 'unknown'
        },
        content: ''
      };
    }

    // 鑑定内容を更新
    fortuneData.content = content;
    fortuneData.updatedAt = new Date().toISOString();
    fortuneData.status = 'edited';
    fortuneData.editedByAdmin = true;

    // 更新データを保存
    await fs.writeFile(fortuneFilePath, JSON.stringify(fortuneData, null, 2), 'utf8');

    // 変更の監査ログを記録
    logger.info(`管理者が鑑定結果を編集しました。RequestID: ${requestId}`);

    res.status(200).json({
      success: true,
      message: '鑑定結果が正常に保存されました',
      data: {
        id: requestId,
        updatedAt: fortuneData.updatedAt
      }
    });
  } catch (error) {
    logger.error(`鑑定結果の編集中にエラーが発生しました: ${error.message}`, { error, requestId });
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
      error: error.message
    });
  }
});

/**
 * PDF再生成・送信
 * POST /api/admin/fortune/regenerate-pdf
 */
router.post('/fortune/regenerate-pdf', [
  body('requestId').isString().notEmpty().withMessage('リクエストIDは必須です')
], async (req, res) => {
  // 入力バリデーション
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { requestId } = req.body;

  try {
    // 鑑定データのファイルパス
    const fortuneFilePath = path.join(fortunesDir, `${requestId}.json`);
    
    // 既存データの読み込み
    let fortuneData;
    try {
      const fileContent = await fs.readFile(fortuneFilePath, 'utf8');
      fortuneData = JSON.parse(fileContent);
    } catch (err) {
      return res.status(404).json({
        success: false,
        message: '指定された鑑定結果が見つかりません'
      });
    }

    // PDFの生成
    const pdfBuffer = await generatePDF({
      content: fortuneData.content,
      customerName: fortuneData.customerInfo.name || '顧客',
      orderId: requestId,
      createdAt: new Date().toISOString()
    });

    // PDFファイルの保存パス
    const pdfFileName = `fortune_${requestId}_${Date.now()}.pdf`;
    const pdfFilePath = path.join(dataDir, 'pdfs', pdfFileName);
    
    // ディレクトリが存在することを確認
    await fs.mkdir(path.dirname(pdfFilePath), { recursive: true });
    
    // PDFファイルを保存
    await fs.writeFile(pdfFilePath, pdfBuffer);

    // メール送信（顧客情報が存在する場合のみ）
    if (fortuneData.customerInfo && fortuneData.customerInfo.email) {
      await sendEmail({
        to: fortuneData.customerInfo.email,
        subject: '【AI占いサービス】鑑定結果のお知らせ',
        text: `${fortuneData.customerInfo.name || ''}様\n\nAI占いサービスをご利用いただきありがとうございます。\n鑑定結果を添付ファイルにてお送りいたします。\n\n※このメールは自動送信されています。`,
        attachments: [{
          filename: '鑑定結果.pdf',
          path: pdfFilePath
        }]
      });

      // 送信状態を更新
      fortuneData.status = 'sent';
      fortuneData.sentAt = new Date().toISOString();
      fortuneData.pdfPath = pdfFilePath;
      
      // 更新データを保存
      await fs.writeFile(fortuneFilePath, JSON.stringify(fortuneData, null, 2), 'utf8');
    }

    // 変更の監査ログを記録
    logger.info(`管理者がPDFを再生成しました。RequestID: ${requestId}`);

    res.status(200).json({
      success: true,
      message: 'PDFが正常に生成され、メールが送信されました',
      data: {
        id: requestId,
        pdfPath: pdfFilePath,
        sentAt: fortuneData.sentAt
      }
    });
  } catch (error) {
    logger.error(`PDF再生成中にエラーが発生しました: ${error.message}`, { error, requestId });
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
      error: error.message
    });
  }
});

/**
 * 鑑定依頼一覧の取得
 * GET /api/admin/fortunes
 */
router.get('/fortunes', async (req, res) => {
  try {
    // データディレクトリの存在確認
    try {
      await fs.mkdir(fortunesDir, { recursive: true });
    } catch (err) {
      // ディレクトリ作成エラーは無視
    }

    // ファイル一覧の取得
    const files = await fs.readdir(fortunesDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    // 各ファイルからデータを読み込む
    const fortunes = await Promise.all(
      jsonFiles.map(async (file) => {
        try {
          const content = await fs.readFile(path.join(fortunesDir, file), 'utf8');
          return JSON.parse(content);
        } catch (err) {
          logger.error(`ファイル読み込みエラー: ${file}`, { error: err });
          return null;
        }
      })
    );

    // 有効なデータのみをフィルタリング
    const validFortunes = fortunes.filter(f => f !== null);
    
    // 日付の新しい順にソート
    validFortunes.sort((a, b) => {
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    res.status(200).json({
      success: true,
      data: validFortunes
    });
  } catch (error) {
    logger.error(`鑑定依頼一覧の取得中にエラーが発生しました: ${error.message}`, { error });
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
      error: error.message
    });
  }
});

/**
 * 鑑定結果の詳細取得
 * GET /api/admin/fortune/:id
 */
router.get('/fortune/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // ファイルパスの設定
    const fortuneFilePath = path.join(fortunesDir, `${id}.json`);
    
    // ファイル読み込み
    try {
      const content = await fs.readFile(fortuneFilePath, 'utf8');
      const fortuneData = JSON.parse(content);
      
      res.status(200).json({
        success: true,
        data: fortuneData
      });
    } catch (err) {
      // ファイルが存在しない場合
      if (err.code === 'ENOENT') {
        return res.status(404).json({
          success: false,
          message: '指定された鑑定結果が見つかりません'
        });
      }
      
      throw err;
    }
  } catch (error) {
    logger.error(`鑑定結果の詳細取得中にエラーが発生しました: ${error.message}`, { error, id });
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
      error: error.message
    });
  }
});

module.exports = router;
