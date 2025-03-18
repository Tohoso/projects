const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Gmail API設定
const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

/**
 * Gmail APIのための認証設定を行う関数
 * @returns {Object} 認証済みのGmail APIクライアント
 */
const getGmailClient = async () => {
  try {
    const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '../../credentials.json');
    const auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: SCOPES
    });
    
    const authClient = await auth.getClient();
    return google.gmail({ version: 'v1', auth: authClient });
  } catch (error) {
    console.error('Gmail認証エラー:', error);
    throw error;
  }
};

/**
 * Base64エンコードされたメッセージを作成する関数
 * @param {Object} emailData - メールデータ（送信先、件名、本文など）
 * @param {string} attachmentPath - 添付ファイルのパス（PDFなど）
 * @returns {string} Base64エンコードされたメッセージ
 */
const createEmailMessage = (emailData, attachmentPath = null) => {
  try {
    // メール内容の検証
    if (!emailData.to || !emailData.subject || !emailData.body) {
      throw new Error('メールデータが不足しています');
    }
    
    // 送信元メールアドレス
    const from = emailData.from || 'ai.fortune.service@example.com';
    const fromName = emailData.fromName || 'AI占いサービス';
    
    // マルチパートメッセージのバウンダリ定義
    const boundary = 'boundary_' + Date.now().toString(16);
    
    // メールヘッダー設定
    let message = [
      `From: "${fromName}" <${from}>`,
      `To: ${emailData.to}`,
      `Subject: =?UTF-8?B?${Buffer.from(emailData.subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary=${boundary}`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(emailData.body).toString('base64')
    ].join('\r\n');
    
    // 添付ファイルがある場合の処理
    if (attachmentPath && fs.existsSync(attachmentPath)) {
      const attachmentContent = fs.readFileSync(attachmentPath);
      const fileName = path.basename(attachmentPath);
      
      message += [
        '',
        `--${boundary}`,
        'Content-Type: application/pdf',
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${fileName}"`,
        '',
        attachmentContent.toString('base64'),
        '',
        `--${boundary}--`
      ].join('\r\n');
    } else {
      message += `\r\n--${boundary}--`;
    }
    
    // Base64エンコード（URL安全）
    return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (error) {
    console.error('メッセージ作成エラー:', error);
    throw error;
  }
};

/**
 * メールを送信する関数
 * @param {Object} emailData - メールデータ
 * @param {string} attachmentPath - 添付ファイルのパス（オプション）
 * @returns {Object} 送信結果
 */
const sendEmail = async (emailData, attachmentPath = null) => {
  try {
    // 開発環境ではメール送信をシミュレート
    if (process.env.NODE_ENV === 'development') {
      console.log('開発環境: 実際にメールは送信されません');
      console.log('送信先:', emailData.to);
      console.log('件名:', emailData.subject);
      console.log('本文:', emailData.body.substring(0, 100) + '...');
      console.log('添付ファイル:', attachmentPath || 'なし');
      
      return {
        success: true,
        messageId: `dummy-message-id-${Date.now()}`,
        to: emailData.to,
        subject: emailData.subject,
        sentAt: new Date().toISOString(),
        environment: 'development'
      };
    }
    
    // Gmail APIクライアントの取得
    const gmail = await getGmailClient();
    
    // Base64エンコードされたメッセージの作成
    const raw = createEmailMessage(emailData, attachmentPath);
    
    // メール送信
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw
      }
    });
    
    // 送信結果を返す
    return {
      success: true,
      messageId: result.data.id,
      threadId: result.data.threadId,
      to: emailData.to,
      subject: emailData.subject,
      sentAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('メール送信エラー:', error);
    throw new Error(`メール送信に失敗しました: ${error.message}`);
  }
};

/**
 * 鑑定結果メールを送信する関数
 * @param {Object} fortuneData - 鑑定結果データ
 * @param {string} pdfPath - 鑑定結果PDFのパス
 * @returns {Object} 送信結果
 */
const sendFortuneEmail = async (fortuneData, pdfPath) => {
  try {
    // データの検証
    if (!fortuneData || !fortuneData.email || !pdfPath) {
      throw new Error('鑑定結果またはPDFパスが不足しています');
    }
    
    // 顧客名の設定（なければ「お客様」）
    const customerName = fortuneData.name || 'お客様';
    
    // メール件名
    const subject = `【AI占いサービス】${customerName}様の鑑定結果`;
    
    // メール本文
    const body = `${customerName}様
    
この度はAI占いサービスをご利用いただき、誠にありがとうございます。
ご依頼いただきました鑑定結果を添付ファイル（PDF）にてお送りいたします。

■ご注文情報
注文ID: ${fortuneData.orderId}
鑑定タイプ: ${fortuneData.fortuneType || '総合運'}

■添付ファイルについて
添付のPDFファイルには、AIによる詳細な鑑定結果が記載されています。
PDFが開けない場合は、最新のAdobe Readerなどの閲覧ソフトをお試しください。

■ご質問・お問い合わせ
鑑定結果についてご不明な点やお問い合わせがございましたら、
こちらのメールにご返信いただくか、下記のお問い合わせフォームよりご連絡ください。

お問い合わせフォーム: https://example.com/contact

今後とも、AI占いサービスをよろしくお願いいたします。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AI占いサービス
Email: support@example.com
Web: https://example.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    
    // メールデータの作成
    const emailData = {
      to: fortuneData.email,
      subject,
      body,
      from: process.env.EMAIL_FROM || 'ai.fortune.service@example.com',
      fromName: process.env.EMAIL_FROM_NAME || 'AI占いサービス'
    };
    
    // メール送信
    const result = await sendEmail(emailData, pdfPath);
    
    return {
      success: true,
      emailId: result.messageId,
      to: fortuneData.email,
      sentAt: new Date().toISOString(),
      pdfPath
    };
  } catch (error) {
    console.error('鑑定結果メール送信エラー:', error);
    throw error;
  }
};

// メール送信エンドポイント
router.post('/send', async (req, res) => {
  try {
    const { emailData, attachmentPath } = req.body;
    
    if (!emailData) {
      return res.status(400).json({ success: false, error: 'メールデータが不足しています' });
    }
    
    const result = await sendEmail(emailData, attachmentPath);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 鑑定結果メール送信エンドポイント
router.post('/send-fortune', async (req, res) => {
  try {
    const { fortuneData, pdfPath } = req.body;
    
    if (!fortuneData || !pdfPath) {
      return res.status(400).json({ success: false, error: '鑑定データまたはPDFパスが不足しています' });
    }
    
    const result = await sendFortuneEmail(fortuneData, pdfPath);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// テスト用メール送信エンドポイント
router.get('/test', async (req, res) => {
  try {
    const testEmailData = {
      to: 'test@example.com',
      subject: 'AI占いサービス - テストメール',
      body: 'これはテストメールです。実際のメール送信機能のテストとして送信されています。'
    };
    
    const result = await sendEmail(testEmailData);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = {
  router,
  sendEmail,
  sendFortuneEmail
};
