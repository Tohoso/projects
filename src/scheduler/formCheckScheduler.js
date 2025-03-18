const express = require('express');
const router = express.Router();
const cron = require('node-cron');
const { checkForNewResponses, processFormResponse } = require('../dataProcessing/formResponseHandler');
const { generateFortunePDF } = require('../pdfGeneration/pdfGenerator');
const { sendFortuneEmail } = require('../emailSending/emailSender');
const fs = require('fs');
const path = require('path');

// 処理済みフォーム回答を記録するJSONファイルのパス
const PROCESSED_FORMS_PATH = path.join(__dirname, '../../data/processedForms.json');

// スケジューラーの状態
let schedulerStatus = {
  isRunning: false,
  lastRun: null,
  processedForms: [],
  scheduledTasks: [],
  errors: []
};

/**
 * 処理済みフォーム回答のロード
 * @returns {Array} 処理済みフォーム回答の配列
 */
const loadProcessedForms = () => {
  try {
    // データディレクトリがない場合は作成
    const dataDir = path.dirname(PROCESSED_FORMS_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // ファイルが存在する場合は読み込み、なければ空の配列を返す
    if (fs.existsSync(PROCESSED_FORMS_PATH)) {
      const data = fs.readFileSync(PROCESSED_FORMS_PATH, 'utf8');
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('処理済みフォーム読み込みエラー:', error);
    return [];
  }
};

/**
 * 処理済みフォーム回答の保存
 * @param {Array} processedForms - 処理済みフォーム回答の配列
 */
const saveProcessedForms = (processedForms) => {
  try {
    // データディレクトリがない場合は作成
    const dataDir = path.dirname(PROCESSED_FORMS_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    fs.writeFileSync(PROCESSED_FORMS_PATH, JSON.stringify(processedForms, null, 2), 'utf8');
  } catch (error) {
    console.error('処理済みフォーム保存エラー:', error);
  }
};

/**
 * 新規フォーム回答を処理する関数
 * @param {string} spreadsheetId - スプレッドシートID
 */
const processNewFormResponses = async (spreadsheetId) => {
  try {
    // ステータス更新
    schedulerStatus.isRunning = true;
    schedulerStatus.lastRun = new Date().toISOString();
    
    // 処理済みフォーム回答の読み込み
    schedulerStatus.processedForms = loadProcessedForms();
    
    // 新規回答のチェック
    console.log(`スプレッドシート ${spreadsheetId} の新規回答をチェック中...`);
    const newResponse = await checkForNewResponses(spreadsheetId);
    
    if (newResponse) {
      console.log('新規回答を検出しました');
      
      // 回答データの整形
      const responseData = {
        orderId: newResponse[0],
        name: newResponse[1],
        birthDate: newResponse[2],
        consultation: newResponse[3],
        email: newResponse[4] || 'dummy@example.com' // スプレッドシートにメールが含まれていない場合のダミー値
      };
      
      // 既に処理済みかチェック
      const isProcessed = schedulerStatus.processedForms.some(
        form => form.orderId === responseData.orderId && form.name === responseData.name
      );
      
      if (isProcessed) {
        console.log(`注文ID ${responseData.orderId} は既に処理済みです`);
        return;
      }
      
      // フォーム回答の処理
      console.log(`回答処理開始: ${responseData.name}様 (注文ID: ${responseData.orderId})`);
      const fortuneResult = await processFormResponse(responseData);
      
      // PDF生成
      console.log('鑑定結果のPDF生成中...');
      const pdfPath = await generateFortunePDF({
        ...fortuneResult,
        content: fortuneResult.fortuneResult.content
      });
      
      // メール送信
      console.log('鑑定結果のメール送信中...');
      await sendFortuneEmail({
        ...responseData,
        fortuneType: fortuneResult.fortuneResult.fortuneType,
        orderId: responseData.orderId
      }, pdfPath);
      
      // 処理済みとして記録
      schedulerStatus.processedForms.push({
        orderId: responseData.orderId,
        name: responseData.name,
        email: responseData.email,
        processedAt: new Date().toISOString(),
        pdfPath
      });
      
      // 処理済みデータの保存
      saveProcessedForms(schedulerStatus.processedForms);
      
      console.log(`処理完了: ${responseData.name}様 (注文ID: ${responseData.orderId})`);
    } else {
      console.log('新規回答はありませんでした');
    }
  } catch (error) {
    console.error('フォーム処理エラー:', error);
    schedulerStatus.errors.push({
      timestamp: new Date().toISOString(),
      error: error.message
    });
  } finally {
    // ステータス更新
    schedulerStatus.isRunning = false;
  }
};

/**
 * スケジューラーの初期化と開始
 * @param {Object} options - スケジューラーオプション
 */
const initScheduler = (options = {}) => {
  try {
    // スケジュール設定（デフォルトは5分ごと）
    const schedule = options.schedule || '*/5 * * * *';
    const spreadsheetIds = options.spreadsheetIds || [];
    
    if (spreadsheetIds.length === 0) {
      console.warn('スプレッドシートIDが指定されていません。スケジューラーは開始されません。');
      return;
    }
    
    console.log(`スケジューラーを開始します（スケジュール: ${schedule}）`);
    
    // スケジュールタスクの設定
    spreadsheetIds.forEach(spreadsheetId => {
      // 既存のタスクをキャンセル
      schedulerStatus.scheduledTasks = schedulerStatus.scheduledTasks.filter(task => {
        if (task.spreadsheetId === spreadsheetId) {
          task.task.stop();
          return false;
        }
        return true;
      });
      
      // 新しいタスクをスケジュール
      const task = cron.schedule(schedule, () => {
        processNewFormResponses(spreadsheetId);
      });
      
      // タスクを記録
      schedulerStatus.scheduledTasks.push({
        spreadsheetId,
        schedule,
        task
      });
      
      console.log(`スプレッドシート ${spreadsheetId} の監視タスクを登録しました`);
    });
    
    return true;
  } catch (error) {
    console.error('スケジューラー初期化エラー:', error);
    return false;
  }
};

// スケジューラー管理エンドポイント
router.post('/start', (req, res) => {
  try {
    const { spreadsheetIds, schedule } = req.body;
    
    if (!spreadsheetIds || !Array.isArray(spreadsheetIds) || spreadsheetIds.length === 0) {
      return res.status(400).json({ success: false, error: 'スプレッドシートIDが指定されていません' });
    }
    
    const result = initScheduler({ spreadsheetIds, schedule });
    
    if (result) {
      res.status(200).json({ 
        success: true, 
        message: 'スケジューラーを開始しました',
        data: { 
          schedule: schedule || '*/5 * * * *',
          spreadsheetIds, 
          taskCount: schedulerStatus.scheduledTasks.length 
        }
      });
    } else {
      res.status(500).json({ success: false, error: 'スケジューラーの開始に失敗しました' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// スケジューラー停止エンドポイント
router.post('/stop', (req, res) => {
  try {
    // すべてのタスクを停止
    schedulerStatus.scheduledTasks.forEach(task => {
      task.task.stop();
    });
    
    schedulerStatus.scheduledTasks = [];
    
    res.status(200).json({ success: true, message: 'スケジューラーを停止しました' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// スケジューラーステータス確認エンドポイント
router.get('/status', (req, res) => {
  try {
    const status = {
      isRunning: schedulerStatus.isRunning,
      lastRun: schedulerStatus.lastRun,
      activeTasks: schedulerStatus.scheduledTasks.map(task => ({
        spreadsheetId: task.spreadsheetId,
        schedule: task.schedule
      })),
      processedFormsCount: schedulerStatus.processedForms.length,
      recentErrors: schedulerStatus.errors.slice(-5) // 最新5件のエラーを表示
    };
    
    res.status(200).json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 手動実行エンドポイント
router.post('/run-now', async (req, res) => {
  try {
    const { spreadsheetId } = req.body;
    
    if (!spreadsheetId) {
      return res.status(400).json({ success: false, error: 'スプレッドシートIDが指定されていません' });
    }
    
    // 非同期で処理を開始し、レスポンスはすぐに返す
    res.status(202).json({ success: true, message: '処理を開始しました' });
    
    // バックグラウンドで処理を実行
    await processNewFormResponses(spreadsheetId);
  } catch (error) {
    // エラーはログに記録するだけ（レスポンスは既に返している）
    console.error('手動実行エラー:', error);
  }
});

module.exports = {
  router,
  initScheduler,
  processNewFormResponses,
  schedulerStatus
};
