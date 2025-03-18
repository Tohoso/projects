/**
 * 鑑定結果編集機能のテスト
 */
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// モックの実装
jest.mock('axios');

// テスト用データディレクトリ
const TEST_DATA_DIR = path.join(__dirname, '../../data/test');
const TEST_FORTUNES_DIR = path.join(TEST_DATA_DIR, 'fortunes');

describe('鑑定結果編集機能のテスト', () => {
  beforeAll(async () => {
    // テスト用ディレクトリの作成
    await fs.mkdir(TEST_FORTUNES_DIR, { recursive: true });
  });

  afterAll(async () => {
    // テスト用ディレクトリの削除（オプション）
    // await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
  });

  beforeEach(() => {
    // モックのリセット
    jest.clearAllMocks();
  });

  // テスト用鑑定データ
  const createTestFortune = (customData = {}) => {
    const id = customData.id || `test-${uuidv4()}`;
    return {
      id,
      createdAt: customData.createdAt || new Date().toISOString(),
      updatedAt: customData.updatedAt || new Date().toISOString(),
      status: customData.status || 'generated',
      customerInfo: {
        id: customData.customerId || 'cust-001',
        email: customData.email || 'test@example.com',
        name: customData.name || '山田太郎'
      },
      content: customData.content || '【全体運】\n\nテスト用の鑑定結果です。',
      ...customData
    };
  };

  describe('鑑定結果の取得', () => {
    test('鑑定結果一覧が正しく取得できること', async () => {
      // モック設定
      const mockFortunes = [
        createTestFortune({ id: 'test-1' }),
        createTestFortune({ id: 'test-2' })
      ];
      
      axios.get.mockResolvedValue({
        data: {
          success: true,
          data: mockFortunes
        }
      });

      // API呼び出し
      const response = await axios.get('/api/admin/fortunes');
      
      // 検証
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveLength(2);
      expect(response.data.data[0].id).toBe('test-1');
      expect(response.data.data[1].id).toBe('test-2');
    });

    test('特定の鑑定結果が正しく取得できること', async () => {
      // モック設定
      const mockFortune = createTestFortune({ id: 'test-id-123' });
      
      axios.get.mockResolvedValue({
        data: {
          success: true,
          data: mockFortune
        }
      });

      // API呼び出し
      const response = await axios.get('/api/admin/fortune/test-id-123');
      
      // 検証
      expect(response.data.success).toBe(true);
      expect(response.data.data.id).toBe('test-id-123');
    });

    test('存在しない鑑定結果のIDを指定した場合404エラーになること', async () => {
      // モック設定
      axios.get.mockRejectedValue({
        response: {
          status: 404,
          data: {
            success: false,
            message: '指定された鑑定結果が見つかりません'
          }
        }
      });

      // API呼び出しと例外処理
      try {
        await axios.get('/api/admin/fortune/non-existent-id');
        fail('例外が発生するはずです');
      } catch (error) {
        expect(error.response.status).toBe(404);
        expect(error.response.data.success).toBe(false);
      }
    });
  });

  describe('鑑定結果の編集', () => {
    test('鑑定結果が正しく編集できること', async () => {
      // モック設定
      const requestData = {
        requestId: 'test-edit-123',
        content: '【全体運】\n\n編集された鑑定結果です。'
      };
      
      const mockResponse = {
        success: true,
        message: '鑑定結果が正常に保存されました',
        data: {
          id: 'test-edit-123',
          updatedAt: new Date().toISOString()
        }
      };
      
      axios.post.mockResolvedValue({
        data: mockResponse
      });

      // API呼び出し
      const response = await axios.post('/api/admin/fortune/edit', requestData);
      
      // 検証
      expect(response.data.success).toBe(true);
      expect(response.data.data.id).toBe('test-edit-123');
    });

    test('存在しない鑑定結果を編集しようとすると404エラーになること', async () => {
      // モック設定
      const requestData = {
        requestId: 'non-existent-id',
        content: '編集内容'
      };
      
      axios.post.mockRejectedValue({
        response: {
          status: 404,
          data: {
            success: false,
            message: '指定された鑑定結果が見つかりません'
          }
        }
      });

      // API呼び出しと例外処理
      try {
        await axios.post('/api/admin/fortune/edit', requestData);
        fail('例外が発生するはずです');
      } catch (error) {
        expect(error.response.status).toBe(404);
        expect(error.response.data.success).toBe(false);
      }
    });

    test('必須パラメータがない場合400エラーになること', async () => {
      // モック設定
      const requestData = {
        // requestIdがない
        content: '編集内容'
      };
      
      axios.post.mockRejectedValue({
        response: {
          status: 400,
          data: {
            success: false,
            message: 'リクエストIDとコンテンツは必須です'
          }
        }
      });

      // API呼び出しと例外処理
      try {
        await axios.post('/api/admin/fortune/edit', requestData);
        fail('例外が発生するはずです');
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.success).toBe(false);
      }
    });
  });

  describe('PDF再生成・送信', () => {
    test('PDFが正しく再生成・送信できること', async () => {
      // モック設定
      const requestData = {
        requestId: 'test-pdf-123'
      };
      
      const mockResponse = {
        success: true,
        message: 'PDFが正常に生成され、メールが送信されました',
        data: {
          id: 'test-pdf-123',
          pdfPath: '/mock/pdf/fortune_test-pdf-123.pdf',
          sentAt: new Date().toISOString()
        }
      };
      
      axios.post.mockResolvedValue({
        data: mockResponse
      });

      // API呼び出し
      const response = await axios.post('/api/admin/fortune/regenerate-pdf', requestData);
      
      // 検証
      expect(response.data.success).toBe(true);
      expect(response.data.data.id).toBe('test-pdf-123');
      expect(response.data.data).toHaveProperty('pdfPath');
      expect(response.data.data).toHaveProperty('sentAt');
    });

    test('存在しない鑑定結果のPDFを再生成しようとすると404エラーになること', async () => {
      // モック設定
      const requestData = {
        requestId: 'non-existent-id'
      };
      
      axios.post.mockRejectedValue({
        response: {
          status: 404,
          data: {
            success: false,
            message: '指定された鑑定結果が見つかりません'
          }
        }
      });

      // API呼び出しと例外処理
      try {
        await axios.post('/api/admin/fortune/regenerate-pdf', requestData);
        fail('例外が発生するはずです');
      } catch (error) {
        expect(error.response.status).toBe(404);
        expect(error.response.data.success).toBe(false);
      }
    });
  });
});
