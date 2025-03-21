/**
 * メール送信モジュールのモック
 */

// モックの関数を提供
module.exports = {
  sendEmail: jest.fn().mockResolvedValue({
    success: true,
    messageId: 'mock-message-id',
    sentAt: new Date().toISOString()
  })
};
