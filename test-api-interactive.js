/**
 * AI占いサービスのAPIテスト
 * 実際のユースケースを想定したテストスクリプト
 * 
 * 注意: このスクリプトは開発環境用に作られており、ダミーデータを使用します。
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ダミーモードを強制設定
process.env.NODE_ENV = 'development';

// テスト対象のモジュールを直接import
const { generateFortune } = require('./src/aiFortune/claudeApiManager');
const { generateFortunePDF } = require('./src/pdfGeneration/pdfGenerator');
const { sendFortuneEmail } = require('./src/emailSending/emailSender');

// インタラクティブ CLI インターフェース
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// テスト用ダミーデータ
const dummyUsers = [
  {
    orderId: 'DUMMY_ORDER_001',
    name: '山田太郎',
    birthDate: '1985-06-15',
    consultation: '最近仕事がうまくいかず、キャリアの方向性に悩んでいます。',
    email: 'test1@example.com',
    fortuneType: 'career'
  },
  {
    orderId: 'DUMMY_ORDER_002',
    name: '佐藤花子',
    birthDate: '1992-12-24',
    consultation: '恋愛についての悩みがあります。良い出会いはあるでしょうか？',
    email: 'test2@example.com',
    fortuneType: 'love'
  },
  {
    orderId: 'DUMMY_ORDER_003',
    name: '鈴木一郎',
    birthDate: '1978-03-08',
    consultation: '全体的な運勢と来年の傾向について教えてください。',
    email: 'test3@example.com',
    fortuneType: 'general'
  }
];

/**
 * 占い生成関数
 * @param {Object} userData - ユーザーデータ
 * @return {Object} 生成された占い結果
 */
async function generateFortuneResult(userData) {
  try {
    console.log(`[${userData.name}様] 占い生成中...`);
    const result = await generateFortune(userData, userData.fortuneType);
    console.log(`[${userData.name}様] 占い生成完了!`);
    return result;
  } catch (error) {
    console.error(`[${userData.name}様] 占い生成エラー:`, error.message);
    throw error;
  }
}

/**
 * PDF生成関数
 * @param {Object} fortuneData - 占い結果データ
 * @return {string} 生成されたPDFのパス
 */
async function generatePDF(fortuneData) {
  try {
    console.log(`[${fortuneData.orderId}] PDF生成中...`);
    const pdfPath = await generateFortunePDF(fortuneData);
    console.log(`[${fortuneData.orderId}] PDF生成完了: ${pdfPath}`);
    return pdfPath;
  } catch (error) {
    console.error(`[${fortuneData.orderId}] PDF生成エラー:`, error.message);
    throw error;
  }
}

/**
 * メール送信関数
 * @param {Object} emailData - メールデータ
 * @param {string} pdfPath - 添付PDFのパス
 * @return {Object} 送信結果
 */
async function sendEmail(emailData, pdfPath) {
  try {
    console.log(`[${emailData.orderId}] メール送信中...`);
    const result = await sendFortuneEmail(emailData, pdfPath);
    console.log(`[${emailData.orderId}] メール送信完了!`);
    return result;
  } catch (error) {
    console.error(`[${emailData.orderId}] メール送信エラー:`, error.message);
    throw error;
  }
}

/**
 * 完全なテストフローを実行する関数
 * @param {Object} userData - ユーザーデータ
 */
async function runCompleteFortuneTellFlow(userData) {
  try {
    console.log(`===== ${userData.name}様 (${userData.fortuneType}) の占いフロー開始 =====`);
    
    // ステップ1: 占い生成
    const fortuneResult = await generateFortuneResult(userData);
    
    // ステップ2: PDF生成
    const pdfPath = await generatePDF({
      ...fortuneResult,
      name: userData.name
    });
    
    // ステップ3: メール送信
    const emailResult = await sendEmail({
      ...fortuneResult,
      email: userData.email,
      name: userData.name
    }, pdfPath);
    
    console.log(`===== ${userData.name}様の占いフロー完了 =====\n`);
    
    return {
      fortuneResult,
      pdfPath,
      emailResult
    };
  } catch (error) {
    console.error(`${userData.name}様の占いフロー中にエラーが発生しました:`, error.message);
    return null;
  }
}

