const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const path = require('path');

// AI鑑定生成モジュールへの依存
const { generateFortune } = require('../aiFortune/claudeApiManager');

// Google Sheets API認証設定
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '../../credentials.json'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

/**
 * フォーム回答をチェックして新しいものを取得する
 * @param {string} spreadsheetId - スプレッドシートID
 * @returns {Array} 新規回答データの配列
 */
const checkForNewResponses = async (spreadsheetId) => {
  try {
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    
    // スプレッドシートからデータを取得
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A2:E', // ヘッダー行を除外
    });
    
    // 最新の回答を取得（実際の実装では処理済みとそうでないものを区別する必要がある）
    const rows = response.data.values || [];
    
    // シンプルな実装として、最新の1件を返す
    return rows.length > 0 ? rows[rows.length - 1] : null;
  } catch (error) {
    console.error('スプレッドシートアクセスエラー:', error);
    throw error;
  }
};

/**
 * フォーム回答を処理する関数
 * @param {Object} responseData - 回答データ
 * @returns {Object} 処理結果
 */
const processFormResponse = async (responseData) => {
  try {
    // 必須項目のバリデーション
    const requiredFields = ['orderId', 'name', 'birthDate', 'consultation'];
    const missingFields = requiredFields.filter(field => !responseData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`必須項目が不足しています: ${missingFields.join(', ')}`);
    }
    
    // データ整形（AI処理用フォーマット変換）
    const formattedData = {
      orderId: responseData.orderId,
      name: responseData.name,
      birthDate: responseData.birthDate,
      consultation: responseData.consultation,
      timestamp: new Date().toISOString()
    };
    
    // AI鑑定生成のトリガー
    const fortuneResult = await generateFortune(formattedData);
    
    // 処理結果を返す
    return {
      success: true,
      orderId: responseData.orderId,
      name: responseData.name,
      processedAt: new Date().toISOString(),
      fortuneResult
    };
  } catch (error) {
    console.error('フォーム回答処理エラー:', error);
    throw error;
  }
};

// フォーム回答処理エンドポイント
router.post('/process', async (req, res) => {
  try {
    const { responseData } = req.body;
    
    if (!responseData) {
      return res.status(400).json({ success: false, error: '回答データが不足しています' });
    }
    
    const result = await processFormResponse(responseData);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// スプレッドシートからの新規回答チェックエンドポイント
router.get('/check/:spreadsheetId', async (req, res) => {
  try {
    const { spreadsheetId } = req.params;
    
    if (!spreadsheetId) {
      return res.status(400).json({ success: false, error: 'スプレッドシートIDが不足しています' });
    }
    
    const newResponses = await checkForNewResponses(spreadsheetId);
    
    if (!newResponses) {
      return res.status(200).json({ success: true, data: { hasNewResponses: false } });
    }
    
    // 応答データの構造を整形
    const responseData = {
      orderId: newResponses[0],
      name: newResponses[1],
      birthDate: newResponses[2],
      consultation: newResponses[3]
    };
    
    // 新規回答を処理
    const result = await processFormResponse(responseData);
    res.status(200).json({ success: true, data: { hasNewResponses: true, result } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// テスト用エンドポイント
router.get('/test', async (req, res) => {
  try {
    const responseData = {
      orderId: 'TEST123',
      name: 'テストユーザー',
      birthDate: '1990-01-01',
      consultation: '仕事の悩みについて占ってほしいです。'
    };
    
    const result = await processFormResponse(responseData);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = {
  router,
  processFormResponse,
  checkForNewResponses
};
