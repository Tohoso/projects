const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// PDF生成用のフォントパス設定
const DEFAULT_FONT_PATH = process.env.PDF_FONT_PATH || path.join(__dirname, '../../assets/fonts/NotoSansJP-Regular.otf');

// PDFドキュメントの基本設定値
const PDF_OPTIONS = {
  size: 'A4',
  margin: 50,
  info: {
    Producer: 'AI占いサービス',
    Creator: 'AI Fortune Service System'
  }
};

/**
 * 占い鑑定結果をPDFに変換する関数
 * @param {Object} fortuneData - 鑑定結果データ
 * @param {string} outputPath - 出力先パス（省略時は一時ファイル）
 * @returns {string} 生成されたPDFのパス
 */
const generateFortunePDF = async (fortuneData, outputPath = null) => {
  try {
    // 出力パスの決定（省略時は一時ディレクトリに生成）
    if (!outputPath) {
      const tempDir = process.env.PDF_TEMP_DIR || path.join(__dirname, '../../temp');
      // 一時ディレクトリが存在しない場合は作成
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      outputPath = path.join(tempDir, `fortune_${fortuneData.orderId}_${Date.now()}.pdf`);
    }

    // PDFドキュメント作成
    const doc = new PDFDocument(PDF_OPTIONS);
    const writeStream = fs.createWriteStream(outputPath);
    
    // ストリームの設定
    doc.pipe(writeStream);
    
    // フォントの設定
    try {
      if (fs.existsSync(DEFAULT_FONT_PATH)) {
        doc.font(DEFAULT_FONT_PATH);
        console.log(`フォントを設定しました: ${DEFAULT_FONT_PATH}`);
      } else {
        console.warn(`フォントファイルが見つかりません: ${DEFAULT_FONT_PATH}`);
      }
    } catch (error) {
      console.warn('フォント読み込みエラー、デフォルトフォントを使用します:', error.message);
    }
    
    // ヘッダー部分
    doc.fontSize(24)
       .fillColor('#333333')
       .text('AI占い鑑定結果', { align: 'center' })
       .moveDown(0.5);
    
    // タイトル部分
    const title = fortuneData.title || `${fortuneData.fortuneType || '総合運'}鑑定結果`;
    doc.fontSize(20)
       .fillColor('#333333')
       .text(title, { align: 'center' })
       .moveDown(1);
    
    // 基本情報
    doc.fontSize(12)
       .fillColor('#666666')
       .text(`お名前: ${fortuneData.name}様`, { continued: false })
       .text(`鑑定日: ${new Date(fortuneData.generatedAt || Date.now()).toLocaleDateString('ja-JP')}`, { continued: false })
       .moveDown(1.5);
    
    // セパレーター
    doc.strokeColor('#cccccc')
       .lineWidth(1)
       .moveTo(50, doc.y)
       .lineTo(doc.page.width - 50, doc.y)
       .stroke()
       .moveDown(1);
    
    // 鑑定内容
    doc.fontSize(12)
       .fillColor('#333333');
    
    // 鑑定結果の内容を段落ごとに追加
    const contentParagraphs = fortuneData.content.split('\n\n');
    contentParagraphs.forEach((paragraph, index) => {
      // 見出しの場合は太字で表示（可能な場合）
      if (paragraph.trim().startsWith('【') && paragraph.trim().endsWith('】')) {
        doc.fontSize(14)
           .text(paragraph.trim(), { continued: false })
           .fontSize(12);
      } else {
        doc.text(paragraph.trim(), { continued: false });
      }
      
      // 段落間に適切な余白を追加
      if (index < contentParagraphs.length - 1) {
        doc.moveDown(0.5);
      }
    });
    
    // フッター部分
    doc.moveDown(2);
    doc.fontSize(10)
       .fillColor('#999999')
       .text('※この鑑定結果はAIによって生成されています', { align: 'center' })
       .text(`生成日時: ${new Date().toLocaleString('ja-JP')}`, { align: 'center' });
    
    // PDF生成を完了
    doc.end();
    
    // 完了を待機
    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => {
        console.log(`PDFを生成しました: ${outputPath}`);
        resolve(outputPath);
      });
      
      writeStream.on('error', (error) => {
        console.error('PDF生成エラー:', error);
        reject(error);
      });
    });
  } catch (error) {
    console.error('PDF生成処理エラー:', error);
    throw error;
  }
};

// PDF生成エンドポイント
router.post('/generate', async (req, res) => {
  try {
    const { fortuneData } = req.body;
    
    if (!fortuneData || !fortuneData.content) {
      return res.status(400).json({ success: false, error: '鑑定データが不足しています' });
    }
    
    const pdfPath = await generateFortunePDF(fortuneData);
    
    res.status(200).json({
      success: true,
      data: {
        pdfPath,
        fileName: path.basename(pdfPath)
      }
    });
  } catch (error) {
    console.error('PDFエンドポイントエラー:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PDF取得エンドポイント
router.get('/download/:fileName', (req, res) => {
  try {
    const fileName = req.params.fileName;
    const tempDir = process.env.PDF_TEMP_DIR || path.join(__dirname, '../../temp');
    const filePath = path.join(tempDir, fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'ファイルが見つかりません' });
    }
    
    res.download(filePath);
  } catch (error) {
    console.error('PDFダウンロードエラー:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// テスト用PDFダウンロードエンドポイント
router.get('/download/:fileName', (req, res) => {
  try {
    const { fileName } = req.params;
    const filePath = path.join(__dirname, '../../temp', fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'ファイルが見つかりません' });
    }
    
    res.download(filePath);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// テスト用PDF生成エンドポイント
router.get('/test', async (req, res) => {
  try {
    const testData = {
      orderId: 'TEST123',
      name: 'テストユーザー',
      title: '総合運鑑定結果',
      fortuneType: 'general',
      content: `【全体運】\n\n
あなたは現在、人生の転換期を迎えています。これまでの努力が実を結び始め、新たなステージへと進む準備が整いつつあります。特に10月から12月にかけては、思いがけない出会いや機会に恵まれるでしょう。\n\n

【仕事運】\n\n
仕事面では、あなたの創造性が高く評価される時期です。新しいプロジェクトや企画に積極的に関わることで、あなたの才能が周囲に認められます。特に11月中旬以降は、昇進や新たな役割を任される可能性があります。\n\n

【恋愛運】\n\n
恋愛においては、今までとは異なるタイプの人との出会いがあります。先入観を捨てて、新しい関係性を受け入れる姿勢が大切です。すでにパートナーがいる方は、相手との関係を見直し、より深い絆を築く時期となります。\n\n

【金運】\n\n
金運は安定しており、無理のない範囲での投資や資産運用が吉となります。ただし、11月後半は衝動的な出費に注意が必要です。計画的な経済活動を心がけましょう。\n\n

【健康運】\n\n
健康面では、ストレス管理が重要になります。特に睡眠の質を高めることで、心身のバランスが整います。軽い運動や瞑想を取り入れることをおすすめします。`,
      generatedAt: new Date().toISOString()
    };
    
    const pdfPath = await generateFortunePDF(testData);
    
    res.status(200).json({
      success: true,
      data: {
        pdfPath,
        fileName: path.basename(pdfPath),
        downloadUrl: `/pdf/download/${path.basename(pdfPath)}`,
        message: 'テストPDFが生成されました'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = {
  router,
  generateFortunePDF
};
