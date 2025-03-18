const fs = require('fs');
const path = require('path');

// ErrorHandlerモジュールを読み込む前に、モジュールのパスをモック
jest.mock('path', () => ({
  join: jest.fn().mockImplementation((...args) => args.join('/'))
}));

// モック関数を作成
const mockAppendFileSync = jest.fn();
const mockMkdirSync = jest.fn();
const mockExistsSync = jest.fn();
const mockWriteFileSync = jest.fn();

// ファイルシステムのモック
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  appendFileSync: jest.fn(),
  writeFileSync: jest.fn()
}));

// フックアップモジュールをモックする
// モック関数をfsモジュールに割り当て、後で参照可能にする
fs.existsSync = mockExistsSync;
fs.mkdirSync = mockMkdirSync;
fs.appendFileSync = mockAppendFileSync;
fs.writeFileSync = mockWriteFileSync;

// メール送信モジュールのモック（コメントアウトされていたため、必要になったらコメントを外す）
jest.mock('../../src/emailSending/emailSender', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true })
}));

// プロセス環境変数のモック
const originalNodeEnv = process.env.NODE_ENV;
const originalAdminEmail = process.env.ADMIN_EMAIL;

// テスト用にエラーハンドラーモジュールをインポート
const ErrorHandler = require('../../src/utils/errorHandler');

