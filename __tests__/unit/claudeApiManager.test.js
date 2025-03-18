const axios = require('axios');

// モックの設定
jest.mock('axios');

// expressモジュールのモック
const mockRouter = {
  post: jest.fn(),
  get: jest.fn()
};

jest.mock('express', () => ({
  Router: jest.fn(() => mockRouter)
}));

// プロンプトテンプレートのモック
jest.mock('../../src/aiFortune/promptTemplates', () => ({
  getPromptTemplate: jest.fn().mockReturnValue({
    title: '総合運',
    content: '占い鑑定プロンプト: [NAME]様、[BIRTHDATE]生まれの方の鑑定を行います。相談内容: [CONSULTATION]'
  })
}));

// fs モジュールのモック（データベース保存処理に使用される可能性があるため）
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn()
}));

// プロンプトテンプレートモジュールを取得してテスト内で操作できるようにする
const promptTemplateModule = require('../../src/aiFortune/promptTemplates');

// テスト対象のモジュールを読み込む前に環境変数を設定
process.env.CLAUDE_API_KEY = 'test_api_key';
process.env.NODE_ENV = 'production';

// テスト対象のモジュールを読み込む
const claudeApiManager = require('../../src/aiFortune/claudeApiManager');
const { generateFortune, calculateCost, router } = claudeApiManager;

