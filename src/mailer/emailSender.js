const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Gmail APIの設定
const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];
const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || './credentials.json';

/**
 * Gmail APIを使用してメールを送信する
 * @param {string} to 宛先メールアドレス
 * @param {string} subject 件名
 * @param {string} text 本文（テキスト）
 * @returns {Promise<Object>} 送信結果
 */
const sendEmail = async (to, subject, text) => {
  try {
    // 送信元情報
    const from = process.env.EMAIL_FROM || 'fortune@example.com';
    const fromName = process.env.EMAIL_FROM_NAME || 'AI占いサービス';
    
    // 開発環境ではコンソール出力のみ
    if (process.env.NODE_ENV === 'development') {
      console.log('===== 開発環境: メール送信のシミュレーション =====');
      console.log(`宛先: ${to}`);
      console.log(`件名: ${subject}`);
      console.log(`本文:\n${text}`);
      console.log('============================================');
      
      return {
        success: true,
        message: '開発環境でのメール送信シミュレーション',
        to,
        subject
      };
    }
    
    // Google APIの認証
    const auth = await getGoogleAuth();
    const gmail = google.gmail({ version: 'v1', auth });
    
    // RFC 2822フォーマットのメール作成
    const message = [
      `From: ${fromName} <${from}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      text
    ].join('\n');
    
    // Base64エンコーディング
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    // メール送信
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });
    
    return {
      success: true,
      messageId: result.data.id,
      to,
      subject
    };
  } catch (error) {
    console.error('メール送信エラー:', error);
    throw error;
  }
};

/**
 * 添付ファイル付きメール送信
 * @param {string} to 宛先メールアドレス
 * @param {string} subject 件名
 * @param {string} text 本文（テキスト）
 * @param {string} attachmentPath 添付ファイルのパス
 * @returns {Promise<Object>} 送信結果
 */
const sendEmailWithAttachment = async (to, subject, text, attachmentPath) => {
  try {
    // 送信元情報
    const from = process.env.EMAIL_FROM || 'fortune@example.com';
    const fromName = process.env.EMAIL_FROM_NAME || 'AI占いサービス';
    
    // 開発環境ではコンソール出力のみ
    if (process.env.NODE_ENV === 'development') {
      console.log('===== 開発環境: 添付ファイル付きメール送信のシミュレーション =====');
      console.log(`宛先: ${to}`);
      console.log(`件名: ${subject}`);
      console.log(`本文:\n${text}`);
      console.log(`添付ファイル: ${attachmentPath}`);
      console.log('============================================');
      
      return {
        success: true,
        message: '開発環境での添付ファイル付きメール送信シミュレーション',
        to,
        subject,
        attachmentPath
      };
    }
    
    // ファイルの存在確認
    if (!fs.existsSync(attachmentPath)) {
      throw new Error(`添付ファイルが見つかりません: ${attachmentPath}`);
    }
    
    // ファイル読み込み
    const fileContent = fs.readFileSync(attachmentPath);
    const fileBase64 = fileContent.toString('base64');
    const fileName = path.basename(attachmentPath);
    
    // メールトランスポートの作成
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: from,
        serviceClient: await getJwtClient()
      }
    });
    
    // メールオプションの設定
    const mailOptions = {
      from: `${fromName} <${from}>`,
      to,
      subject,
      text,
      attachments: [
        {
          filename: fileName,
          content: fileBase64,
          encoding: 'base64'
        }
      ]
    };
    
    // メール送信
    const info = await transporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: info.messageId,
      to,
      subject,
      attachmentName: fileName
    };
  } catch (error) {
    console.error('添付ファイル付きメール送信エラー:', error);
    throw error;
  }
};

/**
 * Google認証クライアントを取得
 * @returns {Promise<Object>} 認証済みクライアント
 */
const getGoogleAuth = async () => {
  try {
    // 認証情報ファイルの読み込み
    const credentials = JSON.parse(
      fs.readFileSync(CREDENTIALS_PATH, 'utf8')
    );
    
    // JWTクライアントの生成
    const jwtClient = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      SCOPES
    );
    
    // 認証
    await jwtClient.authorize();
    
    return jwtClient;
  } catch (error) {
    console.error('Google認証エラー:', error);
    throw error;
  }
};

/**
 * JWT認証クライアントを取得
 * @returns {Promise<Object>} JWT認証済みクライアント
 */
const getJwtClient = async () => {
  try {
    // 認証情報ファイルの読み込み
    const credentials = JSON.parse(
      fs.readFileSync(CREDENTIALS_PATH, 'utf8')
    );
    
    // JWTクライアントの生成
    const jwtClient = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      SCOPES
    );
    
    // 認証
    await jwtClient.authorize();
    
    return jwtClient;
  } catch (error) {
    console.error('JWT認証エラー:', error);
    throw error;
  }
};

module.exports = {
  sendEmail,
  sendEmailWithAttachment
};
