/**
 * AI占いサービスのコマンドラインテストツール
 * 
 * ユースケースに従って、コマンドラインから簡単に占いフローをテストできるツール
 * ダミーデータを使用して、実際のモジュールを直接呼び出します
 */

require('dotenv').config();

// ダミーモードを強制設定
process.env.NODE_ENV = 'development';

// テスト対象のモジュール
const { generateFortune } = require('./src/aiFortune/claudeApiManager');
const { generateFortunePDF } = require('./src/pdfGeneration/pdfGenerator');
const { sendFortuneEmail } = require('./src/emailSending/emailSender');

/**
 * テストデータの作成
 */
function createTestFortune(type = 'general', name = '鈴木一郎') {
  const testData = {
    orderId: `TEST-${Date.now()}`,
    name: name,
    birthDate: '1990-01-01',
    email: 'test@example.com',
    fortuneType: type,
    consultation: ''
  };
  
  // 相談内容をタイプに合わせて設定
  switch (type) {
    case 'career':
      testData.consultation = '仕事の将来性について悩んでいます。転職すべきか、今の職場で頑張るべきか迷っています。';
      break;
    case 'love':
      testData.consultation = '恋愛運について知りたいです。良い出会いはありますか？';
      break;
    case 'money':
      testData.consultation = '今後の金運について教えてください。投資のタイミングはいつが良いでしょうか？';
      break;
    default:
      testData.consultation = '全体的な運勢と今後半年の傾向について教えてください。';
  }
  
  return testData;
}

/**
 * 占い生成とPDF生成のフロー全体をテスト
 */
async function testFortuneFlow(userData) {
  console.log(`\n===== ${userData.name}様の${userData.fortuneType}占いテスト開始 =====`);
  
  try {
    // ステップ1: 占い結果を生成
    console.log('1. 占い結果を生成中...');
    const fortuneData = await generateFortune(userData, userData.fortuneType);
    
    console.log('✓ 占い結果の生成が完了しました');
    console.log('  - 内容プレビュー:', fortuneData.content.substring(0, 100) + '...');
    
    // ステップ2: PDF生成
    console.log('\n2. PDF生成中...');
    const pdfPath = await generateFortunePDF({
      ...fortuneData,
      name: userData.name
    });
    
    console.log('✓ PDFの生成が完了しました');
    console.log('  - ファイル:', pdfPath);
    
    // ステップ3: メール送信
    console.log('\n3. メール送信中...');
    const emailResult = await sendFortuneEmail({
      ...fortuneData,
      email: userData.email,
      name: userData.name
    }, pdfPath);
    
    console.log('✓ メールの送信が完了しました');
    console.log('  - 送信先:', userData.email);
    
    console.log('\n✅ テスト成功: すべてのステップが正常に完了しました');
    console.log(`===== ${userData.name}様の${userData.fortuneType}占いテスト完了 =====\n`);
    
    return { fortuneData, pdfPath, emailResult };
  } catch (error) {
    console.error('❌ テスト失敗:', error.message);
    console.log(`===== ${userData.name}様の${userData.fortuneType}占いテスト失敗 =====\n`);
    return { error };
  }
}

/**
 * メイン関数
 */
async function main() {
  // コマンドライン引数の取得
  const args = process.argv.slice(2);
  const fortuneType = args[0] || 'general';
  const userName = args[1] || '鈴木一郎';
  
  // 使い方の表示
  console.log('AI占いサービス テストツール');
  console.log('---------------------------');
  console.log(`占いタイプ: ${fortuneType}`);
  console.log(`ユーザー名: ${userName}`);
  console.log('---------------------------\n');
  
  // テストの実行
  const testData = createTestFortune(fortuneType, userName);
  const results = await testFortuneFlow(testData);
  
  // テスト実行結果の概要を出力
  if (!results.error) {
    console.log('\n=== テスト結果概要 ===');
    console.log(`・占いタイプ: ${results.fortuneData.fortuneType}`);
    console.log(`・生成日時: ${results.fortuneData.generatedAt}`);
    console.log(`・PDF保存先: ${results.pdfPath}`);
    console.log(`・メール送信成功: ${results.emailResult.success}`);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('\n注意: 開発環境のためAPIとメール送信は実際には実行されていません');
    }
  }
}

// スクリプト実行
main().catch(error => {
  console.error('未処理のエラーが発生しました:', error);
  process.exit(1);
});
