/**
 * 管理者用APIルーター
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const logger = require('../../utils/logger');

// データ保存用ディレクトリの設定
const dataDir = path.join(__dirname, '../../../data');
const fortunesDir = path.join(dataDir, 'fortunes');

/**
 * 認証ミドルウェア - シンプルな実装
 */
const authMiddleware = (req, res, next) => {
  // 開発目的のため、簡易的な認証
  // 本番環境では適切なJWT検証などが必要
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '認証が必要です' });
  }
  
  const token = authHeader.split(' ')[1];
  
  // 開発環境用の簡易トークン（本番環境では適切に強化する必要あり）
  if (token !== process.env.ADMIN_API_TOKEN && token !== 'dev-token') {
    return res.status(403).json({ error: '権限がありません' });
  }
  
  next();
};

// すべてのルートに認証ミドルウェアを適用
router.use(authMiddleware);

/**
 * 鑑定依頼一覧の取得
 * GET /api/admin/data/fortunes
 */
router.get('/data/fortunes', async (req, res) => {
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
    console.error(`鑑定依頼一覧の取得中にエラーが発生しました: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
      error: error.message
    });
  }
});

/**
 * 鑑定結果の詳細取得
 * GET /api/admin/data/fortune/:id
 */
router.get('/data/fortune/:id', async (req, res) => {
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
    console.error(`鑑定結果の詳細取得中にエラーが発生しました: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
      error: error.message
    });
  }
});

/**
 * 鑑定結果の編集
 * POST /api/admin/data/fortune/edit
 */
router.post('/data/fortune/edit', async (req, res) => {
  const { requestId, content } = req.body;

  if (!requestId || !content) {
    return res.status(400).json({
      success: false,
      message: 'リクエストIDとコンテンツは必須です'
    });
  }

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
      // ファイルが存在しない場合
      if (err.code === 'ENOENT') {
        return res.status(404).json({
          success: false,
          message: '指定された鑑定結果が見つかりません'
        });
      }
      throw err;
    }

    // 鑑定内容を更新
    fortuneData.content = content;
    fortuneData.updatedAt = new Date().toISOString();
    fortuneData.status = 'edited';
    fortuneData.editedByAdmin = true;

    // 更新データを保存
    await fs.writeFile(fortuneFilePath, JSON.stringify(fortuneData, null, 2), 'utf8');

    // 変更の監査ログを記録
    console.log(`管理者が鑑定結果を編集しました。RequestID: ${requestId}`);

    res.status(200).json({
      success: true,
      message: '鑑定結果が正常に保存されました',
      data: {
        id: requestId,
        updatedAt: fortuneData.updatedAt
      }
    });
  } catch (error) {
    console.error(`鑑定結果の編集中にエラーが発生しました: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
      error: error.message
    });
  }
});

/**
 * テスト用エンドポイント
 * GET /api/admin/data/test
 */
router.get('/data/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: '管理者APIテスト成功',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
