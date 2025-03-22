const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { processFortuneGeneration } = require('../pdfGenerator/fortunePdfGenerator');

// データディレクトリ設定
const dataDir = path.join(__dirname, '../../data');
const fortunesDir = path.join(dataDir, 'fortunes');

/**
 * 処理待ちの注文を検索する関数
 * @returns {Promise<Array>} 処理待ち注文IDのリスト
 */
const findPendingOrders = async () => {
  try {
    // データディレクトリの存在確認
    try {
      await fs.mkdir(fortunesDir, { recursive: true });
    } catch (err) {
      // ディレクトリ作成エラーは無視
    }
    
    // 占いデータファイルの一覧を取得
    const files = await fs.readdir(fortunesDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    // 各ファイルの内容を確認
    const pendingOrders = [];
    
    for (const file of jsonFiles) {
      try {
        const filePath = path.join(fortunesDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(content);
        
        // 'pending'ステータスの注文のみを抽出
        if (data.status === 'pending') {
          pendingOrders.push({
            orderId: data.orderId,
            file,
            createdAt: data.createdAt
          });
        }
      } catch (err) {
        console.error(`ファイル読み込みエラー: ${file}`, err);
      }
    }
    
    // 作成日時順にソート
    pendingOrders.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    return pendingOrders;
  } catch (error) {
    console.error('処理待ち注文検索エラー:', error);
    throw error;
  }
};

/**
 * 自動処理ワーカーの実行
 * @returns {Promise<Object>} 処理結果
 */
const runWorker = async () => {
  try {
    // 処理待ち注文の検索
    const pendingOrders = await findPendingOrders();
    
    if (pendingOrders.length === 0) {
      return {
        success: true,
        message: '処理待ちの注文はありません',
        processed: 0
      };
    }
    
    console.log(`処理待ち注文が ${pendingOrders.length} 件見つかりました`);
    
    // 注文ごとに処理
    const results = [];
    
    for (const order of pendingOrders) {
      try {
        // 負荷軽減のため、一度に処理する注文数を制限
        if (results.length >= 5) {
          console.log('一度に処理する最大数に達したため、残りは次回実行時に処理します');
          break;
        }
        
        console.log(`注文ID ${order.orderId} の処理を開始します...`);
        const result = await processFortuneGeneration(order.orderId);
        results.push({
          orderId: order.orderId,
          success: true,
          result
        });
      } catch (err) {
        console.error(`注文ID ${order.orderId} の処理中にエラーが発生しました:`, err);
        results.push({
          orderId: order.orderId,
          success: false,
          error: err.message
        });
      }
    }
    
    return {
      success: true,
      message: `${results.length} 件の注文を処理しました`,
      processed: results.length,
      results
    };
  } catch (error) {
    console.error('ワーカー実行エラー:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * 手動実行エンドポイント
 */
router.post('/run', async (req, res) => {
  try {
    // APIアクセストークンの検証
    const token = req.headers['x-api-token'];
    
    if (!token || token !== process.env.API_ACCESS_TOKEN) {
      return res.status(401).json({
        success: false,
        error: '不正なAPIトークンです'
      });
    }
    
    // ワーカー実行
    const result = await runWorker();
    res.status(200).json(result);
  } catch (error) {
    console.error('ワーカー実行APIエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 単一注文処理エンドポイント
 */
router.post('/process/:orderId', async (req, res) => {
  try {
    // APIアクセストークンの検証
    const token = req.headers['x-api-token'];
    
    if (!token || token !== process.env.API_ACCESS_TOKEN) {
      return res.status(401).json({
        success: false,
        error: '不正なAPIトークンです'
      });
    }
    
    const { orderId } = req.params;
    
    // ファイルの存在を確認
    const filePath = path.join(fortunesDir, `${orderId}.json`);
    try {
      await fs.access(filePath);
    } catch (err) {
      return res.status(404).json({
        success: false,
        error: `注文ID ${orderId} が見つかりません`
      });
    }
    
    // 単一注文処理
    const result = await processFortuneGeneration(orderId);
    res.status(200).json({
      success: true,
      message: `注文ID ${orderId} の処理が完了しました`,
      result
    });
  } catch (error) {
    console.error('単一注文処理APIエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 自動実行用の関数をエクスポート
module.exports = {
  router,
  runWorker,
  findPendingOrders,
  processOrder: processFortuneGeneration
};
