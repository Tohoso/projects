import React, { useState, useEffect } from 'react';
import axios from 'axios';

// React関数コンポーネントとしてダッシュボードを定義
const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('requests');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const requestsData = [
    { id: 1, customerName: '山田太郎', status: '待機中', date: '2024-03-20', fortuneResult: '全体運: ★★★★☆\n今後3ヶ月の運勢は上昇傾向にあります。特に4月中旬から5月にかけて、チャンスが訪れるでしょう。\n\n恋愛運: ★★★☆☆\n新しい出会いの兆しがありますが、焦らずに自然体で接することが大切です。' },
    { id: 2, customerName: '佐藤花子', status: '生成完了', date: '2024-03-19', fortuneResult: '全体運: ★★★☆☆\n安定した運勢が続きますが、変化を求めるなら自ら行動を起こすことが必要です。\n\n恋愛運: ★★★★☆\n現在のパートナーとの関係が深まる時期です。コミュニケーションを大切にしましょう。' },
  ];

  const systemStats = {
    uptime: '99.9%',
    apiCalls: '2,345',
    costToday: '¥3,500',
    activeUsers: '156'
  };

  // 編集した内容を保存する関数
  const saveEditedContent = async () => {
    if (!selectedRequest || !editedContent.trim()) {
      setErrorMessage('保存するコンテンツがありません');
      return;
    }

    try {
      setIsSaving(true);
      setSuccessMessage('');
      setErrorMessage('');

      const response = await axios.post('/api/admin/fortune/edit', {
        requestId: selectedRequest.id,
        content: editedContent
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken') || 'dev-token'}`
        }
      });

      if (response.data.success) {
        setSuccessMessage('鑑定結果が保存されました');
        // 選択中の依頼データを更新
        setSelectedRequest({
          ...selectedRequest,
          content: editedContent,
          updatedAt: response.data.data.updatedAt,
          editedByAdmin: true
        });
        // 編集モードを終了
        setEditMode(false);
      } else {
        setErrorMessage(response.data.message || '保存中にエラーが発生しました');
      }
    } catch (error) {
      console.error('鑑定結果保存エラー:', error);
      setErrorMessage(`保存中にエラーが発生しました: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // PDF再生成と送信の関数
  const regenerateAndSendPDF = async () => {
    if (!selectedRequest) {
      setErrorMessage('選択された依頼がありません');
      return;
    }

    try {
      setIsSending(true);
      setSuccessMessage('');
      setErrorMessage('');

      const response = await axios.post('/api/admin/fortune/regenerate-pdf', {
        requestId: selectedRequest.id
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken') || 'dev-token'}`
        }
      });

      if (response.data.success) {
        setSuccessMessage('PDF鑑定結果が再生成され、メールが送信されました');
        // 選択中の依頼データを更新
        setSelectedRequest({
          ...selectedRequest,
          status: 'sent',
          sentAt: response.data.data.sentAt
        });
      } else {
        setErrorMessage(response.data.message || 'PDF再生成中にエラーが発生しました');
      }
    } catch (error) {
      console.error('PDF再生成エラー:', error);
      setErrorMessage(`PDF再生成中にエラーが発生しました: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSending(false);
    }
  };

  // 鑑定結果を表示・編集するモーダル
  const FortuneResultModal = () => {
    if (!selectedRequest) return null;

    const handleSave = async () => {
      await saveEditedContent();
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="text-xl font-semibold">{selectedRequest.customerName}様の鑑定結果</h3>
            <button 
              onClick={() => {
                setSelectedRequest(null);
                setEditMode(false);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          <div className="p-4 flex-grow overflow-y-auto">
            {editMode ? (
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full h-[400px] p-2 border rounded dark:bg-gray-700 dark:text-white"
              />
            ) : (
              <div className="whitespace-pre-wrap dark:text-white">
                {selectedRequest.fortuneResult}
              </div>
            )}
          </div>
          
          {successMessage && (
            <div className="p-3 bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
              {successMessage}
            </div>
          )}
          
          {errorMessage && (
            <div className="p-3 bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100">
              {errorMessage}
            </div>
          )}
          
          <div className="p-4 border-t flex justify-end gap-2">
            {editMode ? (
              <>
                <button
                  onClick={() => {
                    setEditMode(false);
                    setEditedContent(selectedRequest.fortuneResult);
                  }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white"
                  disabled={isSaving}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-2"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <span className="animate-spin">⟳</span>
                      保存中...
                    </>
                  ) : (
                    '保存'
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setEditMode(true);
                    setEditedContent(selectedRequest.fortuneResult);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
                >
                  編集する
                </button>
                <button
                  onClick={regenerateAndSendPDF}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
                  disabled={isSending}
                >
                  {isSending ? (
                    <>
                      <span className="animate-spin">⟳</span>
                      PDF再生成・送信中...
                    </>
                  ) : (
                    'PDF再生成・送信'
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 min-h-screen">
      <div className="w-full max-w-4xl mx-auto bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">管理者ダッシュボード</h2>
          <p className="text-gray-600 dark:text-gray-300">AI占いサービス管理システム</p>
        </div>
        <div className="p-6">
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
            <button
              className={`px-4 py-2 ${activeTab === 'requests' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-600 dark:text-gray-300'}`}
              onClick={() => setActiveTab('requests')}
            >
              鑑定依頼
            </button>
            <button
              className={`px-4 py-2 ${activeTab === 'customers' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-600 dark:text-gray-300'}`}
              onClick={() => setActiveTab('customers')}
            >
              顧客管理
            </button>
            <button
              className={`px-4 py-2 ${activeTab === 'system' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-600 dark:text-gray-300'}`}
              onClick={() => setActiveTab('system')}
            >
              システム状況
            </button>
            <button
              className={`px-4 py-2 ${activeTab === 'logs' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-600 dark:text-gray-300'}`}
              onClick={() => setActiveTab('logs')}
            >
              エラーログ
            </button>
          </div>

          {activeTab === 'requests' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-800 dark:text-white">鑑定依頼一覧</h3>
                <div className="flex gap-2">
                  <select className="px-3 py-2 border rounded dark:bg-gray-700 dark:text-white">
                    <option>すべてのステータス</option>
                    <option>待機中</option>
                    <option>生成完了</option>
                    <option>送信済み</option>
                  </select>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    更新
                  </button>
                </div>
              </div>
              
              {requestsData.map(request => (
                <div key={request.id} className="p-4 border rounded shadow-sm dark:border-gray-700">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium text-gray-800 dark:text-white">{request.customerName}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">注文日: {request.date}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        ステータス: <span className={`${
                          request.status === '生成完了' ? 'text-green-600 dark:text-green-400' : 
                          request.status === '待機中' ? 'text-yellow-600 dark:text-yellow-400' : ''
                        }`}>{request.status}</span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white"
                        onClick={() => {
                          setSelectedRequest(request);
                        }}
                      >
                        プレビュー
                      </button>
                      <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded">
                        承認・送信
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'system' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded shadow-sm dark:border-gray-700">
                <h3 className="text-lg font-medium mb-3 text-gray-800 dark:text-white">システム稼働状況</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">稼働率</span>
                    <span className="font-medium text-gray-800 dark:text-white">{systemStats.uptime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">API呼び出し数</span>
                    <span className="font-medium text-gray-800 dark:text-white">{systemStats.apiCalls}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">本日のコスト</span>
                    <span className="font-medium text-gray-800 dark:text-white">{systemStats.costToday}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">アクティブユーザー</span>
                    <span className="font-medium text-gray-800 dark:text-white">{systemStats.activeUsers}</span>
                  </div>
                </div>
              </div>
              
              <div className="p-4 border rounded shadow-sm dark:border-gray-700">
                <h3 className="text-lg font-medium mb-3 text-gray-800 dark:text-white">API使用状況</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Claude API</span>
                    <span className="font-medium text-gray-800 dark:text-white">正常</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Gmail API</span>
                    <span className="font-medium text-gray-800 dark:text-white">正常</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Forms API</span>
                    <span className="font-medium text-gray-800 dark:text-white">正常</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* 鑑定結果モーダル */}
      {selectedRequest && <FortuneResultModal />}
    </div>
  );
};

export default Dashboard;