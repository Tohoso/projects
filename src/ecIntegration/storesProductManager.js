const express = require('express');
const router = express.Router();
const axios = require('axios');

// STORES API設定
const STORES_API_BASE_URL = 'https://api.stores.jp/retail/202211';
const STORES_API_KEY = process.env.STORES_API_KEY;

/**
 * 商品一覧を取得する関数
 * @param {Object} params クエリパラメータ
 * @returns {Promise<Object>} 商品一覧情報
 */
const getProducts = async (params = {}) => {
  try {
    const response = await axios.get(`${STORES_API_BASE_URL}/items`, {
      headers: {
        'Authorization': `Bearer ${STORES_API_KEY}`,
        'Content-Type': 'application/json'
      },
      params
    });
    
    return response.data;
  } catch (error) {
    console.error('STORES API 商品取得エラー:', error);
    throw error;
  }
};

/**
 * 商品詳細を取得する関数
 * @param {string} itemId 商品ID
 * @returns {Promise<Object>} 商品詳細情報
 */
const getProductDetails = async (itemId) => {
  try {
    const response = await axios.get(`${STORES_API_BASE_URL}/items`, {
      headers: {
        'Authorization': `Bearer ${STORES_API_KEY}`,
        'Content-Type': 'application/json'
      },
      params: {
        ids: itemId
      }
    });
    
    if (response.data && response.data.items && response.data.items.length > 0) {
      return response.data.items[0];
    }
    
    throw new Error('商品情報が見つかりませんでした');
  } catch (error) {
    console.error('STORES API 商品詳細取得エラー:', error);
    throw error;
  }
};

/**
 * 占いサービス商品のみをフィルタリングする関数
 * @returns {Promise<Object>} 占い商品一覧
 */
const getFortuneProducts = async () => {
  try {
    // キーワード「占い」で商品を検索
    const products = await getProducts({ keyword: '占い' });
    return products;
  } catch (error) {
    console.error('占い商品取得エラー:', error);
    throw error;
  }
};

// 商品一覧エンドポイント
router.get('/', async (req, res) => {
  try {
    const products = await getProducts(req.query);
    res.status(200).json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 商品詳細エンドポイント
router.get('/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const productDetails = await getProductDetails(itemId);
    res.status(200).json({ success: true, data: productDetails });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 占い商品一覧エンドポイント
router.get('/fortune/list', async (req, res) => {
  try {
    const fortuneProducts = await getFortuneProducts();
    res.status(200).json({ success: true, data: fortuneProducts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = {
  router,
  getProducts,
  getProductDetails,
  getFortuneProducts
};
