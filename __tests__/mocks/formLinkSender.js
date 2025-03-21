/**
 * フォームリンク送信モジュールのモック
 */

// モックの関数を提供
module.exports = {
  router: {
    get: jest.fn(),
    post: jest.fn()
  },
  sendFormLink: jest.fn().mockResolvedValue({
    success: true,
    messageId: 'mock-message-id',
    sentTo: 'test@example.com'
  }),
  generateUniqueFormUrl: jest.fn().mockReturnValue('https://example.com/form/mock-unique-id')
};
