const fs = require('fs');
const path = require('path');

// エラーログ保存先ディレクトリ
const LOG_DIR = path.join(__dirname, '../../logs');

// エラーログファイルパス
const ERROR_LOG_PATH = path.join(LOG_DIR, 'error.log');

// メール通知機能への参照（実際のメール送信モジュールが実装されたら有効化）
// const { sendEmail } = require('../emailSending/emailSender');

class ErrorHandler {
  /**
   * エラーをログに記録する
   * @param {Error} error - エラーオブジェクト
   * @param {string} source - エラー発生源（モジュール名など）
   */
  static logError(error, source = 'unknown') {
    console.error(`[${new Date().toISOString()}] [${source}] Error:`, error);
    
    // エラーをファイルに記録
    try {
      // ログディレクトリが存在しない場合は作成
      if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
      }
      
      const logEntry = `[${new Date().toISOString()}] [${source}] ${error.name}: ${error.message}\n${error.stack}\n\n`;
      fs.appendFileSync(ERROR_LOG_PATH, logEntry);
    } catch (logError) {
      console.error('エラーログ記録中にエラーが発生しました:', logError);
    }
  }

  /**
   * エラーの種類を分類する
   * @param {Error} error - エラーオブジェクト
   * @returns {string} エラータイプ
   */
  static classifyError(error) {
    if (error instanceof SyntaxError) {
      return 'SyntaxError';
    } else if (error instanceof TypeError) {
      return 'TypeError';
    } else if (error instanceof ReferenceError) {
      return 'ReferenceError';
    } else if (error.name === 'AxiosError') {
      return 'APIRequestError';
    } else {
      return 'UnknownError';
    }
  }

  /**
   * 管理者にエラーを通知する
   * @param {Error} error - エラーオブジェクト
   * @param {string} source - エラー発生源
   */
  static notifyAdmin(error, source = 'unknown') {
    const errorType = this.classifyError(error);
    const message = `[${errorType}] ${source}で発生: ${error.message}`;
    
    console.warn('管理者通知:', message);
    
    // メール送信機能が実装されたら有効化
    /* 
    try {
      sendEmail({
        to: process.env.ADMIN_EMAIL || 'admin@example.com',
        subject: `【AI占いサービス】エラー発生: ${errorType}`,
        body: `エラータイプ: ${errorType}\n発生場所: ${source}\nエラーメッセージ: ${error.message}\n\nスタックトレース:\n${error.stack}`
      });
    } catch (mailError) {
      console.error('エラー通知メール送信中にエラーが発生しました:', mailError);
    }
    */
  }

  /**
   * エラー状況に応じた自動復旧を試みる
   * @param {Error} error - エラーオブジェクト
   * @returns {boolean} 復旧できたかどうか
   */
  static autoRecover(error) {
    const errorType = this.classifyError(error);
    let recovered = false;
    
    switch (errorType) {
      case 'APIRequestError':
        // API接続エラーの場合、再試行のロジックを実装
        console.log('API接続エラーからの復旧を試みます...');
        // 実際の再試行ロジックをここに実装
        recovered = false; // 現状は実装なしのため失敗扱い
        break;
        
      case 'SyntaxError':
        // 構文エラーはアプリケーションコードの修正が必要なため、復旧不可
        recovered = false;
        break;
        
      default:
        // その他のエラーに対するデフォルトの対応
        recovered = false;
        break;
    }
    
    return recovered;
  }

  /**
   * エラーレポートを生成する
   * @param {Error} error - エラーオブジェクト
   * @param {string} source - エラー発生源
   * @returns {Object} エラーレポート
   */
  static generateErrorReport(error, source = 'unknown') {
    const errorType = this.classifyError(error);
    
    return {
      type: errorType,
      message: error.message,
      stack: error.stack,
      source,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    };
  }

  /**
   * エラーを総合的に処理する
   * @param {Error} error - エラーオブジェクト
   * @param {string} source - エラー発生源
   * @returns {Object} エラー処理結果
   */
  static handleError(error, source = 'unknown') {
    this.logError(error, source);
    
    // 重大なエラーの場合は管理者に通知
    if (error.name !== 'ValidationError' && error.name !== 'UserInputError') {
      this.notifyAdmin(error, source);
    }
    
    // 自動復旧を試みる
    const recovered = this.autoRecover(error);
    
    // エラーレポートを生成
    const report = this.generateErrorReport(error, source);
    
    return {
      errorHandled: true,
      recovered,
      report
    };
  }
}

module.exports = ErrorHandler;