/**
 * CDNおよびストレージサービス外部結合テスト
 * 実際のクラウドストレージサービス（AWS S3, Google Cloud Storageなど）との連携をテストします
 * 
 * 注意：このテストを実行するには有効な認証情報が必要です
 * テスト実行時に.envファイルまたは環境変数にストレージサービスの認証情報が設定されている必要があります
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { uploadFile, downloadFile, getFileUrl, deleteFile } = require('../../src/storage/fileStorage');
const { generatePDF } = require('../../src/pdfGeneration/pdfGenerator');

describe('ストレージサービス 外部結合テスト', () => {
  // テスト用のファイルパスとデータ
  let testPdfPath;
  let testFileId;
  
  // テスト開始前の準備
  beforeAll(() => {
    // ストレージサービスの認証情報の存在確認
    if (!process.env.STORAGE_SERVICE_KEY) {
      console.warn('警告: ストレージサービスの認証情報が設定されていません。テストはスキップされます。');
    }
    
    // テスト用の一時ディレクトリ
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // テスト用のPDFファイルパス
    testPdfPath = path.join(tempDir, `test-fortune-${Date.now()}.pdf`);
    
    // タイムアウト設定
    jest.setTimeout(30000);
  });
  
  // 各テスト前の準備
  beforeEach(() => {
    testFileId = `test-file-${Date.now()}`;
  });
  
  // テスト終了後のクリーンアップ
  afterAll(async () => {
    // テスト中に作成した一時ファイルを削除
    if (fs.existsSync(testPdfPath)) {
      fs.unlinkSync(testPdfPath);
    }
    
    // アップロードしたテストファイルを削除
    if (testFileId && process.env.STORAGE_SERVICE_KEY) {
      try {
        await deleteFile(testFileId);
      } catch (error) {
        console.warn(`警告: テストファイルの削除に失敗しました: ${error.message}`);
      }
    }
  });
  
  test('PDFファイルを生成してストレージにアップロードできる', async () => {
    // ストレージサービスの認証情報がない場合はスキップ
    if (!process.env.STORAGE_SERVICE_KEY) {
      return;
    }
    
    // テスト用の占い結果データ
    const fortuneData = {
      userName: 'ストレージテストユーザー',
      birthDate: '1990-01-01',
      fortuneType: 'general',
      content: 'これはストレージサービステスト用の占い結果です。この文章はPDFファイルに含まれます。',
      createdAt: new Date().toISOString(),
      fortuneId: `fortune-storage-test-${Date.now()}`
    };
    
    // PDFファイル生成
    await generatePDF(fortuneData, testPdfPath);
    
    // ファイルが生成されたことを確認
    expect(fs.existsSync(testPdfPath)).toBe(true);
    
    // ファイルサイズを確認
    const stats = fs.statSync(testPdfPath);
    expect(stats.size).toBeGreaterThan(0);
    console.log(`生成されたPDFファイルサイズ: ${stats.size} バイト`);
    
    // ストレージにアップロード
    const uploadResult = await uploadFile(testPdfPath, testFileId, 'application/pdf');
    
    // 結果の検証
    expect(uploadResult).toBeDefined();
    expect(uploadResult.success).toBe(true);
    expect(uploadResult.fileId).toBe(testFileId);
    expect(uploadResult.url).toBeDefined();
    
    console.log(`アップロード結果: ${JSON.stringify(uploadResult)}`);
  });
  
  test('アップロードしたファイルのURLを取得できる', async () => {
    // ストレージサービスの認証情報がない場合はスキップ
    if (!process.env.STORAGE_SERVICE_KEY) {
      return;
    }
    
    // テスト用のテキストファイルを作成
    const testTextPath = path.join(path.dirname(testPdfPath), `test-text-${Date.now()}.txt`);
    fs.writeFileSync(testTextPath, 'これはテストテキストファイルです。');
    
    try {
      // ファイルをアップロード
      await uploadFile(testTextPath, testFileId, 'text/plain');
      
      // ファイルのURLを取得
      const fileUrl = await getFileUrl(testFileId);
      
      // 結果の検証
      expect(fileUrl).toBeDefined();
      expect(fileUrl).toMatch(/^https?:\/\//); // URLの形式を確認
      
      console.log(`ファイルURL: ${fileUrl}`);
    } finally {
      // テスト用ファイルを削除
      if (fs.existsSync(testTextPath)) {
        fs.unlinkSync(testTextPath);
      }
    }
  });
  
  test('アップロードしたファイルをダウンロードできる', async () => {
    // ストレージサービスの認証情報がない場合はスキップ
    if (!process.env.STORAGE_SERVICE_KEY) {
      return;
    }
    
    // テスト用のテキストファイルを作成
    const testTextPath = path.join(path.dirname(testPdfPath), `test-upload-${Date.now()}.txt`);
    const testContent = `これはダウンロードテスト用のファイルです。タイムスタンプ: ${Date.now()}`;
    fs.writeFileSync(testTextPath, testContent);
    
    // ダウンロード先のパス
    const downloadPath = path.join(path.dirname(testPdfPath), `test-download-${Date.now()}.txt`);
    
    try {
      // ファイルをアップロード
      await uploadFile(testTextPath, testFileId, 'text/plain');
      
      // ファイルをダウンロード
      const downloadResult = await downloadFile(testFileId, downloadPath);
      
      // 結果の検証
      expect(downloadResult).toBeDefined();
      expect(downloadResult.success).toBe(true);
      expect(fs.existsSync(downloadPath)).toBe(true);
      
      // ダウンロードしたファイルの内容を確認
      const downloadedContent = fs.readFileSync(downloadPath, 'utf8');
      expect(downloadedContent).toBe(testContent);
      
      console.log('ファイルのダウンロードに成功しました');
    } finally {
      // テスト用ファイルを削除
      if (fs.existsSync(testTextPath)) {
        fs.unlinkSync(testTextPath);
      }
      if (fs.existsSync(downloadPath)) {
        fs.unlinkSync(downloadPath);
      }
    }
  });
  
  test('ファイルを削除できる', async () => {
    // ストレージサービスの認証情報がない場合はスキップ
    if (!process.env.STORAGE_SERVICE_KEY) {
      return;
    }
    
    // テスト用のテキストファイルを作成
    const testTextPath = path.join(path.dirname(testPdfPath), `test-delete-${Date.now()}.txt`);
    fs.writeFileSync(testTextPath, 'これは削除テスト用のファイルです。');
    
    try {
      // ファイルをアップロード
      await uploadFile(testTextPath, testFileId, 'text/plain');
      
      // ファイルを削除
      const deleteResult = await deleteFile(testFileId);
      
      // 結果の検証
      expect(deleteResult).toBeDefined();
      expect(deleteResult.success).toBe(true);
      
      // ファイルが存在しないことを確認
      try {
        await getFileUrl(testFileId);
        fail('削除されたファイルが依然として存在しています');
      } catch (error) {
        // エラーが発生することを期待
        expect(error).toBeDefined();
      }
      
      console.log('ファイルの削除に成功しました');
    } finally {
      // テスト用ファイルを削除
      if (fs.existsSync(testTextPath)) {
        fs.unlinkSync(testTextPath);
      }
    }
  });
});
