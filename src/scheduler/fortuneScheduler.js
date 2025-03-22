const cron = require('node-cron');
const { runWorker } = require('../workers/fortuneGenerator');
const { checkNewOrders } = require('../ecIntegration/storesOrderManager');

// スケジューラー設定
let worker = null;
let orderChecker = null;

/**
 * 占い生成処理スケジューラーを初期化
 * @returns {Object} スケジューラーの状態情報
 */
const initializeScheduler = () => {
  try {
    const enableScheduler = process.env.ENABLE_SCHEDULER === 'true';
    
    if (!enableScheduler) {
      console.log('スケジューラーは無効化されています');
      return { status: 'disabled' };
    }
    
    // 占い生成スケジューラーの設定
    const cronSchedule = process.env.FORTUNE_SCHEDULER_CRON || '*/5 * * * *';
    console.log(`占い生成スケジューラーを設定: ${cronSchedule}`);
    
    // 既存のスケジューラーを停止
    if (worker) {
      worker.stop();
      console.log('既存の占い生成スケジューラーを停止しました');
    }
    
    // 新しいスケジューラーを開始
    worker = cron.schedule(cronSchedule, async () => {
      console.log('占い生成スケジューラーの実行: ' + new Date());
      try {
        await runWorker();
      } catch (error) {
        console.error('占い生成処理でエラーが発生しました:', error);
      }
    });
    
    console.log('占い生成スケジューラーが起動しました');
    
    // 注文監視スケジューラーのセットアップ
    initializeOrderChecker();
    
    return { status: 'running', schedule: cronSchedule };
  } catch (error) {
    console.error('スケジューラー初期化でエラーが発生:', error);
    return { status: 'error', message: error.message };
  }
};

/**
 * 注文監視スケジューラーを初期化
 * @returns {Object} スケジューラー情報
 */
const initializeOrderChecker = () => {
  try {
    const enableOrderChecker = process.env.ENABLE_ORDER_CHECKER === 'true';
    
    if (!enableOrderChecker) {
      console.log('注文監視スケジューラーは無効化されています');
      return { status: 'disabled' };
    }

    // 既存のスケジューラーを停止
    if (orderChecker) {
      orderChecker.stop();
      console.log('既存の注文監視スケジューラーを停止しました');
    }
    
    // 注文監視スケジューラーの設定
    const orderCheckerCron = process.env.ORDER_CHECKER_CRON || '*/15 * * * *';
    console.log(`注文監視スケジューラーを設定: ${orderCheckerCron}`);
    
    // 新しいスケジューラーを開始
    orderChecker = cron.schedule(orderCheckerCron, async () => {
      console.log('注文監視スケジューラーの実行: ' + new Date());
      try {
        const newOrders = await checkNewOrders();
        console.log(`注文監視: ${newOrders.length}件の新規注文を処理しました`);
      } catch (error) {
        console.error('注文監視処理でエラーが発生しました:', error);
      }
    });
    
    console.log('注文監視スケジューラーが起動しました');
    
    return { status: 'running', schedule: orderCheckerCron };
  } catch (error) {
    console.error('注文監視スケジューラー初期化でエラーが発生:', error);
    return { status: 'error', message: error.message };
  }
};

/**
 * スケジューラーを停止
 * @returns {Object} 停止結果
 */
const stopScheduler = () => {
  try {
    if (worker) {
      worker.stop();
      worker = null;
      console.log('占い生成スケジューラーを停止しました');
    }
    
    if (orderChecker) {
      orderChecker.stop();
      orderChecker = null;
      console.log('注文監視スケジューラーを停止しました');
    }
    
    return { status: 'stopped' };
  } catch (error) {
    console.error('スケジューラー停止でエラーが発生:', error);
    return { status: 'error', message: error.message };
  }
};

// APIルート
const router = require('express').Router();

// スケジューラーステータス取得
router.get('/status', (req, res) => {
  const status = {
    fortuneGenerator: worker ? 'running' : 'stopped',
    fortuneSchedule: process.env.FORTUNE_SCHEDULER_CRON || '*/5 * * * *',
    orderChecker: orderChecker ? 'running' : 'stopped',
    orderCheckerSchedule: process.env.ORDER_CHECKER_CRON || '*/15 * * * *',
    enableScheduler: process.env.ENABLE_SCHEDULER === 'true',
    enableOrderChecker: process.env.ENABLE_ORDER_CHECKER === 'true'
  };
  
  res.json({ success: true, status });
});

// スケジューラー再起動
router.post('/restart', (req, res) => {
  try {
    stopScheduler();
    const result = initializeScheduler();
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 注文監視の手動実行
router.post('/check-orders', async (req, res) => {
  try {
    console.log('注文監視の手動実行を開始...');
    const newOrders = await checkNewOrders();
    res.json({ 
      success: true, 
      newOrdersCount: newOrders.length,
      orders: newOrders.map(order => ({
        id: order.id,
        customerName: order.customer_name || 'Unknown',
        orderDate: order.ordered_at,
        status: 'processed'
      }))
    });
  } catch (error) {
    console.error('注文監視の手動実行でエラーが発生:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = {
  initializeScheduler,
  stopScheduler,
  router
};
