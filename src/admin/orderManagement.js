const express = require('express');
const router = express.Router();
const { getOrders } = require('../ecIntegration/storesOrderManager');
const path = require('path');
const fs = require('fs').promises;

// データディレクトリ設定
const dataDir = path.join(__dirname, '../../data');
const fortunesDir = path.join(dataDir, 'fortunes');

/**
 * 注文データに占い情報を追加する関数
 * @param {Array} orders 注文データの配列
 * @returns {Promise<Array>} 占い情報を追加した注文データ
 */
const enrichOrdersWithFortuneStatus = async (orders) => {
  try {
    // データディレクトリの存在確認
    try {
      await fs.mkdir(fortunesDir, { recursive: true });
    } catch (err) {
      // ディレクトリ作成エラーは無視
    }

    // 既存の占いデータを読み込む
    const files = await fs.readdir(fortunesDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    // 各ファイルからデータを読み込む
    const fortunes = await Promise.all(
      jsonFiles.map(async (file) => {
        try {
          const content = await fs.readFile(path.join(fortunesDir, file), 'utf8');
          return JSON.parse(content);
        } catch (err) {
          console.error(`ファイル読み込みエラー: ${file}`, err);
          return null;
        }
      })
    );

    // 有効なデータのみをフィルタリング
    const validFortunes = fortunes.filter(f => f !== null);
    
    // 注文データに占い情報を追加
    return orders.map(order => {
      // 対応する占いデータを検索
      const fortuneData = validFortunes.find(f => f.orderId === order.id);
      
      return {
        ...order,
        fortune: {
          status: fortuneData ? fortuneData.status : 'pending',
          createdAt: fortuneData ? fortuneData.createdAt : null,
          pdfUrl: fortuneData ? fortuneData.pdfUrl : null,
          lastUpdated: fortuneData ? fortuneData.updatedAt : null
        }
      };
    });
  } catch (error) {
    console.error('注文データ拡張エラー:', error);
    return orders; // エラー時は元のデータを返す
  }
};

/**
 * 管理画面用の注文一覧取得API
 */
router.get('/orders', async (req, res) => {
  try {
    // クエリパラメータを処理
    const { 
      page = 1, 
      limit = 20,
      startDate, 
      endDate,
      status
    } = req.query;
    
    // STORESのAPI用パラメータを作成
    const params = {
      offset: (page - 1) * limit,
      limit
    };
    
    if (startDate) params.ordered_at_from = startDate;
    if (endDate) params.ordered_at_to = endDate;
    
    // ステータスによる絞り込み
    if (status === 'shipped') {
      params.delivery_status = 'shipped';
    } else if (status === 'pending') {
      params.delivery_status = 'waiting';
    } else if (status === 'unpaid') {
      params.paid_status = 'unpaid';
    }
    
    // STORESのAPIから注文データを取得
    const ordersData = await getOrders(params);
    
    // 内部データベースと連携して占い生成状況を付加
    const enrichedOrders = await enrichOrdersWithFortuneStatus(ordersData.orders || []);
    
    res.status(200).json({
      success: true,
      data: {
        orders: enrichedOrders,
        pagination: {
          total: ordersData.total || 0,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil((ordersData.total || 0) / limit)
        }
      }
    });
  } catch (error) {
    console.error('注文管理APIエラー:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 注文詳細と占い情報取得API
 */
router.get('/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // 注文ファイルのパス
    const fortuneFilePath = path.join(fortunesDir, `${orderId}.json`);
    
    // 占いデータが存在するか確認
    let fortuneData = null;
    try {
      const content = await fs.readFile(fortuneFilePath, 'utf8');
      fortuneData = JSON.parse(content);
    } catch (err) {
      // ファイルが存在しない場合はnullのまま
    }
    
    res.status(200).json({
      success: true,
      data: {
        order: {
          id: orderId,
          // 注文情報が取得できない場合は最低限の情報のみ
          ...fortuneData
        }
      }
    });
  } catch (error) {
    console.error('注文詳細取得エラー:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