describe('Claude API 占い生成機能テスト', () => {
  // テスト前の設定
  beforeEach(() => {
    jest.clearAllMocks();
    // モックAPIレスポンスの設定
    axios.post.mockResolvedValue({
      data: {
        content: [
          { 
            type: 'text',
            text: 'テスト占い結果：あなたは近い将来、大きな幸運に恵まれるでしょう。'
          }
        ],
        usage: { 
          input_tokens: 500, 
          output_tokens: 1000 
        }
      }
    });
    
    // プロンプトテンプレートのデフォルト値をリセット
    promptTemplateModule.getPromptTemplate.mockReturnValue({
      title: '総合運',
      content: '占い鑑定プロンプト: [NAME]様、[BIRTHDATE]生まれの方の鑑定を行います。相談内容: [CONSULTATION]'
    });

    // 環境変数のリセット
    process.env.CLAUDE_API_KEY = 'test_api_key';
  });

  test('占い結果が正しく生成されること', async () => {
    // テスト用のユーザーデータ
    const userData = {
      name: 'テストユーザー',
      birthDate: '1990-01-01',
      consultation: '将来の仕事について',
      orderId: 'TEST123'
    };

    // 環境変数の設定
    process.env.CLAUDE_API_KEY = 'test_api_key';
    process.env.NODE_ENV = 'production';

    // 関数の実行
    const result = await generateFortune(userData, 'general');

    // アサーション
    expect(result).toBeDefined();
    expect(result.fortuneType).toBe('general');
    expect(result.content).toBe('テスト占い結果：あなたは近い将来、大きな幸運に恵まれるでしょう。');
    expect(result.orderId).toBe('TEST123');
    expect(result.apiCost).toBeDefined();
    
    // APIが正しく呼び出されたことを確認
    expect(axios.post).toHaveBeenCalled();
    const apiCallArgs = axios.post.mock.calls[0];
    expect(apiCallArgs[0]).toBe('https://api.anthropic.com/v1/messages');
    expect(apiCallArgs[1].messages[0].content).toContain('テストユーザー');
    expect(apiCallArgs[1].messages[0].content).toContain('1990-01-01');
  });

  test('開発環境ではAPIが呼び出されないこと', async () => {
    // テスト用のユーザーデータ
    const userData = {
      name: 'テストユーザー',
      birthDate: '1990-01-01',
      consultation: '将来の仕事について',
      orderId: 'TEST456'
    };

    // 環境変数の設定（開発環境）
    process.env.CLAUDE_API_KEY = 'test_api_key';
    process.env.NODE_ENV = 'development';

    // 関数の実行
    const result = await generateFortune(userData, 'general');

    // アサーション
    expect(result).toBeDefined();
    expect(result.fortuneType).toBe('general');
    expect(result.content).toContain('開発環境ダミーデータ');
    expect(result.orderId).toBe('TEST456');
    expect(result.apiCost).toBe(0);
    
    // APIが呼び出されないことを確認
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('必要なユーザーデータが不足している場合はエラーが発生すること', async () => {
    // 不完全なユーザーデータ
    const incompleteUserData = {
      name: 'テストユーザー'
      // birthDateが欠けている
    };

    // 環境変数の設定
    process.env.CLAUDE_API_KEY = 'test_api_key';

    // 関数の実行と例外のキャッチ
    await expect(generateFortune(incompleteUserData)).rejects.toThrow('鑑定に必要なデータが不足しています');
    
    // APIが呼び出されないことを確認
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('APIキーが設定されていない場合はエラーが発生すること', async () => {
    // テスト用のユーザーデータ
    const userData = {
      name: 'テストユーザー',
      birthDate: '1990-01-01',
      consultation: '将来の仕事について',
      orderId: 'TEST789'
    };

    // APIキーを未設定にする
    delete process.env.CLAUDE_API_KEY;

    // 関数の実行と例外のキャッチ
    await expect(generateFortune(userData)).rejects.toThrow('Claude API キーが設定されていません');
    
    // APIが呼び出されないことを確認
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('プロンプトテンプレートが見つからない場合はエラーが発生すること', async () => {
    // テスト用のユーザーデータ
    const userData = {
      name: 'テストユーザー',
      birthDate: '1990-01-01',
      consultation: '将来の仕事について',
      orderId: 'TEST101'
    };

    // 環境変数の設定
    process.env.CLAUDE_API_KEY = 'test_api_key';
    
    // プロンプトテンプレートが見つからないようにモックを変更
    promptTemplateModule.getPromptTemplate.mockReturnValueOnce(null);

    // 関数の実行と例外のキャッチ
    await expect(generateFortune(userData, 'unknown_type')).rejects.toThrow('占いタイプ unknown_type のテンプレートが見つかりません');
    
    // APIが呼び出されないことを確認
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('API呼び出し時にエラーが発生した場合は適切に処理されること', async () => {
    // テスト用のユーザーデータ
    const userData = {
      name: 'テストユーザー',
      birthDate: '1990-01-01',
      consultation: '将来の仕事について',
      orderId: 'TEST102'
    };

    // 環境変数の設定
    process.env.CLAUDE_API_KEY = 'test_api_key';
    process.env.NODE_ENV = 'production';
    
    // API呼び出しがエラーを返すように設定
    const apiError = new Error('API接続エラー');
    apiError.response = { status: 500, data: { error: 'サーバーエラー' } };
    axios.post.mockRejectedValueOnce(apiError);

    // 関数の実行と例外のキャッチ
    await expect(generateFortune(userData)).rejects.toThrow('鑑定結果の生成に失敗しました');
    
    // APIが呼び出されたことを確認
    expect(axios.post).toHaveBeenCalled();
  });

  test('calculateCost関数が正しくコストを計算すること', () => {
    // テスト用のAPI使用量データ
    const usage = {
      input_tokens: 1000,
      output_tokens: 2000
    };
    
    // 関数の実行
    const cost = calculateCost(usage);
    
    // アサーション（入力1000トークン + 出力2000トークンのコスト）
    // 入力: $3.00 / 1M tokens × 1000 tokens × 150円/$
    // 出力: $15.00 / 1M tokens × 2000 tokens × 150円/$
    // 合計: 0.45円 + 4.5円 = 4.95円（小数点第2位まで）
    expect(cost).toBeCloseTo(4.95);
  });

  test('usage情報が不完全な場合もcalculateCost関数が正しく動作すること', () => {
    // 不完全なusage情報
    const incompleteUsage = {};
    
    // 関数の実行
    const cost = calculateCost(incompleteUsage);
    
    // アサーション（0トークンなのでコストは0円）
    expect(cost).toBe(0);
  });

  // モジュール全体のエクスポート機能をテスト
  describe('モジュールのエクスポート', () => {
    test('generateFortuneとrouterがエクスポートされていること', () => {
      expect(claudeApiManager.generateFortune).toBeDefined();
      expect(typeof claudeApiManager.generateFortune).toBe('function');
      expect(claudeApiManager.router).toBeDefined();
    });
    
    test('calculateCost関数がエクスポートされていること', () => {
      expect(claudeApiManager.calculateCost).toBeDefined();
      expect(typeof claudeApiManager.calculateCost).toBe('function');
    });
  });
});
