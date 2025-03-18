// テスト環境のセットアップ
require('dotenv').config();

// モック環境変数の設定
process.env.NODE_ENV = 'test';
process.env.PDF_FONT_PATH = './fonts/NotoSansJP-Regular.otf';
process.env.CLAUDE_API_KEY = 'test_claude_api_key';
process.env.GOOGLE_APPLICATION_CREDENTIALS = './credentials.json';
process.env.FORM_CHECK_INTERVAL = '0 */6 * * *';

// コンソール出力のモック
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

// ファイルシステムのモックが必要な場合
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn()
}));

// テスト終了後のクリーンアップ
afterAll(() => {
  jest.restoreAllMocks();
});
