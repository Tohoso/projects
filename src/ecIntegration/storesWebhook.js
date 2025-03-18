const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');

// Storesの決済完了Webhookを処理する関数
const processWebhook = async (webhookData) => {
  try {
    // 署名検証 (実際の実装ではStoresから提供される署名を検証)
    // const isValid = verifySignature(webhookData, signature);
    // if (!isValid) throw new Error('署名が無効です');

    // 顧客情報の抽出
    const data = {
      email: webhookData.customer_email || 'test@example.com',
      orderId: webhookData.order_id || String(Date.now()),
      productInfo: webhookData.product_name || '占いサービス',
      orderDate: webhookData.created_at || new Date().toISOString()
    };

    // フォーム送信システムへのトリガー発行
    await axios.post('http://localhost:3000/api/form/create', {
      customer: data
    });

    console.log('Webhook 処理成功:', data);
    return data;
  } catch (e) {
    console.error('Webhook 処理エラー:', e);
    throw e;
  }
};

// テスト用Webhook処理エンドポイント
router.post('/process', async (req, res) => {
  try {
    const result = await processWebhook(req.body);
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

    const result = await processWebhook(req.body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Stores Webhook処理エラー:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 署名検証関数 (実際の実装では適切な検証ロジックを実装)
const verifySignature = (data, signature) => {
  // 実際の実装ではシークレットとリクエストデータから
  // ハッシュを生成して比較する
  const hmac = crypto.createHmac('sha256', process.env.STORES_SECRET);
  const calculatedSignature = hmac.update(JSON.stringify(data)).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(calculatedSignature),
    Buffer.from(signature)
  );
};

module.exports = router;
