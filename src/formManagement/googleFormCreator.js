const { google } = require('googleapis');
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Google Form API認証設定
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '../../credentials.json'),
  scopes: ['https://www.googleapis.com/auth/forms', 'https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets'],
});

/**
 * 顧客用のGoogleフォームを作成する関数
 * @param {Object} customerData - 顧客データ
 * @returns {Object} 作成されたフォーム情報
 */
const createFormForCustomer = async (customerData) => {
  try {
    // Google Form APIクライアント初期化
    const authClient = await auth.getClient();
    const forms = google.forms({ version: 'v1', auth: authClient });
    const drive = google.drive({ version: 'v3', auth: authClient });
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // フォームタイトルの設定
    const formTitle = `AI占い鑑定フォーム: ${customerData.orderId}`;

    // 開発環境ではフォームAPIが使えない場合のダミー実装
    if (process.env.NODE_ENV === 'development') {
      return {
        formId: `dummy-form-id-${Date.now()}`,
        url: `https://forms.example.com/dummy-form?orderId=${customerData.orderId}`,
        title: formTitle,
        createdAt: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      };
    }

    // 本番環境ではGoogle Form APIを使用
    // フォーム作成
    const form = await forms.forms.create({
      requestBody: {
        info: {
          title: formTitle,
          documentTitle: formTitle
        }
      }
    });

    const formId = form.data.formId;

    // 質問項目の追加
    const questions = [
      {
        title: '注文ID',
        required: true,
        textQuestion: {
          paragraph: false
        }
      },
      {
        title: 'お名前',
        required: true,
        textQuestion: {
          paragraph: false
        }
      },
      {
        title: '生年月日',
        required: true,
        dateQuestion: {
          includeTime: false
        }
      },
      {
        title: 'ご相談内容',
        required: true,
        textQuestion: {
          paragraph: true
        }
      }
    ];

    // 質問設定をリクエストボディに変換
    const updateRequests = questions.map((q, index) => {
      return {
        createItem: {
          item: {
            title: q.title,
            questionItem: {
              question: {
                required: q.required,
                ...q.textQuestion && { textQuestion: q.textQuestion },
                ...q.dateQuestion && { dateQuestion: q.dateQuestion }
              }
            }
          },
          location: {
            index: index
          }
        }
      };
    });

    // フォームに質問を追加
    await forms.forms.batchUpdate({
      formId: formId,
      requestBody: {
        requests: updateRequests
      }
    });

    // レスポンス用のスプレッドシートを作成
    const sheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: `AI占い回答データ: ${customerData.orderId}`
        }
      }
    });

    // フォームとスプレッドシートの紐付け
    await forms.forms.batchUpdate({
      formId: formId,
      requestBody: {
        requests: [
          {
            updateSettings: {
              settings: {
                quizSettings: {
                  isQuiz: false
                }
              },
              updateMask: 'quizSettings.isQuiz'
            }
          },
          {
            updateFormInfo: {
              info: {
                destinationSettings: {
                  spreadsheetSettings: {
                    spreadsheetId: sheet.data.spreadsheetId
                  }
                }
              },
              updateMask: 'destinationSettings.spreadsheetSettings.spreadsheetId'
            }
          }
        ]
      }
    });

    // レスポンスを返す
    return {
      formId: formId,
      url: `https://docs.google.com/forms/d/${formId}/viewform`,
      spreadsheetId: sheet.data.spreadsheetId,
      title: formTitle,
      createdAt: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      customerData: {
        orderId: customerData.orderId,
        email: customerData.email
      }
    };
  } catch (error) {
    console.error('フォーム作成エラー:', error);
    throw error;
  }
};

// フォーム作成エンドポイント
router.post('/create', async (req, res) => {
  try {
    const { customer } = req.body;
    if (!customer || !customer.email || !customer.orderId) {
      return res.status(400).json({ success: false, error: '顧客情報が不足しています' });
    }
    
    const form = await createFormForCustomer(customer);
    res.status(201).json({ success: true, data: form });
  } catch (error) {
    console.error('フォーム作成APIエラー:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// テスト用フォーム作成エンドポイント
router.get('/test/:orderId/:email', async (req, res) => {
  try {
    const form = await createFormForCustomer({
      orderId: req.params.orderId,
      email: req.params.email,
      name: 'テストユーザー'
    });
    res.status(200).json({ success: true, data: form });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = {
  router,
  createFormForCustomer
};