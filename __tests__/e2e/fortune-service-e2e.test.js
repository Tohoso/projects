/**
 * AI占いサービスのE2Eテスト
 * 
 * このテストでは、以下のフロー全体をダミーデータを使用してテストします:
 * 1. 占い鑑定リクエストの送信
 * 2. Claude APIを使った占い結果の生成
 * 3. 占い結果のPDF生成
 * 4. 結果のメール送信
 * 
 * 注意: このテストはモックを使用しており、実際の外部APIには接続しません
 */

const request = require('supertest');
const fs = require('fs');
const path = require('path');

// フォームリンク送信モジュールを事前にモック化
jest.mock('../../src/formAutomation/formLinkSender', () => require('../mocks/formLinkSender'));

const app = require('../../index');

// テスト対象のモジュール
const { generateFortune } = require('../../src/aiFortune/claudeApiManager');
const { generateFortunePDF } = require('../../src/pdfGeneration/pdfGenerator');
const { sendFortuneEmail } = require('../../src/emailSending/emailSender');

// APIモックの設定
jest.mock('axios');
const axios = require('axios');

// PDFKit モックの設定
jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => ({
    pipe: jest.fn().mockReturnThis(),
    font: jest.fn().mockReturnThis(),
    fontSize: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    moveDown: jest.fn().mockReturnThis(),
    image: jest.fn().mockReturnThis(),
    addPage: jest.fn().mockReturnThis(),
    fillColor: jest.fn().mockReturnThis(),
    strokeColor: jest.fn().mockReturnThis(),
    lineWidth: jest.fn().mockReturnThis(),
    moveTo: jest.fn().mockReturnThis(),
    lineTo: jest.fn().mockReturnThis(),
    stroke: jest.fn().mockReturnThis(),
    end: jest.fn(function() { 
      if (this.onEndCallback) {
        setTimeout(this.onEndCallback, 10);
      }
      return true;
    }),
    on: jest.fn(function(event, callback) {
      if (event === 'finish') {
        this.onEndCallback = callback;
      }
      return this;
    }),
    page: { width: 595.28 },
    y: 100
  }));
});

// fsモック
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  createWriteStream: jest.fn(() => ({
    on: jest.fn(function(event, handler) {
      if (event === 'finish') {
        setTimeout(handler, 10);
      }
      return this;
    }),
    once: jest.fn(),
    emit: jest.fn()
  }))
}));

// Gmailモックの設定
jest.mock('googleapis', () => ({
  google: {
    auth: {
      GoogleAuth: jest.fn().mockImplementation(() => ({
        getClient: jest.fn().mockResolvedValue({})
      }))
    },
    gmail: jest.fn().mockReturnValue({
      users: {
        messages: {
          send: jest.fn().mockResolvedValue({ data: { id: 'test-message-id' } })
        }
      }
    })
  }
}));

