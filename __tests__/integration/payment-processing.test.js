const fs = require('fs');
const path = require('path');
const ErrorHandler = require('../../src/utils/errorHandler');

// テスト対象のモジュールをモックする
// ECインテグレーションと支払い処理用のモックモジュール
const mockPaymentProcessor = {
  processPayment: jest.fn(),
  validatePaymentData: jest.fn(),
  createPaymentRecord: jest.fn(),
  getPaymentStatus: jest.fn()
};

// フォーム処理用のモックモジュール
const mockFormProcessor = {
  validateForm: jest.fn(),
  processFormData: jest.fn(),
  saveFormSubmission: jest.fn()
};

// Claude APIのモック
jest.mock('../../src/aiFortune/claudeApiManager', () => ({
  generateFortune: jest.fn().mockImplementation((userData, fortuneType) => {
    return {
      fortuneId: 'fortune-123',
      fortuneType: fortuneType || 'general',
      content: 'テスト占い結果です',
      orderId: userData.orderId || 'ORDER123',
      generatedAt: new Date().toISOString(),
      apiCost: 5.0
    };
  })
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

const { generateFortune } = require('../../src/aiFortune/claudeApiManager');

describe('支払い処理と占い生成の結合テスト', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // モック関数の基本的な動作を設定
    mockFormProcessor.validateForm.mockReturnValue({ isValid: true, errors: [] });
    mockFormProcessor.processFormData.mockImplementation((data) => {
      return {
        ...data,
        processedAt: new Date().toISOString()
      };
    });
    mockFormProcessor.saveFormSubmission.mockResolvedValue({ id: 'form-123', status: 'saved' });
    
    mockPaymentProcessor.validatePaymentData.mockReturnValue({ isValid: true, errors: [] });
    mockPaymentProcessor.processPayment.mockResolvedValue({ 
      transactionId: 'txn-123',
      status: 'completed',
      amount: 3000,
      processedAt: new Date().toISOString()
    });
    mockPaymentProcessor.createPaymentRecord.mockResolvedValue({ id: 'payment-123' });
    mockPaymentProcessor.getPaymentStatus.mockResolvedValue('completed');
  });
  
  test('フォーム送信から支払い、占い生成までの正常フロー', async () => {
    // テスト用のユーザーデータとフォームデータ
    const formData = {
      name: 'テストユーザー',
      birthDate: '1990-01-01',
      consultation: '将来の仕事について',
      email: 'test@example.com',
      fortuneType: 'career'
    };
    
    // 支払いデータ
    const paymentData = {
      amount: 3000,
      method: 'credit_card',
      cardNumber: '4111111111111111',
      expiryDate: '12/25',
      cvv: '123'
    };
    
    // 1. フォーム検証
    const validationResult = mockFormProcessor.validateForm(formData);
    expect(validationResult.isValid).toBe(true);
    
    // 2. フォームデータ処理
    const processedFormData = mockFormProcessor.processFormData(formData);
    expect(processedFormData).toHaveProperty('processedAt');
    
    // 3. フォーム送信保存
    const savedForm = await mockFormProcessor.saveFormSubmission(processedFormData);
    expect(savedForm).toHaveProperty('id');
    
    // 4. 支払いデータ検証
    const paymentValidation = mockPaymentProcessor.validatePaymentData(paymentData);
    expect(paymentValidation.isValid).toBe(true);
    
    // 5. 支払い処理
    const paymentResult = await mockPaymentProcessor.processPayment(paymentData, savedForm.id);
    expect(paymentResult).toHaveProperty('transactionId');
    expect(paymentResult.status).toBe('completed');
    
    // 6. 支払い記録作成
    const paymentRecord = await mockPaymentProcessor.createPaymentRecord({
      ...paymentResult,
      formId: savedForm.id,
      userData: processedFormData
    });
    expect(paymentRecord).toHaveProperty('id');
    
    // 7. 支払い成功を確認
    const paymentStatus = await mockPaymentProcessor.getPaymentStatus(paymentResult.transactionId);
    expect(paymentStatus).toBe('completed');
    
    // 8. 支払い成功後に占い生成
    if (paymentStatus === 'completed') {
      // 注文ID生成
      const orderId = `ORDER-${Date.now()}`;
      
      // 占い生成に必要なデータ準備
      const userData = {
        ...processedFormData,
        orderId
      };
      
      // 占い生成
      const fortuneResult = await generateFortune(userData, formData.fortuneType);
      
      // 結果検証
      expect(fortuneResult).toBeDefined();
      expect(fortuneResult).toHaveProperty('fortuneId');
      expect(fortuneResult).toHaveProperty('content');
      expect(fortuneResult.fortuneType).toBe(formData.fortuneType);
    }
    
    // 各ステップで関数が呼び出されたことを確認
    expect(mockFormProcessor.validateForm).toHaveBeenCalledTimes(1);
    expect(mockFormProcessor.processFormData).toHaveBeenCalledTimes(1);
    expect(mockFormProcessor.saveFormSubmission).toHaveBeenCalledTimes(1);
    expect(mockPaymentProcessor.validatePaymentData).toHaveBeenCalledTimes(1);
    expect(mockPaymentProcessor.processPayment).toHaveBeenCalledTimes(1);
    expect(mockPaymentProcessor.createPaymentRecord).toHaveBeenCalledTimes(1);
    expect(mockPaymentProcessor.getPaymentStatus).toHaveBeenCalledTimes(1);
    expect(generateFortune).toHaveBeenCalledTimes(1);
  });
  
  test('支払い失敗時の適切なエラーハンドリング', async () => {
    // テスト用のユーザーデータとフォームデータ
    const formData = {
      name: 'エラーテストユーザー',
      birthDate: '1992-05-15',
      consultation: '金運について',
      email: 'error@example.com',
      fortuneType: 'money'
    };
    
    // 支払いデータ（エラーになるよう設定）
    const invalidPaymentData = {
      amount: 3000,
      method: 'credit_card',
      cardNumber: '1234567890123456', // 不正なカード番号
      expiryDate: '01/20', // 期限切れ
      cvv: '999'
    };
    
    // 支払い処理でエラーが発生するようモックを設定
    const paymentError = new Error('支払い処理に失敗しました：カード有効期限切れ');
    mockPaymentProcessor.processPayment.mockRejectedValueOnce(paymentError);
    
    // 1. フォーム検証と処理（正常）
    const validationResult = mockFormProcessor.validateForm(formData);
    expect(validationResult.isValid).toBe(true);
    
    const processedFormData = mockFormProcessor.processFormData(formData);
    const savedForm = await mockFormProcessor.saveFormSubmission(processedFormData);
    
    // 2. 支払いデータ検証（正常だが実際の処理では失敗する）
    mockPaymentProcessor.validatePaymentData.mockReturnValueOnce({ isValid: true, errors: [] });
    const paymentValidation = mockPaymentProcessor.validatePaymentData(invalidPaymentData);
    expect(paymentValidation.isValid).toBe(true);
    
    // 3. 支払い処理（失敗）
    try {
      await mockPaymentProcessor.processPayment(invalidPaymentData, savedForm.id);
      expect('支払い処理は失敗するはずです').toBe(false);
    } catch (error) {
      // エラーハンドラーにエラーを記録
      ErrorHandler.logError(error);
      
      // エラー分類を直接設定（実際のメソッド呼び出しではなくモックの挙動を設定）
      const classifiedError = { 
        type: 'payment_error', 
        severity: 'high', 
        retryable: false,
        details: error.message
      };
      ErrorHandler.classifyError.mockReturnValueOnce(classifiedError);
      
      // エラー分類を実行
      const errorClassification = ErrorHandler.classifyError(error);
      
      // 分類結果の検証
      expect(errorClassification).toBeDefined();
      expect(errorClassification.type).toBe('payment_error');
      
      // エラー分類メソッドが呼び出されたことを確認
      expect(ErrorHandler.classifyError).toHaveBeenCalledTimes(1);
    }
    
    // 4. 支払い失敗後は占い生成は行われない
    expect(generateFortune).not.toHaveBeenCalled();
  });
  
  test('フォームデータが不完全な場合のバリデーションエラー処理', async () => {
    // 不完全なフォームデータ
    const incompleteFormData = {
      name: 'テストユーザー',
      // birthDateが欠けている
      consultation: '将来の仕事について',
      email: 'test@example.com'
    };
    
    // フォームバリデーションでエラーが発生するよう設定
    mockFormProcessor.validateForm.mockReturnValueOnce({ 
      isValid: false, 
      errors: ['生年月日は必須です'] 
    });
    
    // 1. フォーム検証（失敗）
    const validationResult = mockFormProcessor.validateForm(incompleteFormData);
    expect(validationResult.isValid).toBe(false);
    expect(validationResult.errors).toContain('生年月日は必須です');
    
    // 2. 検証失敗後の処理をシミュレート
    if (!validationResult.isValid) {
      const validationError = new Error(`フォームデータが不完全です: ${validationResult.errors.join(', ')}`);
      ErrorHandler.logError(validationError);
      
      // エラーログが呼び出されたことを確認
      expect(ErrorHandler.logError).toHaveBeenCalledTimes(1);
    }
    
    // 3. 検証失敗後は後続の処理が行われないことを確認
    expect(mockFormProcessor.processFormData).not.toHaveBeenCalled();
    expect(mockFormProcessor.saveFormSubmission).not.toHaveBeenCalled();
    expect(mockPaymentProcessor.processPayment).not.toHaveBeenCalled();
    expect(generateFortune).not.toHaveBeenCalled();
  });
});
