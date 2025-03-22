const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sendEmailWithAttachment } = require('../mailer/emailSender');

// PDF生成設定
const PDF_TEMP_DIR = process.env.PDF_TEMP_DIR || './temp';
const PDF_FONT_PATH = process.env.PDF_FONT_PATH || './fonts/NotoSansJP-Regular.otf';

/**
 * 占い結果用PDFを生成する関数
 * @param {Object} fortuneData 占いデータ
 * @returns {Promise<Object>} 生成結果
 */
const generateFortunePdf = async (fortuneData) => {
  try {
    // データディレクトリの存在確認
    await fs.promises.mkdir(PDF_TEMP_DIR, { recursive: true });

    // ファイル名の生成
    const timestamp = new Date().getTime();
    const fileName = `fortune_${fortuneData.orderId}_${timestamp}.pdf`;
    const filePath = path.join(PDF_TEMP_DIR, fileName);
    
    // Claude APIからの占い結果取得（すでに存在する場合はスキップ）
    let fortuneResult = fortuneData.fortuneResult;
    if (!fortuneResult) {
      fortuneResult = await generateFortuneResult(fortuneData);
      
      // 生成結果をファイルに保存（後続処理のため）
      const fortuneFilePath = path.join(
        __dirname, 
        '../../data/fortunes', 
        `${fortuneData.orderId}.json`
      );
      
      // 既存データの読み込み
      let existingData = {};
      try {
        const fileContent = await fs.promises.readFile(fortuneFilePath, 'utf8');
        existingData = JSON.parse(fileContent);
      } catch (err) {
        // ファイルが存在しない場合は新規作成
        console.log('新規占いデータを作成します');
      }
      
      // データの更新
      const updatedData = {
        ...existingData,
        fortuneResult,
        status: 'generated',
        updatedAt: new Date().toISOString()
      };
      
      // データの保存
      await fs.promises.writeFile(
        fortuneFilePath, 
        JSON.stringify(updatedData, null, 2), 
        'utf8'
      );
    }
    
    // PDFドキュメントの作成
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `${fortuneData.customerName || ''}様の占い結果`,
        Author: 'AI占いサービス',
        Subject: 'AI占い結果',
        Keywords: '占い, AI, 運勢',
        CreationDate: new Date()
      }
    });

    // フォントの設定
    doc.font(PDF_FONT_PATH);
    
    // PDFストリームをファイルに出力
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    
    // ヘッダー
    doc.fontSize(24)
       .fillColor('#333333')
       .text('AI占いサービス', { align: 'center' })
       .moveDown(0.5);
    
    // タイトル
    doc.fontSize(20)
       .fillColor('#0066cc')
       .text(`${fortuneData.customerName || ''}様の占い結果`, { align: 'center' })
       .moveDown(1);
    
    // 日付
    const today = new Date().toLocaleDateString('ja-JP', {
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    });
    
    doc.fontSize(12)
       .fillColor('#666666')
       .text(`鑑定日: ${today}`, { align: 'right' })
       .moveDown(1.5);
    
    // 区切り線
    doc.moveTo(50, doc.y)
       .lineTo(doc.page.width - 50, doc.y)
       .stroke('#cccccc')
       .moveDown(1);
    
    // 占い結果本文
    doc.fontSize(12)
       .fillColor('#333333');
    
    // 占い結果の本文を追加（段落ごとに処理）
    const paragraphs = fortuneResult.split('\n\n');
    paragraphs.forEach((paragraph, index) => {
      doc.text(paragraph, {
        align: 'left',
        lineGap: 5
      });
      
      if (index < paragraphs.length - 1) {
        doc.moveDown(1);
      }
    });
    
    // 区切り線
    doc.moveDown(2)
       .moveTo(50, doc.y)
       .lineTo(doc.page.width - 50, doc.y)
       .stroke('#cccccc')
       .moveDown(1);
    
    // フッター
    doc.fontSize(10)
       .fillColor('#999999')
       .text('このAI占い結果は、あくまでも参考情報としてお楽しみください。', { align: 'center' })
       .moveDown(0.5)
       .text('©︎ AI占いサービス', { align: 'center' });
    
    // PDFドキュメントの終了
    doc.end();
    
    // ストリーム完了を待機
    return new Promise((resolve, reject) => {
      stream.on('finish', () => {
        resolve({
          success: true,
          filePath,
          fileName,
          fortuneResult
        });
      });
      
      stream.on('error', (err) => {
        reject(err);
      });
    });
  } catch (error) {
    console.error('PDF生成エラー:', error);
    throw error;
  }
};

