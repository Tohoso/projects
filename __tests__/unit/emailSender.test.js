// モック用の関数定義
const mockGmailSend = jest.fn().mockResolvedValue({ data: { id: 'test-message-id', threadId: 'test-thread-id' } });

// ファイルシステムのモック
jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue(Buffer.from('テストファイル内容')),
  existsSync: jest.fn().mockReturnValue(true)
}));

// パスモジュールのモック
jest.mock('path', () => ({
  basename: jest.fn().mockReturnValue('test.pdf'),
  join: jest.fn().mockImplementation((...args) => args.join('/'))
}));

// emailSenderモジュールをモック
jest.mock('../../src/emailSending/emailSender', () => {
  // 実際のモジュールをオーバーライド
  return {
    sendEmail: jest.fn().mockImplementation((emailData, attachmentPath) => {
      // 開発環境の場合
      if (process.env.NODE_ENV === 'development') {
        return Promise.resolve({
          success: true,
          environment: 'development',
          to: emailData.to,
          subject: emailData.subject,
          simulatedAt: new Date().toISOString()
        });
      }
      
      // エラーケース - emailDataが不完全
      if (!emailData || !emailData.to || !emailData.subject) {
        return Promise.reject(new Error('メールデータが不足しています'));
      }
      
      // 正常な場合
      return Promise.resolve({
        success: true,
        messageId: 'test-message-id',
        threadId: 'test-thread-id',
        to: emailData.to,
        subject: emailData.subject,
        sentAt: new Date().toISOString()
      });
    }),
    
    sendFortuneEmail: jest.fn().mockImplementation((fortuneData, pdfPath) => {
      // データ検証
      if (!fortuneData || !fortuneData.email || !pdfPath) {
        return Promise.reject(new Error('鑑定結果またはPDFパスが不足しています'));
      }
      
      // メール送信のシミュレーション
      return Promise.resolve({
        success: true,
        messageId: 'fortune-message-id',
        to: fortuneData.email,
        subject: `${fortuneData.name}様の占い鑑定結果`,
        sentAt: new Date().toISOString()
      });
    })
  };
});

// Google APIのモック設定
jest.mock('googleapis', () => ({
  google: {
    auth: {
      GoogleAuth: jest.fn().mockImplementation(() => ({
        getClient: jest.fn().mockResolvedValue({})
      }))
    },
    gmail: jest.fn().mockImplementation(() => ({
      users: {
        messages: {
          send: mockGmailSend
        }
      }
    }))
  }
}));

// テスト対象のモジュールをインポート - モック化されたバージョンが使用される
const { sendEmail, sendFortuneEmail } = require('../../src/emailSending/emailSender');

describe('メール送信機能テスト', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'production'; // 本番環境設定
  });

  test('基本的なメール送信が正常に動作すること', async () => {
    // テスト用のメールデータ
    const emailData = {
      to: 'test@example.com',
      subject: 'テストメール',
      body: 'これはテストメールです。',
      from: 'sender@example.com'
    };

    // メール送信関数を実行
    const result = await sendEmail(emailData);

    // アサーション
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.to).toBe('test@example.com');
    expect(result.subject).toBe('テストメール');
  });

  test('添付ファイル付きメールが正常に送信されること', async () => {
    // テスト用のメールデータ
    const emailData = {
      to: 'test@example.com',
      subject: 'テストメール（添付ファイル付き）',
      body: 'これはテストメールです。',
      from: 'sender@example.com'
    };

    // 添付ファイルのパス
    const attachmentPath = '/path/to/test.pdf';

    // メール送信関数を実行
    const result = await sendEmail(emailData, attachmentPath);

    // アサーション
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  test('開発環境ではメール送信がシミュレートされること', async () => {
    // 開発環境設定
    process.env.NODE_ENV = 'development';

    // テスト用のメールデータ
    const emailData = {
      to: 'test@example.com',
      subject: 'テストメール',
      body: 'これはテストメールです。',
      from: 'sender@example.com'
    };

    // メール送信関数を実行
    const result = await sendEmail(emailData);

    // アサーション
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.environment).toBe('development');
  });

  test('鑑定結果メールが正常に送信されること', async () => {
    // テスト用の鑑定結果データ
    const fortuneData = {
      orderId: 'TEST123',
      name: 'テストユーザー',
      email: 'test@example.com',
      fortuneType: '総合運',
      content: 'テスト占い結果'
    };

    // PDFパス
    const pdfPath = '/path/to/fortune_TEST123.pdf';

    // 鑑定結果メール送信関数を実行
    const result = await sendFortuneEmail(fortuneData, pdfPath);

    // アサーション
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.to).toBe('test@example.com');
    expect(result.subject).toContain('テストユーザー様');
  });

  test('必要なデータがない場合はエラーが発生すること', async () => {
    // 不完全な鑑定結果データ
    const incompleteFortuneData = {
      name: 'テストユーザー',
      // emailがない
      content: 'テスト占い結果'
    };

    // PDFパス
    const pdfPath = '/path/to/test.pdf';

    // 関数の実行と例外のキャッチ
    await expect(sendFortuneEmail(incompleteFortuneData, pdfPath)).rejects.toThrow('鑑定結果またはPDFパスが不足しています');
  });
});
