const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// フォーム作成モジュールへの依存
const { createFormForCustomer } = require('../formManagement/googleFormCreator');

// メール送信モジュールへの依存
const { sendEmail } = require('../mail/mailSender');

/**
 * ユニークなフォームURLを生成する関数
 * @param {string} orderId - 注文ID
 * @returns {string} 生成されたユニークURL
 */
const generateFormLink = (orderId) => {
  // ユニークIDの生成
  const uniqueId = crypto.randomBytes(8).toString('hex');
  
  // 実際の環境ではGoogleフォームAPIを使用してフォームを作成し、
  // そのURLを返すように実装する
  
  // ダミーURL (開発環境用)
  return `https://forms.example.com/${uniqueId}?orderId=${orderId}`;
};

/**
 * フォームリンクを顧客に送信する関数
 * @param {Object} customerData - 顧客データ
 * @returns {Object} 送信結果
 */
const sendFormLink = async (customerData) => {
  try {
    // 顧客データのバリデーション
    if (!customerData.email || !customerData.orderId) {
      throw new Error('顧客データが不足しています');
    }

    // 1. Googleフォームを作成
    const form = await createFormForCustomer(customerData);
    
    // 2. フォームURLを生成（実際の環境ではformから取得）
    const formUrl = form.url || generateFormLink(customerData.orderId);
    
    // 3. 有効期限を設定（デフォルト：3日間）
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 3);
    
    // 4. 顧客へのメールを送信
    const emailResult = await sendEmail({
      to: customerData.email,
      subject: `【AI占い】鑑定フォームのご案内 (注文ID: ${customerData.orderId})`,
      body: `
${customerData.name || 'お客様'}

この度はAI占いサービスをご利用いただき、誠にありがとうございます。

以下のリンクから鑑定に必要な情報をご入力ください。
${formUrl}

※このフォームの有効期限は ${expiryDate.toLocaleDateString('ja-JP')} までです。
※回答内容に基づき、AIが鑑定結果を作成いたします。

ご不明点がございましたら、お気軽にお問い合わせください。

AI占いサービス
support@example.com
      `,
    });
    
    // 5. 送信状況の記録
    const sendResult = {
      success: true,
      orderId: customerData.orderId,
      email: customerData.email,
      formUrl: formUrl,
      expiryDate: expiryDate.toISOString(),
      sentAt: new Date().toISOString()
    };
    
    console.log('フォームリンク送信成功:', sendResult);
    return sendResult;
  } catch (error) {
    console.error('フォームリンク送信エラー:', error);
    throw error;
  }
};

// フォーム送信リクエスト処理エンドポイント
router.post('/send', async (req, res) => {
  try {
    const result = await sendFormLink(req.body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// テスト用エンドポイント
router.get('/test/:orderId/:email', async (req, res) => {
  try {
    const result = await sendFormLink({
      orderId: req.params.orderId,
      email: req.params.email,
      name: 'テストユーザー'
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = {
  router,
  sendFormLink,
  generateFormLink
};
