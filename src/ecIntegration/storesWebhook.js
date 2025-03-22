const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;

// 注文管理モジュールをインポート
const { getOrderDetails } = require('./storesOrderManager');
// PDF生成処理モジュールをインポート
const { processOrder } = require('../workers/fortuneGenerator');

// データディレクトリ設定
const dataDir = path.join(__dirname, '../../data');
const fortunesDir = path.join(dataDir, 'fortunes');

/**
 * 顧客情報をデータベース（JSONファイル）に保存する関数
 * @param {Object} customerInfo 顧客情報
 */
const saveOrderToDatabase = async (customerInfo) => {
  try {
    // データディレクトリの存在確認
    try {
      await fs.mkdir(dataDir, { recursive: true });
      await fs.mkdir(fortunesDir, { recursive: true });
    } catch (err) {
      // ディレクトリ作成エラーは無視
    }

    // 注文データの作成
    const fortuneData = {
      ...customerInfo,
      status: 'pending', // 処理待ち
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // ファイルに保存
    const filePath = path.join(fortunesDir, `${customerInfo.orderId}.json`);
    await fs.writeFile(filePath, JSON.stringify(fortuneData, null, 2), 'utf8');
    
    console.log(`注文データを保存しました: ${filePath}`);
    return true;
  } catch (error) {
    console.error('データ保存エラー:', error);
    throw error;
  }
};

/**
 * Storesの決済完了Webhookを処理する関数
 * @param {Object} webhookData Webhookデータ
 * @param {string} signature リクエストの署名
 * @returns {Promise<Object>} 処理結果
 */
const processWebhook = async (webhookData, signature) => {
  try {
    // 署名検証
    // const isValid = verifySignature(webhookData, signature);
    // if (!isValid) throw new Error('署名が無効です');

    // 顧客情報の抽出
    const data = {
      email: webhookData.customer_email || 'test@example.com',
      orderId: webhookData.order_id || String(Date.now()),
      productInfo: webhookData.product_name || '占いサービス',
      orderDate: webhookData.created_at || new Date().toISOString()
    };

    // 注文詳細情報の取得（STORES APIが設定されている場合）
    try {
      if (process.env.STORES_API_KEY) {
        const orderDetails = await getOrderDetails(data.orderId);
        if (orderDetails) {
          // 詳細情報があれば上書き
          data.email = orderDetails.email || data.email;
          data.orderDate = orderDetails.ordered_at || data.orderDate;
          
          // 顧客名の取得
          if (orderDetails.billing_address) {
            data.customerName = `${orderDetails.billing_address.last_name} ${orderDetails.billing_address.first_name}`;
          }
          
          // 商品情報の取得
          if (orderDetails.deliveries && 
              orderDetails.deliveries.length > 0 && 
              orderDetails.deliveries[0].items && 
              orderDetails.deliveries[0].items.length > 0) {
            
            const item = orderDetails.deliveries[0].items[0];
            data.productInfo = item.name;
          }
        }
      }
    } catch (apiError) {
      console.warn('STORES API 注文詳細取得エラー:', apiError);
      // API取得失敗時はWebhookのデータのみを使用
    }
    
    // 注文情報を保存
    await saveOrderToDatabase(data);

    // フォーム送信システムへのトリガー発行
    await axios.post('http://localhost:3000/api/form/create', {
      customer: data
    });

    // 自動PDF生成処理の実行
    if (process.env.AUTO_GENERATE_PDF === 'true') {
      try {
        console.log(`注文ID ${data.orderId} の自動PDF生成処理を開始します...`);
        // 非同期で実行して応答を待たない（webhookの処理を高速化するため）
        processOrder(data.orderId).catch(err => {
          console.error(`注文ID ${data.orderId} の自動PDF生成処理でエラーが発生しました:`, err);
        });
        console.log(`注文ID ${data.orderId} の自動PDF生成処理をバックグラウンドで実行中...`);
      } catch (genError) {
        console.error('自動PDF生成処理の開始に失敗しました:', genError);
        // PDF生成エラーはWebhook処理全体を失敗とはしない
      }
    }

    console.log('Webhook 処理成功:', data);
    return data;
  } catch (e) {
    console.error('Webhook 処理エラー:', e);
    throw e;
  }
};

// 署名検証関数
const verifySignature = (data, signature) => {
  if (!signature || !process.env.STORES_SECRET) {
    return false;
  }
  
  try {
    const hmac = crypto.createHmac('sha256', process.env.STORES_SECRET);
    const calculatedSignature = hmac.update(JSON.stringify(data)).digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(calculatedSignature),
      Buffer.from(signature)
    );
  } catch (error) {
    console.error('署名検証エラー:', error);
    return false;
  }
};

// テスト用Webhook処理エンドポイント
router.post('/process', async (req, res) => {
  try {
    const result = await processWebhook(req.body, req.headers['x-stores-signature']);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Storesから実際に送信されるWebhook処理エンドポイント
router.post('/stores', async (req, res) => {
  try {
    // Storesからのワーカーチェック対応
    if (req.body.mode === 'worker_check') {
      return res.status(200).send('OK');
    }

    const result = await processWebhook(req.body, req.headers['x-stores-signature']);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Stores Webhook処理エラー:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = {
  router,
  processWebhook
};