describe('AI占いサービス E2Eテスト', () => {
  // ダミーデータ
  const dummyUsers = [
    {
      orderId: 'E2E_TEST_001',
      name: '山田太郎',
      birthDate: '1985-06-15',
      consultation: '最近仕事がうまくいかず、キャリアの方向性に悩んでいます。',
      email: 'test1@example.com',
      fortuneType: 'career'
    },
    {
      orderId: 'E2E_TEST_002',
      name: '佐藤花子',
      birthDate: '1992-12-24',
      consultation: '恋愛についての悩みがあります。良い出会いはあるでしょうか？',
      email: 'test2@example.com',
      fortuneType: 'love'
    },
    {
      orderId: 'E2E_TEST_003',
      name: '鈴木一郎',
      birthDate: '1978-03-08',
      consultation: '全体的な運勢と来年の傾向について教えてください。',
      email: 'test3@example.com',
      fortuneType: 'general'
    }
  ];
  
  beforeAll(() => {
    // 環境変数の設定
    process.env.NODE_ENV = 'test';
    process.env.CLAUDE_API_KEY = 'dummy_api_key';
    
    // テスト用ディレクトリの作成
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Claude APIのモックレスポンス
    axios.post.mockImplementation((url, data) => {
      // リクエストデータに応じてレスポンスを変更
      let responseText = '';
      
      if (data.messages[0].content.includes('career') || data.messages[0].content.includes('仕事')) {
        responseText = `【仕事運】
あなたの仕事運は現在上昇傾向にあります。ここ数ヶ月感じていた停滞感は、実は新たなステージに向けた準備期間だったのです。

【具体的なアドバイス】
1. 新しいスキルの習得に挑戦してみましょう。特にデジタル分野のスキルが今後のキャリアに良い影響をもたらします。
2. 職場の人間関係を見直し、より協力的な姿勢を心がけてください。
3. 9月頃に訪れる新しい機会を逃さないようにしましょう。`;
      } else if (data.messages[0].content.includes('love') || data.messages[0].content.includes('恋愛')) {
        responseText = `【恋愛運】
現在のあなたの恋愛運は、変化の時期を迎えています。過去の経験から学び、新たな出会いに心を開くことで、素晴らしい関係が始まる可能性があります。

【具体的なアドバイス】
1. 自分の価値観を大切にし、妥協しすぎないようにしましょう。
2. 10月から12月にかけて、意味のある出会いがありそうです。
3. 趣味や興味のあることを通じた出会いが特に良い結果をもたらすでしょう。`;
      } else {
        responseText = `【総合運】
あなたの総合運は、徐々に上昇傾向にあります。特に年後半からは、これまでの努力が実を結び始める時期です。

【健康運】
健康面では特に問題はありませんが、睡眠の質を改善することで、さらに活力が増すでしょう。適度な運動と規則正しい生活リズムを心がけてください。

【金運】
金運は安定しています。ただし、衝動的な買い物は控えめにするとよいでしょう。11月頃に臨時収入の可能性があります。

【アドバイス】
1. 新しいことに挑戦する勇気を持ちましょう。
2. 家族や友人との時間を大切にすることで、精神的な豊かさを感じられるでしょう。
3. 自己啓発に時間を使うことが、将来の成功につながります。`;
      }
      
      return Promise.resolve({
        data: {
          content: [{ 
            type: 'text',
            text: responseText
          }],
          usage: { 
            input_tokens: 500, 
            output_tokens: 1000 
          }
        }
      });
    });
  });
  
  afterAll(() => {
    // 環境変数のクリーンアップ
    delete process.env.CLAUDE_API_KEY;
    delete process.env.NODE_ENV;
  });
  
  describe('APIエンドポイントテスト', () => {
    test('ヘルスチェックエンドポイントが正常に応答する', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
      expect(response.body.time).toBeDefined();
    });
    
    test('占い生成APIが正常に応答する', async () => {
      const userData = dummyUsers[0];
      
      const response = await request(app)
        .post('/api/ai/generate')
        .send({ userData, fortuneType: userData.fortuneType });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.content).toContain('仕事運');
      expect(response.body.data.fortuneType).toBe('career');
    });
    
    test('PDF生成APIが正常に応答する', async () => {
      // まず占い結果を生成
      const userData = dummyUsers[1];
      const fortuneResult = await generateFortune(userData, userData.fortuneType);
      
      // PDF生成APIをテスト
      const response = await request(app)
        .post('/api/pdf/generate')
        .send({ fortuneData: fortuneResult });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.pdfPath).toBeDefined();
      expect(response.body.data.fileName).toBeDefined();
    });
  });
  
  describe('E2E統合フロー', () => {
    test('占い生成からPDF作成、メール送信までの一連のフローをテスト', async () => {
      // テスト実行時間を延長
      jest.setTimeout(15000);
      
      // ダミーユーザーデータ
      const userData = dummyUsers[2];
      
      // ステップ1: 占い生成
      const fortuneResult = await generateFortune(userData, userData.fortuneType);
      
      // 結果の検証
      expect(fortuneResult).toBeDefined();
      expect(fortuneResult.fortuneType).toBe(userData.fortuneType);
      expect(fortuneResult.content).toContain('総合運');
      expect(fortuneResult.orderId).toBe(userData.orderId);
      
      // ステップ2: PDF生成
      const pdfPath = await generateFortunePDF(fortuneResult);
      
      // PDF生成結果の検証
      expect(pdfPath).toBeDefined();
      expect(typeof pdfPath).toBe('string');
      expect(pdfPath).toContain(userData.orderId);
      
      // ステップ3: メール送信
      const emailResult = await sendFortuneEmail({
        ...fortuneResult,
        email: userData.email,
        name: userData.name
      }, pdfPath);
      
      // メール送信結果の検証
      expect(emailResult).toBeDefined();
      expect(emailResult.success).toBe(true);
      expect(emailResult.to).toBe(userData.email);
      
      // Claude APIが正しく呼び出されたことを確認
      expect(axios.post).toHaveBeenCalledTimes(1);
    });
    
    test('複数ユーザーに対する占い生成と結果配信をテスト', async () => {
      // テスト実行時間を延長
      jest.setTimeout(30000);
      
      // 各ユーザーに対して占い＆PDF＆メール送信を実行
      for (const userData of dummyUsers) {
        // ステップ1: 占い生成
        const fortuneResult = await generateFortune(userData, userData.fortuneType);
        
        // 結果の検証
        expect(fortuneResult).toBeDefined();
        expect(fortuneResult.fortuneType).toBe(userData.fortuneType);
        expect(fortuneResult.orderId).toBe(userData.orderId);
        
        // ステップ2: PDF生成
        const pdfPath = await generateFortunePDF(fortuneResult);
        
        // PDF生成結果の検証
        expect(pdfPath).toBeDefined();
        expect(pdfPath).toContain(userData.orderId);
        
        // ステップ3: メール送信
        const emailResult = await sendFortuneEmail({
          ...fortuneResult,
          email: userData.email,
          name: userData.name
        }, pdfPath);
        
        // メール送信結果の検証
        expect(emailResult).toBeDefined();
        expect(emailResult.success).toBe(true);
        expect(emailResult.to).toBe(userData.email);
      }
      
      // 各ユーザー分のAPI呼び出しが行われたことを確認
      expect(axios.post).toHaveBeenCalledTimes(dummyUsers.length);
    });
    
    test('エラーケースのハンドリング - 不完全なユーザーデータ', async () => {
      // 不完全なユーザーデータ（birthDateが欠けている）
      const incompleteUserData = {
        orderId: 'E2E_TEST_ERROR',
        name: 'エラーテスト',
        // birthDateが欠けている
        consultation: 'エラーテスト用のデータです',
        email: 'error@example.com',
        fortuneType: 'general'
      };
      
      // エラーが発生するはず
      await expect(generateFortune(incompleteUserData, 'general')).rejects.toThrow();
      
      // APIリクエストも失敗するはず
      const response = await request(app)
        .post('/api/ai/generate')
        .send({ userData: incompleteUserData, fortuneType: 'general' });
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });
});