/**
 * Claude APIを使用して占い結果を生成する関数
 * @param {Object} fortuneData 占いデータ
 * @returns {Promise<string>} 生成された占い結果テキスト
 */
const generateFortuneResult = async (fortuneData) => {
  try {
    // Claude APIのエンドポイント
    const CLAUDE_API_ENDPOINT = 'https://api.anthropic.com/v1/messages';
    
    // プロンプトの生成
    const prompt = `
あなたは熟練の占い師です。以下の情報をもとに、その人の運勢を占ってください。
結果は具体的で前向きな内容にしてください。

注文情報:
- 商品: ${fortuneData.productInfo || '占いサービス'}
- 注文日: ${new Date(fortuneData.orderDate).toLocaleDateString('ja-JP')}
${fortuneData.customerName ? `- お名前: ${fortuneData.customerName}` : ''}

以下の項目について、それぞれ100〜150文字程度で占ってください:
1. 全体運：現在のあなたの全体的な運勢
2. 仕事運：仕事やキャリアに関する運勢
3. 金運：財政や金銭面の運勢
4. 恋愛運：恋愛や人間関係の運勢
5. 健康運：健康状態や体調に関する運勢

最後に、あなたへのアドバイスを200文字程度で書いてください。
結果は日本語で、敬語を使って書いてください。`;

    // Claude APIリクエスト
    const response = await axios.post(
      CLAUDE_API_ENDPOINT,
      {
        model: 'claude-3-haiku-20240307',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      }
    );
    
    // レスポンス検証
    if (!response.data || !response.data.content || response.data.content.length === 0) {
      throw new Error('Claude APIからの応答が不正です');
    }
    
    // 生成結果を取得
    return response.data.content[0].text;
  } catch (error) {
    console.error('占い結果生成エラー:', error);
    throw error;
  }
};

/**
 * 生成したPDFをメールで送信する関数
 * @param {Object} fortuneData 占いデータ
 * @param {string} pdfPath 生成したPDFのパス
 * @returns {Promise<Object>} 送信結果
 */
const sendFortunePdfByEmail = async (fortuneData, pdfPath) => {
  try {
    const to = fortuneData.email;
    const subject = `【AI占いサービス】${fortuneData.customerName || ''}様の占い結果`;
    const text = `
${fortuneData.customerName || ''}様

この度はAI占いサービスをご利用いただき、誠にありがとうございます。
ご注文いただいた占い結果を添付ファイルにてお送りいたします。

【注文情報】
商品: ${fortuneData.productInfo || '占いサービス'}
注文日: ${new Date(fortuneData.orderDate).toLocaleDateString('ja-JP')}
注文番号: ${fortuneData.orderId}

添付のPDFファイルをご確認ください。
※PDFファイルが開けない場合は、Adobe Acrobat Readerなどのアプリをご利用ください。

何かご不明な点がございましたら、お気軽にお問い合わせください。
今後ともAI占いサービスをよろしくお願いいたします。

------------------------------
AI占いサービス
Email: ${process.env.EMAIL_FROM || 'fortune@example.com'}
------------------------------
`;

    // メール送信
    const result = await sendEmailWithAttachment(
      to,
      subject,
      text,
      pdfPath
    );
    
    return result;
  } catch (error) {
    console.error('メール送信エラー:', error);
    throw error;
  }
};

/**
 * 自動PDF生成と送信を行う関数
 * @param {string} orderId 注文ID
 * @returns {Promise<Object>} 処理結果
 */
