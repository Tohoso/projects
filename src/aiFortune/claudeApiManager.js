const express = require('express');
const router = express.Router();
const axios = require('axios');
const { getPromptTemplate } = require('./promptTemplates');

// Claude API設定
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';

/**
 * Claude APIを使用して占い鑑定結果を生成する関数
 * @param {Object} userData - 鑑定に必要なユーザーデータ
 * @param {string} [fortuneType='general'] - 占いタイプ（総合運、恋愛運、仕事運など）
 * @returns {Object} 生成された鑑定結果
 */
const generateFortune = async (userData, fortuneType = 'general') => {
  try {
    // ユーザーデータのバリデーション
    if (!userData.name || !userData.birthDate || !userData.consultation) {
      throw new Error('鑑定に必要なデータが不足しています');
    }

    // API キーの確認
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      throw new Error('Claude API キーが設定されていません');
    }

    // プロンプトテンプレートの取得
    const promptTemplate = getPromptTemplate(fortuneType);
    if (!promptTemplate) {
      throw new Error(`占いタイプ ${fortuneType} のテンプレートが見つかりません`);
    }

    // プロンプトにユーザーデータを埋め込む
    let prompt = promptTemplate.content;
    prompt = prompt.replace(/\[NAME\]/g, userData.name);
    prompt = prompt.replace(/\[BIRTHDATE\]/g, userData.birthDate);
    prompt = prompt.replace(/\[CONSULTATION\]/g, userData.consultation || '');

    // API リクエストの設定
    const apiRequestBody = {
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7
    };

    // 開発環境ではAPIを呼び出さないダミー実装
    if (process.env.NODE_ENV === 'development') {
      console.log('開発環境: Claude APIは呼び出されません');
      return {
        fortuneId: `fortune-${Date.now()}`,
        fortuneType,
        content: `${userData.name}様の${promptTemplate.title}鑑定結果（開発環境ダミーデータ）\n\n占い結果はここに表示されます。実際の環境ではClaude APIからの応答が入ります。`,
        orderId: userData.orderId,
        generatedAt: new Date().toISOString(),
        apiCost: 0
      };
    }

    // Claude APIへのリクエスト送信
    const response = await axios.post(CLAUDE_API_URL, apiRequestBody, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    });

    // レスポンスの処理
    const fortuneContent = response.data.content[0].text;
    const apiCost = calculateCost(response.data.usage);

    // 鑑定結果の保存処理
    // ここでデータベースに保存するロジックを実装

    // 結果を返す
    return {
      fortuneId: `fortune-${Date.now()}`,
      fortuneType,
      content: fortuneContent,
      orderId: userData.orderId,
      generatedAt: new Date().toISOString(),
      apiCost
    };
  } catch (error) {
    console.error('Claude API エラー:', error);
    throw new Error(`鑑定結果の生成に失敗しました: ${error.message}`);
  }
};

/**
 * Claude APIの使用量からコストを計算する関数
 * @param {Object} usage - API使用量情報
 * @returns {number} 計算されたコスト（円）
 */
const calculateCost = (usage) => {
  // Claude-3.5-Sonnet 使用量に基づくコスト計算 (2024年3月時点の料金)
  // 入力: $3.00 / 1M tokens, 出力: $15.00 / 1M tokens
  const inputCostPerToken = 3.0 / 1000000;  // $ per token
  const outputCostPerToken = 15.0 / 1000000; // $ per token
  
  // 日本円換算 (簡易的に1ドル=150円で計算)
  const jpyRate = 150;
  
  const inputTokens = usage?.input_tokens || 0;
  const outputTokens = usage?.output_tokens || 0;
  
  const inputCost = inputTokens * inputCostPerToken * jpyRate;
  const outputCost = outputTokens * outputCostPerToken * jpyRate;
  
  return Math.round((inputCost + outputCost) * 100) / 100; // 小数点第2位まで
};

// 鑑定生成エンドポイント
router.post('/generate', async (req, res) => {
  try {
    const { userData, fortuneType } = req.body;
    
    if (!userData) {
      return res.status(400).json({ success: false, error: 'ユーザーデータが不足しています' });
    }
    
    const result = await generateFortune(userData, fortuneType);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// テスト用エンドポイント
router.get('/test', async (req, res) => {
  try {
    const userData = {
      orderId: 'TEST123',
      name: 'テストユーザー',
      birthDate: '1990-01-01',
      consultation: '最近の仕事がうまくいかず悩んでいます。今後のキャリアについてアドバイスをお願いします。'
    };
    
    const result = await generateFortune(userData, 'career');
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API使用状況確認エンドポイント
router.get('/usage', (req, res) => {
  // 実際の実装では、データベースからAPI使用状況を取得
  const usage = {
    totalRequests: 0,
    totalCost: 0,
    lastUpdate: new Date().toISOString()
  };
  
  res.status(200).json({ success: true, data: usage });
});

module.exports = {
  router,
  generateFortune,
  calculateCost
};