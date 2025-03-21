/**
 * 共通メール送信モジュール
 */
const { sendEmail } = require('../emailSending/emailSender');

/**
 * メール送信のラッパー関数
 * @param {Object} emailData - メールデータ
 * @param {string} attachmentPath - 添付ファイルのパス（オプション）
 * @returns {Object} 送信結果
 */
async function sendMailWrapper(emailData, attachmentPath = null) {
  try {
    return await sendEmail(emailData, attachmentPath);
  } catch (error) {
    console.error('メール送信エラー:', error);
    throw error;
  }
}

module.exports = {
  sendEmail: sendMailWrapper
};