const processFortuneGeneration = async (orderId) => {
  try {
    // 注文データの読み込み
    const fortuneFilePath = path.join(
      __dirname, 
      '../../data/fortunes', 
      `${orderId}.json`
    );
    
    // データの読み込み
    const fileContent = await fs.promises.readFile(fortuneFilePath, 'utf8');
    const fortuneData = JSON.parse(fileContent);
    
    // ステータスチェック（すでに処理済みならスキップ）
    if (fortuneData.status === 'completed') {
      return {
        success: true,
        message: '既に処理済みの注文です',
        orderId
      };
    }
    
    // PDF生成
    console.log(`注文ID ${orderId} のPDF生成を開始します...`);
    const pdfResult = await generateFortunePdf(fortuneData);
    
    // メール送信
    console.log(`生成したPDFをメールで送信します: ${pdfResult.filePath}`);
    const emailResult = await sendFortunePdfByEmail(fortuneData, pdfResult.filePath);
    
    // 処理結果をデータに保存
    fortuneData.status = 'completed';
    fortuneData.pdfPath = pdfResult.filePath;
    fortuneData.pdfUrl = `/fortunes/${path.basename(pdfResult.filePath)}`;
    fortuneData.emailSent = true;
    fortuneData.emailSentAt = new Date().toISOString();
    fortuneData.updatedAt = new Date().toISOString();
    
    // データの保存
    await fs.promises.writeFile(
      fortuneFilePath, 
      JSON.stringify(fortuneData, null, 2), 
      'utf8'
    );
    
    // 管理者への通知（オプション）
    if (process.env.ADMIN_EMAIL) {
      await notifyAdmin(fortuneData, pdfResult.filePath);
    }
    
    return {
      success: true,
      message: 'PDF生成とメール送信が完了しました',
      orderId,
      pdfPath: pdfResult.filePath,
      emailSent: true
    };
  } catch (error) {
    console.error('自動PDF生成エラー:', error);
    
    // エラー情報をファイルに記録
    try {
      const fortuneFilePath = path.join(
        __dirname, 
        '../../data/fortunes', 
        `${orderId}.json`
      );
      
      // 既存データの読み込み
      const fileContent = await fs.promises.readFile(fortuneFilePath, 'utf8');
      const fortuneData = JSON.parse(fileContent);
      
      // エラー情報を追加
      fortuneData.status = 'error';
      fortuneData.error = error.message;
      fortuneData.updatedAt = new Date().toISOString();
      
      // データの保存
      await fs.promises.writeFile(
        fortuneFilePath, 
        JSON.stringify(fortuneData, null, 2), 
        'utf8'
      );
    } catch (fileError) {
      console.error('エラー情報の保存に失敗しました:', fileError);
    }
    
    throw error;
  }
};

/**
 * 管理者に処理完了を通知する関数
 * @param {Object} fortuneData 占いデータ
 * @param {string} pdfPath 生成したPDFのパス
 * @returns {Promise<Object>} 送信結果
 */
const notifyAdmin = async (fortuneData, pdfPath) => {
  try {
    const to = process.env.ADMIN_EMAIL;
    const subject = `【管理者通知】占い結果生成完了 - 注文ID: ${fortuneData.orderId}`;
    const text = `
管理者様

注文ID: ${fortuneData.orderId} の占い結果生成が完了しました。

【顧客情報】
顧客名: ${fortuneData.customerName || '名前なし'}
メール: ${fortuneData.email}
商品: ${fortuneData.productInfo || '占いサービス'}
注文日: ${new Date(fortuneData.orderDate).toLocaleDateString('ja-JP')}

PDFファイルを添付しています。
ステータスが「completed」に更新されました。

------------------------------
AI占いサービス 自動通知
------------------------------
`;

    // メール送信
    const result = await sendEmailWithAttachment(
      to,
      subject,
      text,
      pdfPath
    );
    
    return result;
  } catch (error) {
    console.error('管理者通知エラー:', error);
    // 管理者通知のエラーは処理を中断しない
    return { success: false, error: error.message };
  }
};

module.exports = {
  generateFortunePdf,
  sendFortunePdfByEmail,
  processFortuneGeneration
};
