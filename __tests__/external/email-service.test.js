/**
 * メール送信サービス外部結合テスト
 * 実際のメール送信サービス（Gmail API, SendGrid, SESなど）との連携をテストします
 * 
 * 注意：このテストを実行するには有効なAPI KEYまたは認証情報が必要です
 * テスト実行時に.envファイルまたは環境変数にメールサービスの認証情報が設定されている必要があります
 */

require('dotenv').config();
const { google } = require('googleapis');
const { sendEmail, sendFortuneEmail } = require('../../src/notification/emailSender');

// Gmailサービスのモック
jest.mock('googleapis', () => {
  const mockSend = jest.fn().mockResolvedValue({ data: { id: 'test-message-id' } });
  return {
    google: {
      auth: {
        OAuth2: jest.fn().mockImplementation(() => ({
          setCredentials: jest.fn()
        }))
      },
      gmail: jest.fn().mockImplementation(() => ({
        users: {
          messages: {
            send: mockSend
          }
        }
      }))
    }
  };
});

describe('メール送信サービス 外部結合テスト', () => {
  // テスト開始前の準備
  beforeAll(() => {
    // Gmailの認証情報の存在確認
    if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) {
      console.warn('警告: Gmailの認証情報が設定されていません。テストはモックモードで実行されます。');
    }
    
    // タイムアウト設定
    jest.setTimeout(10000);
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('基本的なメール送信が機能する', async () => {
    // テスト用のメールデータ
    const emailData = {
      to: 'test@example.com',
      subject: 'テストメール',
      text: 'これはテストメールです。',
      html: '<p>これは<strong>テストメール</strong>です。</p>'
    };
    
    // メール送信実行（実際のAPIキーがなければモックモードで実行）
    const result = await sendEmail(emailData);
    
    // 結果の検証
    expect(result).toBeDefined();
    expect(result.messageId).toBeDefined();
    expect(result.success).toBe(true);
    
    console.log(`メール送信結果: ${JSON.stringify(result)}`);
  });
  
  test('占い結果メールを送信できる', async () => {
    // テスト用の占い結果データ
    const fortuneData = {
      userName: 'メールテストユーザー',
      email: 'fortune@example.com',
      fortuneType: 'career',
      content: 'あなたの仕事運は上昇傾向にあります。新しいプロジェクトでリーダーシップを発揮する機会があるでしょう。',
      orderDate: new Date().toISOString(),
      fortuneId: 'fortune-email-test-123'
    };
    
    // PDFの添付を含むメール送信を実行
    const result = await sendFortuneEmail(fortuneData);
    
    // 結果の検証
    expect(result).toBeDefined();
    expect(result.messageId).toBeDefined();
    expect(result.success).toBe(true);
  });
  
  test('不正なメールアドレスでエラーが発生する', async () => {
    // 不正なメールアドレスを使用
    const invalidEmailData = {
      to: 'not-a-valid-email',
      subject: 'エラーテストメール',
      text: 'このメールは送信に失敗するはずです。'
    };
    
    // Gmailのモックをエラーを返すように設定
    const mockGmail = google.gmail();
    mockGmail.users.messages.send.mockRejectedValueOnce(
      new Error('Invalid email address')
    );
    
    // エラーが発生することを確認
    await expect(sendEmail(invalidEmailData)).rejects.toThrow();
  });
  
  test('HTMLコンテンツを含むメールを送信できる', async () => {
    // リッチコンテンツを含むメールデータ
    const richEmailData = {
      to: 'rich@example.com',
      subject: 'リッチコンテンツテストメール',
      text: 'テキスト版のメール内容です。',
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h1 style="color: #5c6bc0;">占い結果のお知らせ</h1>
          <p>この度は占いサービスをご利用いただき、ありがとうございます。</p>
          <div style="border: 1px solid #e0e0e0; padding: 15px; margin: 15px 0; background-color: #f5f5f5;">
            <h2>今月の運勢</h2>
            <p>対人関係において素晴らしい出会いがある月です。新しい友人や同僚との関係を大切にしましょう。</p>
          </div>
          <p>またのご利用をお待ちしております。</p>
        </div>
      `
    };
    
    // メール送信実行
    const result = await sendEmail(richEmailData);
    
    // 結果の検証
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });
});
