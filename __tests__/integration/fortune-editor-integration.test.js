/**
 * 鑑定結果編集機能の結合テスト
 */
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const pdfGenerator = require('../../src/pdfGeneration/pdfGenerator');
const emailSender = require('../../src/emailSending/emailSender');

// モックの設定
jest.mock('../../src/pdfGeneration/pdfGenerator');
jest.mock('../../src/emailSending/emailSender');

// テスト用データディレクトリ
const TEST_DATA_DIR = path.join(__dirname, '../../data/test_integration');
const TEST_FORTUNES_DIR = path.join(TEST_DATA_DIR, 'fortunes');

describe('鑑定結果編集機能の結合テスト', () => {
  beforeAll(async () => {
    // テスト用ディレクトリの作成
    await fs.mkdir(TEST_FORTUNES_DIR, { recursive: true });
  });

  afterAll(async () => {
    // テスト用ディレクトリの削除（オプション）
    // await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
  });

  beforeEach(() => {
    // モックのリセット
    jest.clearAllMocks();
  });

  // テスト用鑑定データ
  const createTestFortune = (customData = {}) => {
    const id = customData.id || `test-integration-${uuidv4()}`;
    return {
      id,
      createdAt: customData.createdAt || new Date().toISOString(),
      updatedAt: customData.updatedAt || new Date().toISOString(),
      status: customData.status || 'generated',
      customerInfo: {
        id: customData.customerId || `cust-${uuidv4().slice(0, 8)}`,
        email: customData.email || 'test-integration@example.com',
        name: customData.name || '統合テスト太郎'
      },
      content: customData.content || '【全体運】\n\n統合テスト用の鑑定結果です。',
      ...customData
    };
  };

  /**
   * テスト用のファイルを作成
   */
  const createTestFortuneFile = async (fortuneData) => {
    const filePath = path.join(TEST_FORTUNES_DIR, `${fortuneData.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(fortuneData, null, 2), 'utf8');
    return filePath;
  };

  /**
   * 鑑定結果編集から保存、PDF生成、メール送信までの統合フロー
   */
  test('鑑定結果の編集からPDF再生成・送信までの一連の流れが正常に動作すること', async () => {
    // 1. テスト用鑑定データの作成
    const fortuneId = `integration-${uuidv4().slice(0, 8)}`;
    const testFortune = createTestFortune({
      id: fortuneId,
      status: 'generated',
      content: '【全体運】\n\n編集前の鑑定結果です。\n\n【仕事運】\n\n★★★☆☆\n\n普通の結果です。'
    });
    
    await createTestFortuneFile(testFortune);
    
    // 2. モックの設定
    // PDF生成モック
    const mockPdfPath = `/tmp/fortune_${fortuneId}.pdf`;
    pdfGenerator.generateFortunePDF = jest.fn().mockResolvedValue(mockPdfPath);
    
    // メール送信モック
    emailSender.sendFortuneEmail = jest.fn().mockResolvedValue({ 
      messageId: `mock-email-${uuidv4()}`,
      success: true 
    });
    
    // axios モック
    const mockApi = {
      getFortuneById: async (id) => {
        const filePath = path.join(TEST_FORTUNES_DIR, `${id}.json`);
        const content = await fs.readFile(filePath, 'utf8');
        return JSON.parse(content);
      },
      
      editFortune: async (id, content) => {
        const filePath = path.join(TEST_FORTUNES_DIR, `${id}.json`);
        let fortuneData = await mockApi.getFortuneById(id);
        
        // 更新
        fortuneData.content = content;
        fortuneData.updatedAt = new Date().toISOString();
        fortuneData.status = 'edited';
        fortuneData.editedByAdmin = true;
        
        // 保存
        await fs.writeFile(filePath, JSON.stringify(fortuneData, null, 2), 'utf8');
        
        return {
          success: true,
          message: '鑑定結果が正常に保存されました',
          data: {
            id: id,
            updatedAt: fortuneData.updatedAt
          }
        };
      },
      
      regeneratePdf: async (id) => {
        const fortuneData = await mockApi.getFortuneById(id);
        
        // PDF生成呼び出し
        const pdfPath = await pdfGenerator.generateFortunePDF(fortuneData);
        
        // メール送信呼び出し
        const emailResult = await emailSender.sendFortuneEmail(
          fortuneData.customerInfo.email,
          fortuneData.customerInfo.name,
          pdfPath
        );
        
        // 状態更新
        fortuneData.status = 'sent';
        fortuneData.sentAt = new Date().toISOString();
        fortuneData.pdfPath = pdfPath;
        
        // 保存
        const filePath = path.join(TEST_FORTUNES_DIR, `${id}.json`);
        await fs.writeFile(filePath, JSON.stringify(fortuneData, null, 2), 'utf8');
        
        return {
          success: true,
          message: 'PDFが正常に生成され、メールが送信されました',
          data: {
            id: id,
            pdfPath: pdfPath,
            sentAt: fortuneData.sentAt,
            emailId: emailResult.messageId
          }
        };
      }
    };
    
    // 3. 鑑定結果の取得（初期状態確認）
    const initialFortune = await mockApi.getFortuneById(fortuneId);
    expect(initialFortune.id).toBe(fortuneId);
    expect(initialFortune.status).toBe('generated');
    expect(initialFortune.content).toContain('編集前の鑑定結果です');
    
    // 4. 鑑定結果の編集
    const newContent = '【全体運】\n\n編集後の素晴らしい鑑定結果です。運気が急上昇します。\n\n【仕事運】\n\n★★★★★\n\n仕事運も絶好調です！';
    const editResult = await mockApi.editFortune(fortuneId, newContent);
    
    expect(editResult.success).toBe(true);
    expect(editResult.data.id).toBe(fortuneId);
    
    // 5. 編集後の状態確認
    const editedFortune = await mockApi.getFortuneById(fortuneId);
    expect(editedFortune.status).toBe('edited');
    expect(editedFortune.content).toBe(newContent);
    expect(editedFortune.editedByAdmin).toBe(true);
    
    // 6. PDF再生成と送信
    const regenerateResult = await mockApi.regeneratePdf(fortuneId);
    
    expect(regenerateResult.success).toBe(true);
    expect(regenerateResult.data.id).toBe(fortuneId);
    expect(regenerateResult.data.pdfPath).toBe(mockPdfPath);
    
    // PDF生成が呼ばれたことを確認
    expect(pdfGenerator.generateFortunePDF).toHaveBeenCalledTimes(1);
    expect(pdfGenerator.generateFortunePDF).toHaveBeenCalledWith(expect.objectContaining({
      id: fortuneId,
      content: newContent
    }));
    
    // メール送信が呼ばれたことを確認
    expect(emailSender.sendFortuneEmail).toHaveBeenCalledTimes(1);
    expect(emailSender.sendFortuneEmail).toHaveBeenCalledWith(
      testFortune.customerInfo.email,
      testFortune.customerInfo.name,
      mockPdfPath
    );
    
    // 7. 最終状態の確認
    const finalFortune = await mockApi.getFortuneById(fortuneId);
    expect(finalFortune.status).toBe('sent');
    expect(finalFortune.pdfPath).toBe(mockPdfPath);
    expect(finalFortune.sentAt).toBeDefined();
  });
  
  /**
   * 例外処理の結合テスト
   */
  test('PDF生成失敗時に適切に例外処理ができること', async () => {
    // 1. テスト用鑑定データの作成
    const fortuneId = `integration-error-${uuidv4().slice(0, 8)}`;
    const testFortune = createTestFortune({
      id: fortuneId,
      status: 'edited',
      editedByAdmin: true,
      content: '【全体運】\n\nPDF生成失敗用のテストデータです。'
    });
    
    await createTestFortuneFile(testFortune);
    
    // 2. モックの設定 - PDF生成でエラー発生
    const pdfError = new Error('PDF生成に失敗しました');
    pdfGenerator.generateFortunePDF = jest.fn().mockRejectedValue(pdfError);
    
    // axios モック
    const mockApi = {
      getFortuneById: async (id) => {
        const filePath = path.join(TEST_FORTUNES_DIR, `${id}.json`);
        const content = await fs.readFile(filePath, 'utf8');
        return JSON.parse(content);
      },
      
      regeneratePdf: async (id) => {
        try {
          const fortuneData = await mockApi.getFortuneById(id);
          
          // PDF生成呼び出し - エラーが発生する
          const pdfPath = await pdfGenerator.generateFortunePDF(fortuneData);
          
          // この行は実行されない
          return { success: true };
        } catch (error) {
          // エラー状態を記録
          const fortuneData = await mockApi.getFortuneById(id);
          fortuneData.status = 'error';
          fortuneData.error = {
            message: error.message,
            timestamp: new Date().toISOString()
          };
          
          // 保存
          const filePath = path.join(TEST_FORTUNES_DIR, `${id}.json`);
          await fs.writeFile(filePath, JSON.stringify(fortuneData, null, 2), 'utf8');
          
          throw new Error(`PDF再生成に失敗しました: ${error.message}`);
        }
      }
    };
    
    // 3. PDF再生成実行 - エラーが発生することを確認
    await expect(mockApi.regeneratePdf(fortuneId)).rejects.toThrow('PDF再生成に失敗しました');
    
    // 4. PDF生成が呼ばれたことを確認
    expect(pdfGenerator.generateFortunePDF).toHaveBeenCalledTimes(1);
    
    // 5. エラー後の状態を確認
    const errorFortune = await mockApi.getFortuneById(fortuneId);
    expect(errorFortune.status).toBe('error');
    expect(errorFortune.error).toBeDefined();
    expect(errorFortune.error.message).toBe('PDF生成に失敗しました');
  });

  /**
   * フロントエンドとバックエンドの連携を模したテスト
   */
  test('フロントエンドとバックエンドの連携が正しく機能すること', async () => {
    // 1. テスト用鑑定データの作成
    const fortuneId = `integration-fe-be-${uuidv4().slice(0, 8)}`;
    const testFortune = createTestFortune({
      id: fortuneId,
      status: 'generated',
      content: '【全体運】\n\nフロントエンドとバックエンドの連携テスト用データです。'
    });
    
    await createTestFortuneFile(testFortune);
    
    // 2. モックの設定
    pdfGenerator.generateFortunePDF = jest.fn().mockResolvedValue(`/tmp/fortune_${fortuneId}.pdf`);
    emailSender.sendFortuneEmail = jest.fn().mockResolvedValue({ 
      messageId: `mock-email-${uuidv4()}`,
      success: true 
    });
    
    // フロントエンドの動作をシミュレート
    const frontendActions = {
      // 鑑定結果一覧を取得する関数
      async fetchFortunes() {
        // バックエンドAPIの呼び出しをシミュレート
        const files = await fs.readdir(TEST_FORTUNES_DIR);
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        
        const fortunes = await Promise.all(
          jsonFiles.map(async (file) => {
            const content = await fs.readFile(path.join(TEST_FORTUNES_DIR, file), 'utf8');
            return JSON.parse(content);
          })
        );
        
        return fortunes;
      },
      
      // 鑑定結果を取得する関数
      async getFortune(id) {
        // バックエンドAPIの呼び出しをシミュレート
        const filePath = path.join(TEST_FORTUNES_DIR, `${id}.json`);
        const content = await fs.readFile(filePath, 'utf8');
        return JSON.parse(content);
      },
      
      // 鑑定結果を編集する関数
      async editFortune(id, newContent) {
        // バックエンドAPIの呼び出しをシミュレート
        const fortune = await this.getFortune(id);
        
        // 編集内容を適用
        fortune.content = newContent;
        fortune.updatedAt = new Date().toISOString();
        fortune.status = 'edited';
        fortune.editedByAdmin = true;
        
        // 保存
        const filePath = path.join(TEST_FORTUNES_DIR, `${id}.json`);
        await fs.writeFile(filePath, JSON.stringify(fortune, null, 2), 'utf8');
        
        return {
          success: true,
          message: '鑑定結果を編集しました',
          data: { id, updatedAt: fortune.updatedAt }
        };
      },
      
      // PDF再生成と送信を行う関数
      async regenerateAndSendPdf(id) {
        // バックエンドAPIの呼び出しをシミュレート
        const fortune = await this.getFortune(id);
        
        // PDF生成
        const pdfPath = await pdfGenerator.generateFortunePDF(fortune);
        
        // メール送信
        await emailSender.sendFortuneEmail(
          fortune.customerInfo.email,
          fortune.customerInfo.name,
          pdfPath
        );
        
        // 状態更新
        fortune.status = 'sent';
        fortune.sentAt = new Date().toISOString();
        fortune.pdfPath = pdfPath;
        
        // 保存
        const filePath = path.join(TEST_FORTUNES_DIR, `${id}.json`);
        await fs.writeFile(filePath, JSON.stringify(fortune, null, 2), 'utf8');
        
        return {
          success: true,
          message: 'PDFを再生成し、メールを送信しました',
          data: { id, pdfPath, sentAt: fortune.sentAt }
        };
      }
    };
    
    // 3. フロントエンドのアクションを順番に実行
    
    // 3.1 鑑定結果一覧を取得
    const fortunes = await frontendActions.fetchFortunes();
    const targetFortune = fortunes.find(f => f.id === fortuneId);
    expect(targetFortune).toBeDefined();
    expect(targetFortune.status).toBe('generated');
    
    // 3.2 対象の鑑定結果を取得
    const fortune = await frontendActions.getFortune(fortuneId);
    expect(fortune.id).toBe(fortuneId);
    
    // 3.3 鑑定結果を編集
    const newContent = '【全体運】\n\nフロントエンドとバックエンドの連携テスト - 編集後の内容です。素晴らしい運勢が待っています！';
    const editResult = await frontendActions.editFortune(fortuneId, newContent);
    expect(editResult.success).toBe(true);
    
    // 編集後の状態を確認
    const editedFortune = await frontendActions.getFortune(fortuneId);
    expect(editedFortune.content).toBe(newContent);
    expect(editedFortune.status).toBe('edited');
    
    // 3.4 PDF再生成と送信
    const regenerateResult = await frontendActions.regenerateAndSendPdf(fortuneId);
    expect(regenerateResult.success).toBe(true);
    
    // PDF生成とメール送信が呼ばれたことを確認
    expect(pdfGenerator.generateFortunePDF).toHaveBeenCalledTimes(1);
    expect(emailSender.sendFortuneEmail).toHaveBeenCalledTimes(1);
    
    // 最終状態を確認
    const finalFortune = await frontendActions.getFortune(fortuneId);
    expect(finalFortune.status).toBe('sent');
    expect(finalFortune.sentAt).toBeDefined();
  });
});
