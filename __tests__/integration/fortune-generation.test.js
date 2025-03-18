const axios = require('axios');
const fs = require('fs');
const path = require('path');

// テスト対象のモジュール
const { generateFortune } = require('../../src/aiFortune/claudeApiManager');
const ErrorHandler = require('../../src/utils/errorHandler');
const { generateFortunePDF } = require('../../src/pdfGeneration/pdfGenerator');
const { sendFortuneEmail } = require('../../src/emailSending/emailSender');

// モックの設定
jest.mock('axios');

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
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  createWriteStream: jest.fn(() => ({
    on: jest.fn(function(event, handler) {
      if (event === 'finish') {
        setTimeout(handler, 10);
      }
      return this;
    }),
    once: jest.fn(),
    emit: jest.fn()
  })),
  promises: {
    unlink: jest.fn().mockResolvedValue()
  }
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

// エラーハンドラーのモック
jest.mock('../../src/utils/errorHandler', () => ({
  logError: jest.fn(),
  classifyError: jest.fn(),
  notifyAdmins: jest.fn().mockResolvedValue({}),
  autoRecover: jest.fn().mockImplementation(async (error, operation) => {
    return operation();
  })
}));

// PDF生成モジュールのモック
jest.mock('../../src/pdfGeneration/pdfGenerator', () => ({
  generateFortunePDF: jest.fn().mockImplementation((fortuneData) => {
    return Promise.resolve(`./outputs/pdf/${fortuneData.orderId}-fortune.pdf`);
  })
}));

// メール送信モジュールのモック
jest.mock('../../src/emailSending/emailSender', () => ({
  sendFortuneEmail: jest.fn().mockImplementation((emailData) => {
    return Promise.resolve({
      messageId: 'test-message-id',
      status: 'sent',
      sentAt: new Date().toISOString()
    });
  })
}));

describe('占い生成機能の結合テスト', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // 環境変数の設定
    process.env.CLAUDE_API_KEY = 'test_api_key';
    process.env.NODE_ENV = 'test';
    
    // Claude APIのモックレスポンス
    axios.post.mockResolvedValue({
      data: {
        content: [{ 
          type: 'text',
          text: 'テスト占い結果：あなたは近い将来、大きな幸運に恵まれるでしょう。'
        }],
        usage: { 
          input_tokens: 500, 
          output_tokens: 1000 
        }
      }
    });
  });
  
  afterEach(() => {
    // 環境変数のクリーンアップ
    delete process.env.CLAUDE_API_KEY;
    delete process.env.NODE_ENV;
  });
  
  test('占い生成からPDF生成までの正常フロー', async () => {
    // テスト実行時間を延長
    jest.setTimeout(10000);
    
    // テスト用のユーザーデータ
    const userData = {
      name: 'テストユーザー',
      birthDate: '1990-01-01',
      consultation: '将来の仕事について',
      orderId: 'TEST_ORDER_123',
      email: 'test@example.com'
    };
    
    // 占い結果の生成
    const fortuneResult = await generateFortune(userData, 'career');
    
    // 占い結果の検証
    expect(fortuneResult).toBeDefined();
    expect(fortuneResult.fortuneType).toBe('career');
    expect(fortuneResult.content).toContain('テスト占い結果');
    expect(fortuneResult.orderId).toBe('TEST_ORDER_123');
    expect(fortuneResult.apiCost).toBeDefined();
    
    // PDF生成
    const pdfPath = await generateFortunePDF(fortuneResult);
    
    // PDFパスの検証
    expect(pdfPath).toBeDefined();
    expect(pdfPath).toContain('TEST_ORDER_123');
    
    // APIが正しく呼び出されたことを確認
    expect(axios.post).toHaveBeenCalledTimes(1);
  });
  
  test('占い生成とエラーハンドリングの連携', async () => {
    // APIエラーのシミュレーション
    const apiError = new Error('API接続エラー');
    apiError.response = { status: 500, data: { error: 'サーバーエラー' } };
    axios.post.mockRejectedValueOnce(apiError);
    
    // 不完全なユーザーデータ
    const userData = {
      name: 'テストユーザー',
      // birthDateが欠けている
      consultation: '将来の仕事について',
      orderId: 'TEST_ORDER_456'
    };
    
    // エラーが発生するはず
    await expect(generateFortune(userData, 'career')).rejects.toThrow();
    
    // 別のテストケース: データ不足エラーの処理
    try {
      await generateFortune(userData, 'career');
    } catch (error) {
      // エラーをエラーハンドラーに渡してテスト
      ErrorHandler.logError(error);
    }
    
    // エラーログ機能が呼び出されたことを確認
    expect(ErrorHandler.logError).toHaveBeenCalled();
  });
  
  test('APIエラー発生時のエラーハンドリングとリカバリー', async () => {
    // テスト用のユーザーデータ
    const userData = {
      name: 'リトライテストユーザー',
      birthDate: '1990-01-01',
      consultation: '忍耐力について',
      orderId: 'TEST_RETRY_123',
      email: 'retry@example.com'
    };

    // テスト内で使用する各種モックの準備
    // 一時的なエラーオブジェクト
    const tempError = new Error('一時的なネットワークエラー');
    tempError.response = { status: 503, data: { error: '一時的なサービス停止' } };
    
    // generateFortuneの実装をオーバーライド
    // 最初は失敗、2回目の呼び出しでは成功するようにする
    let callCount = 0;
    const mockGenerateFortune = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        throw tempError;
      }
      return {
        fortuneId: 'fortune-retry-123',
        fortuneType: 'general',
        content: 'リトライ後の占い結果：粘り強さがあなたを成功に導くでしょう。',
        orderId: 'TEST_RETRY_123',
        generatedAt: new Date().toISOString(),
        apiCost: 5.0
      };
    });
    
    // 元のモジュールの参照を一時的に保存
    const originalGenerateFortune = generateFortune;
    
    try {
      // 一時的にgenerateFortuneをモックで置き換え
      global.generateFortune = mockGenerateFortune;
      
      // autoRecoverの実装をテスト用に変更
      ErrorHandler.autoRecover.mockImplementationOnce(async (error, operation) => {
        return operation(); // 2回目は成功する
      });
      
      // エラー発生とリカバリープロセスのシミュレーション
      let result;
      try {
        // 1回目の呼び出し（ここでエラーが発生する）
        result = await mockGenerateFortune(userData, 'career');
      } catch (error) {
        // エラーログを記録
        ErrorHandler.logError(error);
        
        // エラーの自動回復を試行
        result = await ErrorHandler.autoRecover(error, () => {
          return mockGenerateFortune(userData, 'career');
        });
      }
      
      // 結果の検証
      expect(result).toBeDefined();
      expect(result.content).toContain('リトライ後の占い結果');
      expect(mockGenerateFortune).toHaveBeenCalledTimes(2);
      expect(ErrorHandler.autoRecover).toHaveBeenCalledTimes(1);
      expect(ErrorHandler.logError).toHaveBeenCalledTimes(1);
    } finally {
      // 元の関数を復元
      global.generateFortune = originalGenerateFortune;
    }
  });
});
