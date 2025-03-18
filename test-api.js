/**
 * 新機能テスト用の簡易サーバー
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.TEST_PORT || 3001;

// ミドルウェア設定
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// データディレクトリ設定
const dataDir = path.join(__dirname, 'data');
const fortunesDir = path.join(dataDir, 'fortunes');

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', time: new Date().toISOString() });
});

/**
 * 認証ミドルウェア - テスト用に簡略化
 */
const authMiddleware = (req, res, next) => {
  // テスト中は認証をスキップ
  next();
};

/**
 * 鑑定依頼一覧の取得
 * GET /api/admin/fortunes
 */
app.get('/api/admin/fortunes', authMiddleware, async (req, res) => {
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
          console.error(`ファイル読み込みエラー: ${file}`, err);
          return null;
        }
      })
    );

    // 有効なデータのみをフィルタリング
    const validFortunes = fortunes.filter(f => f !== null);
    
    // 日付の新しい順にソート
    validFortunes.sort((a, b) => {
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
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
 * GET /api/admin/fortune/:id
 */
app.get('/api/admin/fortune/:id', authMiddleware, async (req, res) => {
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
 * POST /api/admin/fortune/edit
 */
app.post('/api/admin/fortune/edit', authMiddleware, async (req, res) => {
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
 * PDF再生成・送信（モック実装）
 * POST /api/admin/fortune/regenerate-pdf
 */
app.post('/api/admin/fortune/regenerate-pdf', authMiddleware, async (req, res) => {
  const { requestId } = req.body;

  if (!requestId) {
    return res.status(400).json({
      success: false,
      message: 'リクエストIDは必須です'
    });
  }

  try {
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

    // 状態を更新（テスト用の簡易実装）
    fortuneData.status = 'sent';
    fortuneData.sentAt = new Date().toISOString();
    
    // 更新データを保存
    await fs.writeFile(fortuneFilePath, JSON.stringify(fortuneData, null, 2), 'utf8');
    
    // 変更の監査ログを記録
    console.log(`[モック] 管理者がPDFを再生成しました。RequestID: ${requestId}`);

    res.status(200).json({
      success: true,
      message: 'PDFが正常に生成され、メールが送信されました（テスト環境）',
      data: {
        id: requestId,
        pdfPath: `/mock/pdf/fortune_${requestId}.pdf`,
        sentAt: fortuneData.sentAt
      }
    });
  } catch (error) {
    console.error(`PDF再生成中にエラーが発生しました: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
      error: error.message
    });
  }
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`テストAPIサーバーが起動しました: http://localhost:${PORT}`);
  console.log(`テスト用鑑定結果ID: test-fortune-123`);
});
