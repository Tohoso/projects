const express = require('express');
const router = express.Router();
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// データディレクトリ設定
const dataDir = path.join(__dirname, '../../data');
const fortunesDir = path.join(dataDir, 'fortunes');
const processedOrdersFile = path.join(dataDir, 'processed_orders.json');

// STORES API設定
const STORES_API_BASE_URL = 'https://api.stores.jp/v1';
const API_KEY = process.env.STORES_API_KEY;
const API_SECRET = process.env.STORES_SECRET;

/**
 * STORES APIから注文一覧を取得
 * @param {Object} params 検索パラメータ
 * @returns {Promise<Array>} 注文一覧
 */
const getOrders = async (params = {}) => {
  try {
    if (!API_KEY) {
      throw new Error('STORES API KEY が設定されていません');
    }

    const defaultParams = {
      limit: 50,
      page: 1,
    };

    const queryParams = { ...defaultParams, ...params };
    
    const response = await axios.get(`${STORES_API_BASE_URL}/orders`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      params: queryParams
    });

    if (response.status !== 200) {
      throw new Error(`API エラー: ${response.status}`);
    }

    return response.data.orders || [];
  } catch (error) {
    console.error('注文取得エラー:', error.message);
    throw error;
  }
};

/**
 * 特定の注文詳細を取得
 * @param {string} orderId 注文ID
 * @returns {Promise<Object>} 注文詳細
 */
const getOrderDetails = async (orderId) => {
  try {
    if (!API_KEY) {
      throw new Error('STORES API KEY が設定されていません');
    }

    if (!orderId) {
      throw new Error('注文IDが指定されていません');
    }

    const response = await axios.get(`${STORES_API_BASE_URL}/orders/${orderId}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status !== 200) {
      throw new Error(`API エラー: ${response.status}`);
    }

    return response.data.order;
  } catch (error) {
    console.error(`注文詳細取得エラー (ID: ${orderId}):`, error.message);
    throw error;
  }
};

/**
 * 処理済み注文IDの一覧を読み込む
 * @returns {Promise<Array<string>>} 処理済み注文IDの配列
 */
const loadProcessedOrders = async () => {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    
    try {
      const data = await fs.readFile(processedOrdersFile, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      // ファイルが存在しない場合は空の配列を返す
      if (err.code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  } catch (error) {
    console.error('処理済み注文の読み込みエラー:', error);
    return [];
  }
};

/**
 * 処理済み注文IDを保存する
 * @param {Array<string>} orderIds 処理済み注文IDの配列
 * @returns {Promise<boolean>} 保存成功時はtrue
 */
const saveProcessedOrders = async (orderIds) => {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(processedOrdersFile, JSON.stringify(orderIds, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('処理済み注文の保存エラー:', error);
    return false;
  }
};

/**
 * 新規注文をチェックして処理する
 * @returns {Promise<Array>} 新規に処理した注文の配列
 */
const checkNewOrders = async () => {
  try {
    console.log('STORES APIから新規注文をチェック中...');
    
    // 処理済み注文IDを読み込む
    const processedOrderIds = await loadProcessedOrders();
    
    // 注文一覧を取得（最新50件）
    const orders = await getOrders();
    if (!orders.length) {
      console.log('新規注文はありません');
      return [];
    }
    
    console.log(`${orders.length}件の注文を確認中...`);
    
    // 新規注文を抽出
    const newOrders = orders.filter(order => !processedOrderIds.includes(order.id));
    
    if (!newOrders.length) {
      console.log('処理が必要な新規注文はありません');
      return [];
    }
    
    console.log(`${newOrders.length}件の新規注文を処理します`);
    
    const processedOrders = [];
    const { processOrder } = require('../workers/fortuneGenerator');
    
    // 新規注文を処理
    for (const order of newOrders) {
      try {
        // 顧客情報を抽出
        const customerInfo = {
          orderId: order.id,
          email: order.customer_email || '',
          customerName: order.customer_name || '',
          productInfo: order.items && order.items.length > 0 ? order.items[0].name : '占いサービス',
          orderDate: order.ordered_at
        };
        
        // 詳細情報がなければ取得
        if (!customerInfo.email || !customerInfo.customerName) {
          try {
            const details = await getOrderDetails(order.id);
            customerInfo.email = details.customer_email || customerInfo.email;
            
            if (details.billing_address) {
              customerInfo.customerName = `${details.billing_address.last_name} ${details.billing_address.first_name}`;
            }
          } catch (detailErr) {
            console.warn(`注文ID ${order.id} の詳細情報取得に失敗しました:`, detailErr.message);
          }
        }
        
        // データベースに注文情報を保存
        await saveOrderToDatabase(customerInfo);
        
        // AUTO_GENERATE_PDFが有効なら占い結果PDF生成処理を開始
        if (process.env.AUTO_GENERATE_PDF === 'true') {
          try {
            await processOrder(order.id);
            console.log(`注文ID ${order.id} の占い結果PDF生成が完了しました`);
          } catch (processErr) {
            console.error(`注文ID ${order.id} の占い結果PDF生成に失敗しました:`, processErr.message);
          }
        }
        
        // 処理済み注文リストに追加
        processedOrderIds.push(order.id);
        processedOrders.push(order);
      } catch (orderErr) {
        console.error(`注文ID ${order.id} の処理中にエラーが発生しました:`, orderErr.message);
      }
    }
    
    // 処理済み注文IDを保存（最大500件保持）
    await saveProcessedOrders(processedOrderIds.slice(-500));
    
    console.log(`${processedOrders.length}件の新規注文処理が完了しました`);
    return processedOrders;
  } catch (error) {
    console.error('新規注文チェック処理でエラーが発生しました:', error.message);
    throw error;
  }
};

/**
 * 顧客情報をデータベース（JSONファイル）に保存する関数
 * @param {Object} customerInfo 顧客情報
 */
const saveOrderToDatabase = async (customerInfo) => {
  try {
    // データディレクトリの存在確認
    try {
      await fs.mkdir(dataDir, { recursive: true });
      await fs.mkdir(fortunesDir, { recursive: true });
    } catch (err) {
      // ディレクトリ作成エラーは無視
    }

    // 注文データの作成
    const fortuneData = {
      ...customerInfo,
      status: 'pending', // 処理待ち
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // ファイルに保存
    const filePath = path.join(fortunesDir, `${customerInfo.orderId}.json`);
    await fs.writeFile(filePath, JSON.stringify(fortuneData, null, 2), 'utf8');
    
    console.log(`注文データを保存しました: ${filePath}`);
    return true;
  } catch (error) {
    console.error('データ保存エラー:', error);
    throw error;
  }
};

// エンドポイント: 注文一覧取得
router.get('/', async (req, res) => {
  try {
    const orders = await getOrders(req.query);
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// エンドポイント: 注文詳細取得
router.get('/:id', async (req, res) => {
  try {
    const order = await getOrderDetails(req.params.id);
    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// エンドポイント: 新規注文チェック
router.post('/check-new', async (req, res) => {
  try {
    const newOrders = await checkNewOrders();
    res.json({ 
      success: true, 
      newOrdersCount: newOrders.length,
      orders: newOrders.map(order => ({
        id: order.id,
        customerName: order.customer_name,
        orderDate: order.ordered_at,
        status: 'processed'
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = {
  router,
  getOrders,
  getOrderDetails,
  checkNewOrders,
  saveOrderToDatabase
};