describe('エラーハンドラーテスト', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
    console.warn = jest.fn();
    console.log = jest.fn();
    
    // テスト用の環境変数設定
    process.env.NODE_ENV = 'test';
    process.env.ADMIN_EMAIL = 'admin@example.com';
  });
  
  afterEach(() => {
    // 環境変数を元に戻す
    process.env.NODE_ENV = originalNodeEnv;
    process.env.ADMIN_EMAIL = originalAdminEmail;
  });

  test('エラーがログに記録されること', () => {
    // ログディレクトリが存在する場合
    mockExistsSync.mockReturnValue(true);
    
    // テスト用のエラー
    const testError = new Error('テストエラー');
    
    // 関数を実行
    ErrorHandler.logError(testError, 'テストモジュール');
    
    // アサーション
    expect(console.error).toHaveBeenCalled();
    expect(mockAppendFileSync).toHaveBeenCalled();
    
    // ログディレクトリの作成が呼ばれないことを確認
    expect(mockMkdirSync).not.toHaveBeenCalled();
  });

  test('ログディレクトリが存在しない場合は作成されること', () => {
    // ログディレクトリが存在しない場合
    mockExistsSync.mockReturnValue(false);
    
    // テスト用のエラー
    const testError = new Error('テストエラー');
    
    // 関数を実行
    ErrorHandler.logError(testError, 'テストモジュール');
    
    // アサーション
    expect(mockMkdirSync).toHaveBeenCalled();
    expect(mockAppendFileSync).toHaveBeenCalled();
  });

  test('エラータイプの分類が正しく行われること', () => {
    // 各種エラーのインスタンス
    const syntaxError = new SyntaxError('構文エラー');
    const typeError = new TypeError('型エラー');
    const referenceError = new ReferenceError('参照エラー');
    const axiosError = new Error('API接続エラー');
    axiosError.name = 'AxiosError';
    const genericError = new Error('一般的なエラー');
    
    // 関数を実行
    const syntaxErrorType = ErrorHandler.classifyError(syntaxError);
    const typeErrorType = ErrorHandler.classifyError(typeError);
    const referenceErrorType = ErrorHandler.classifyError(referenceError);
    const axiosErrorType = ErrorHandler.classifyError(axiosError);
    const genericErrorType = ErrorHandler.classifyError(genericError);
    
    // アサーション
    expect(syntaxErrorType).toBe('SyntaxError');
    expect(typeErrorType).toBe('TypeError');
    expect(referenceErrorType).toBe('ReferenceError');
    expect(axiosErrorType).toBe('APIRequestError');
    expect(genericErrorType).toBe('UnknownError');
  });

  test('管理者への通知が正しく行われること', () => {
    // テスト用のエラー
    const testError = new Error('テストエラー');
    
    // 関数を実行
    ErrorHandler.notifyAdmin(testError, 'テストモジュール');
    
    // アサーション
    expect(console.warn).toHaveBeenCalled();
    // メール送信は現在コメントアウトされているが、今後有効化するためのテスト
    // expect(sendEmail).toHaveBeenCalled();
  });

  test('自動復旧処理が各エラータイプに対して正しく行われること', () => {
    // 各種エラーのインスタンス
    const syntaxError = new SyntaxError('構文エラー');
    const apiError = new Error('API接続エラー');
    apiError.name = 'AxiosError';
    const otherError = new Error('その他のエラー');
    
    // 関数を実行
    const syntaxErrorRecovered = ErrorHandler.autoRecover(syntaxError);
    const apiErrorRecovered = ErrorHandler.autoRecover(apiError);
    const otherErrorRecovered = ErrorHandler.autoRecover(otherError);
    
    // アサーション
    expect(syntaxErrorRecovered).toBe(false); // 構文エラーは復旧不可
    expect(apiErrorRecovered).toBe(false);    // 現状ではAPI接続エラーの復旧ロジックは未実装
    expect(otherErrorRecovered).toBe(false);  // デフォルトケース
    
    // APIエラー復旧試行のログが出力されることを確認
    expect(console.log).toHaveBeenCalledWith('API接続エラーからの復旧を試みます...');
  });

  test('エラーレポートが正しく生成されること', () => {
    // テスト用のエラー
    const testError = new Error('テストエラー');
    const source = 'テストモジュール';
    
    // 関数を実行
    const report = ErrorHandler.generateErrorReport(testError, source);
    
    // アサーション
    expect(report).toHaveProperty('type', 'UnknownError');
    expect(report).toHaveProperty('message', 'テストエラー');
    expect(report).toHaveProperty('stack');
    expect(report).toHaveProperty('source', source);
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('environment', 'test');
  });

  test('NODE_ENV未設定の場合、環境をdevelopmentとしてレポートすること', () => {
    // 環境変数をクリア
    const originalEnv = process.env.NODE_ENV;
    delete process.env.NODE_ENV;
    
    // テスト用のエラー
    const testError = new Error('テストエラー');
    const source = 'テストモジュール';
    
    // 関数を実行
    const report = ErrorHandler.generateErrorReport(testError, source);
    
    // アサーション
    expect(report).toHaveProperty('environment', 'development');
    
    // 環境変数を元に戻す
    process.env.NODE_ENV = originalEnv;
  });

  test('handleErrorが一連のエラー処理を実行すること', () => {
    // スパイを設定
    const logErrorSpy = jest.spyOn(ErrorHandler, 'logError');
    const notifyAdminSpy = jest.spyOn(ErrorHandler, 'notifyAdmin');
    const autoRecoverSpy = jest.spyOn(ErrorHandler, 'autoRecover');
    const generateErrorReportSpy = jest.spyOn(ErrorHandler, 'generateErrorReport');
    
    // テスト用のエラー
    const testError = new Error('テストエラー');
    const source = 'テストモジュール';
    
    // 自動復旧が失敗するケース
    autoRecoverSpy.mockReturnValue(false);
    
    // 関数を実行
    const result = ErrorHandler.handleError(testError, source);
    
    // アサーション
    expect(logErrorSpy).toHaveBeenCalledWith(testError, source);
    expect(notifyAdminSpy).toHaveBeenCalledWith(testError, source);
    expect(autoRecoverSpy).toHaveBeenCalledWith(testError);
    expect(generateErrorReportSpy).toHaveBeenCalledWith(testError, source);
    
    expect(result).toEqual({
      errorHandled: true,
      recovered: false,
      report: expect.any(Object)
    });
  });

  test('ValidationErrorの場合は管理者に通知しないこと', () => {
    // スパイを設定
    const logErrorSpy = jest.spyOn(ErrorHandler, 'logError');
    const notifyAdminSpy = jest.spyOn(ErrorHandler, 'notifyAdmin');
    const autoRecoverSpy = jest.spyOn(ErrorHandler, 'autoRecover');
    const generateErrorReportSpy = jest.spyOn(ErrorHandler, 'generateErrorReport');
    
    // ValidationErrorの作成
    const validationError = new Error('入力検証エラー');
    validationError.name = 'ValidationError';
    const source = 'テストモジュール';
    
    // 関数を実行
    ErrorHandler.handleError(validationError, source);
    
    // アサーション
    expect(logErrorSpy).toHaveBeenCalledWith(validationError, source);
    expect(notifyAdminSpy).not.toHaveBeenCalled();
    expect(autoRecoverSpy).toHaveBeenCalledWith(validationError);
    expect(generateErrorReportSpy).toHaveBeenCalledWith(validationError, source);
  });

  test('UserInputErrorの場合も管理者に通知しないこと', () => {
    // スパイを設定
    const logErrorSpy = jest.spyOn(ErrorHandler, 'logError');
    const notifyAdminSpy = jest.spyOn(ErrorHandler, 'notifyAdmin');
    const autoRecoverSpy = jest.spyOn(ErrorHandler, 'autoRecover');
    const generateErrorReportSpy = jest.spyOn(ErrorHandler, 'generateErrorReport');
    
    // UserInputErrorの作成
    const userInputError = new Error('ユーザー入力エラー');
    userInputError.name = 'UserInputError';
    const source = 'テストモジュール';
    
    // 関数を実行
    ErrorHandler.handleError(userInputError, source);
    
    // アサーション
    expect(logErrorSpy).toHaveBeenCalledWith(userInputError, source);
    expect(notifyAdminSpy).not.toHaveBeenCalled();
    expect(autoRecoverSpy).toHaveBeenCalledWith(userInputError);
    expect(generateErrorReportSpy).toHaveBeenCalledWith(userInputError, source);
  });

  test('自動復旧が成功した場合のハンドルエラー結果を確認', () => {
    // スパイを設定
    const logErrorSpy = jest.spyOn(ErrorHandler, 'logError');
    const notifyAdminSpy = jest.spyOn(ErrorHandler, 'notifyAdmin');
    const autoRecoverSpy = jest.spyOn(ErrorHandler, 'autoRecover');
    const generateErrorReportSpy = jest.spyOn(ErrorHandler, 'generateErrorReport');
    
    // 自動復旧が成功するように設定
    autoRecoverSpy.mockReturnValue(true);
    
    // テスト用のエラー
    const testError = new Error('テストエラー');
    const source = 'テストモジュール';
    
    // 関数を実行
    const result = ErrorHandler.handleError(testError, source);
    
    // アサーション
    expect(result).toEqual({
      errorHandled: true,
      recovered: true,
      report: expect.any(Object)
    });
  });

  test('エラーログ記録中にエラーが発生した場合もコンソールに出力されること', () => {
    // ログディレクトリが存在する設定
    mockExistsSync.mockReturnValue(true);
    
    // mockAppendFileSyncがエラーをスローするように設定
    mockAppendFileSync.mockImplementationOnce(() => {
      throw new Error('ファイル書き込みエラー');
    });
    
    // テスト用のエラー
    const testError = new Error('テストエラー');
    
    // 関数を実行 - この時点ではエラーが発生しないはず
    expect(() => {
      ErrorHandler.logError(testError, 'テストモジュール');
    }).not.toThrow();
    
    // ログ記録エラーがコンソールに出力されることを確認
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('エラーログ記録中にエラーが発生しました'),
      expect.any(Error)
    );
  });

  // エラーが提供されない場合のケースをテスト
  test('未定義または型が違うエラーオブジェクトでもlogErrorが機能すること', () => {
    // テスト前にconsole.errorをリセット
    console.error.mockClear();
    
    // 不完全なエラーオブジェクトでテスト
    expect(() => {
      ErrorHandler.logError({message: 'エラーメッセージのみ'}, 'テストモジュール');
    }).not.toThrow();
    
    expect(() => {
      ErrorHandler.logError(null, 'テストモジュール');
    }).not.toThrow();
    
    expect(() => {
      ErrorHandler.logError('エラー文字列', 'テストモジュール');
    }).not.toThrow();
    
    // 各テストケースに対して1回ずつ呼び出されるはず
    // ログ追加にエラーが発生した場合は追加のログ出力があるため、実際の呼び出し回数を検証
    expect(console.error).toHaveBeenCalledTimes(4);
  });

  test('sourceが未定義の場合にデフォルト値が使用されること', () => {
    // テスト用のエラー
    const testError = new Error('テストエラー');
    
    // source引数なしで呼び出し
    ErrorHandler.logError(testError);
    
    // unknownがデフォルト値として使用されることを確認
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[unknown]'),
      expect.any(Error)
    );
  });
  
  test('複数のエラータイプのハンドリングが正しく行われること', () => {
    // autoRecoverメソッドをモックしてfalseを返すようにする
    const autoRecoverSpy = jest.spyOn(ErrorHandler, 'autoRecover').mockReturnValue(false);
    
    // 複数のエラーのハンドリングをテスト
    const errors = [
      new SyntaxError('構文エラー'),
      new TypeError('型エラー'),
      new ReferenceError('参照エラー'),
      (() => { const e = new Error('API接続エラー'); e.name = 'AxiosError'; return e; })(),
      new Error('一般的なエラー')
    ];
    
    // 各エラーを処理
    const results = errors.map(error => ErrorHandler.handleError(error, 'テストモジュール'));
    
    // すべてのエラーが処理されたことを確認
    results.forEach(result => {
      expect(result).toHaveProperty('errorHandled', true);
      expect(result).toHaveProperty('recovered', false);
      expect(result).toHaveProperty('report');
    });
    
    // 各エラーごとの呼び出し回数を確認
    expect(console.error).toHaveBeenCalledTimes(errors.length);
    
    // スパイをリストア
    autoRecoverSpy.mockRestore();
  });
});
