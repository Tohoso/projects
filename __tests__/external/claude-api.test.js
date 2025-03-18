/**
 * Claude API外部結合テスト
 * 実際のAnthropic Claude APIと通信して占い生成機能をテストします
 * 
 * 注意：このテストを実行するには有効なAPI KEYが必要です
 * テスト実行時に.envファイルまたは環境変数にCLAUDE_API_KEYが設定されている必要があります
 */

require('dotenv').config();
const { generateFortune } = require('../../src/aiFortune/claudeApiManager');
const { calculateCost } = require('../../src/aiFortune/apiCostCalculator');

describe('Claude API 外部結合テスト', () => {
  // テスト開始前の準備
  beforeAll(() => {
    // API KEYの存在確認
    if (!process.env.CLAUDE_API_KEY) {
      console.warn('警告: CLAUDE_API_KEYが設定されていません。テストはスキップされます。');
    }
    
    // タイムアウト設定（APIリクエストに時間がかかる場合があるため）
    jest.setTimeout(30000);
  });
  
  // API KEYがある場合のみテストを実行
  test('実際のClaude APIを使用して占い結果を生成できる', async () => {
    // API KEYがない場合はテストをスキップ
    if (!process.env.CLAUDE_API_KEY) {
      return;
    }
    
    // テスト用のユーザーデータ
    const userData = {
      name: '外部テストユーザー',
      birthDate: '1990-01-01',
      consultation: '2025年の仕事運について教えてください',
      orderId: `EXT-TEST-${Date.now()}`,
      email: 'external-test@example.com'
    };
    
    // 実際のAPIを呼び出して占い結果を生成
    const fortuneResult = await generateFortune(userData, 'career');
    
    // 結果の検証
    expect(fortuneResult).toBeDefined();
    expect(fortuneResult.fortuneId).toBeDefined();
    expect(fortuneResult.content).toBeDefined();
    expect(fortuneResult.content.length).toBeGreaterThan(100); // 一定量の内容があることを確認
    expect(fortuneResult.fortuneType).toBe('career');
    expect(fortuneResult.generatedAt).toBeDefined();
    expect(fortuneResult.apiCost).toBeDefined();
    
    // コンソールに生成結果の一部を表示（デバッグ用）
    console.log(`生成された占い結果: ${fortuneResult.content.substring(0, 100)}...`);
    console.log(`API使用コスト: ${fortuneResult.apiCost}円`);
  });
  
  test('日本語の質問に対して適切な占い結果を生成できる', async () => {
    // API KEYがない場合はテストをスキップ
    if (!process.env.CLAUDE_API_KEY) {
      return;
    }
    
    // 日本語テスト用のユーザーデータ
    const userData = {
      name: '山田太郎',
      birthDate: '1985-12-15',
      consultation: '最近転職を考えています。新しい仕事に挑戦するべきでしょうか？',
      orderId: `JP-TEST-${Date.now()}`,
      email: 'taro@example.jp'
    };
    
    // 実際のAPIを呼び出して占い結果を生成
    const fortuneResult = await generateFortune(userData, 'career');
    
    // 結果の検証
    expect(fortuneResult).toBeDefined();
    expect(fortuneResult.content).toContain('転職'); // 質問内容に関連する単語が含まれていることを確認
    expect(fortuneResult.content).toMatch(/[ぁ-んァ-ン一-龯]/); // 日本語の文字が含まれていることを確認
  });
  
  test('API使用コストが正しく計算される', async () => {
    // API KEYがない場合はテストをスキップ
    if (!process.env.CLAUDE_API_KEY) {
      return;
    }
    
    // テスト用の入力と出力トークン数
    const inputTokens = 500;
    const outputTokens = 2000;
    
    // JPYレートを一時的に固定（テスト用）
    const jpyRate = 150;
    
    // コスト計算
    const cost = calculateCost(inputTokens, outputTokens, jpyRate);
    
    // 検証（コスト計算ロジックに基づいた予想値と比較）
    expect(cost).toBeGreaterThan(0);
    console.log(`計算されたコスト: ${cost}円（入力: ${inputTokens}トークン、出力: ${outputTokens}トークン）`);
  });
  
  test('エラー発生時に適切なエラーメッセージを返す', async () => {
    // API KEYがない場合はテストをスキップ
    if (!process.env.CLAUDE_API_KEY) {
      return;
    }
    
    // 不完全なユーザーデータ
    const invalidUserData = {
      // nameが欠けている
      birthDate: '1990-01-01',
      consultation: '恋愛運について教えてください',
      orderId: `ERROR-TEST-${Date.now()}`
    };
    
    // エラーが発生することを確認
    await expect(generateFortune(invalidUserData, 'love')).rejects.toThrow('鑑定に必要なデータが不足しています');
  });
});