/**
 * カスタム占いデータを作成する関数
 */
async function createCustomFortuneData() {
  return new Promise((resolve) => {
    rl.question('お名前: ', (name) => {
      rl.question('生年月日 (YYYY-MM-DD): ', (birthDate) => {
        rl.question('相談内容: ', (consultation) => {
          rl.question('メールアドレス: ', (email) => {
            rl.question('占いタイプ (general/love/career/money): ', (fortuneType) => {
              const userData = {
                orderId: `CUSTOM_${Date.now()}`,
                name,
                birthDate,
                consultation,
                email,
                fortuneType: fortuneType || 'general'
              };
              resolve(userData);
            });
          });
        });
      });
    });
  });
}

/**
 * メインの実行関数
 */
async function main() {
  try {
    console.log('\n=== AI占いサービス テストメニュー ===');
    console.log('1: すべてのダミーユーザーで占いフローを実行');
    console.log('2: 特定のダミーユーザーで占いフローを実行');
    console.log('3: カスタムデータで占いフローを実行');
    console.log('0: 終了');
    
    rl.question('\n選択してください (0-3): ', async (choice) => {
      switch (choice) {
        case '1':
          console.log('\n全ダミーユーザーの占いフローを開始します...\n');
          const results = [];
          for (const userData of dummyUsers) {
            const result = await runCompleteFortuneTellFlow(userData);
            results.push(result);
          }
          console.log('全ユーザーの処理が完了しました！');
          
          // 結果の概要を表示
          console.log('\n=== テスト結果概要 ===');
          dummyUsers.forEach((user, index) => {
            console.log(`${index + 1}. ${user.name} (${user.fortuneType}): ${results[index] ? '成功' : '失敗'}`);
          });
          
          rl.close();
          break;
          
        case '2':
          console.log('\n=== ダミーユーザー一覧 ===');
          dummyUsers.forEach((user, index) => {
            console.log(`${index + 1}: ${user.name} - ${user.fortuneType}占い`);
          });
          
          rl.question('\nユーザーを選択してください (1-3): ', async (userIndex) => {
            const index = parseInt(userIndex) - 1;
            if (index >= 0 && index < dummyUsers.length) {
              const result = await runCompleteFortuneTellFlow(dummyUsers[index]);
              
              if (result) {
                console.log('\n=== テスト結果概要 ===');
                console.log(`・占いタイプ: ${result.fortuneResult.fortuneType}`);
                console.log(`・生成日時: ${result.fortuneResult.generatedAt}`);
                console.log(`・PDF保存先: ${result.pdfPath}`);
                console.log(`・メール送信成功: ${result.emailResult.success}`);
                
                if (process.env.NODE_ENV === 'development') {
                  console.log('\n注意: 開発環境のためClaudeAPIとメール送信は実際には実行されていません');
                }
              }
            } else {
              console.log('無効な選択です。');
            }
            rl.close();
          });
          break;
          
        case '3':
          console.log('\nカスタムデータを入力してください:');
          const customData = await createCustomFortuneData();
          const result = await runCompleteFortuneTellFlow(customData);
          
          if (result) {
            console.log('\n=== テスト結果概要 ===');
            console.log(`・占いタイプ: ${result.fortuneResult.fortuneType}`);
            console.log(`・生成日時: ${result.fortuneResult.generatedAt}`);
            console.log(`・PDF保存先: ${result.pdfPath}`);
            console.log(`・メール送信成功: ${result.emailResult.success}`);
            
            if (process.env.NODE_ENV === 'development') {
              console.log('\n注意: 開発環境のためClaudeAPIとメール送信は実際には実行されていません');
            }
          }
          
          rl.close();
          break;
          
        case '0':
        default:
          console.log('終了します。');
          rl.close();
          break;
      }
    });
  } catch (error) {
    console.error('エラーが発生しました:', error);
    rl.close();
  }
}

// スクリプト実行
main();
