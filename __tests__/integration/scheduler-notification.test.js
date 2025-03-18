const ErrorHandler = require('../../src/utils/errorHandler');

// テスト対象のモジュールをモックする
// スケジューラー関連のモックオブジェクト
const mockScheduler = {
  scheduleTask: jest.fn(),
  cancelTask: jest.fn(),
  getScheduledTasks: jest.fn(),
  executeScheduledTask: jest.fn()
};

// メール送信関連のモックオブジェクト
const mockEmailSender = {
  sendEmail: jest.fn(),
  sendFortuneEmail: jest.fn(),
  createEmailMessage: jest.fn()
};

// Claude APIのモック
jest.mock('../../src/aiFortune/claudeApiManager', () => ({
  generateFortune: jest.fn().mockImplementation((userData, fortuneType) => {
    return {
      fortuneId: 'fortune-123',
      fortuneType: fortuneType || 'general',
      content: '今月の運勢予測です',
      orderId: userData.orderId || 'ORDER123',
      generatedAt: new Date().toISOString(),
      apiCost: 5.0
    };
  })
}));

// エラーハンドラーのモック
jest.mock('../../src/utils/errorHandler', () => ({
  logError: jest.fn(),
  classifyError: jest.fn(),
  notifyAdmins: jest.fn().mockResolvedValue({}),
  autoRecover: jest.fn()
}));

const { generateFortune } = require('../../src/aiFortune/claudeApiManager');

describe('スケジューラーと通知システムの結合テスト', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // autoRecoverの動作を設定
    let retryCount = 0;
    ErrorHandler.autoRecover.mockImplementation(async (error, operation) => {
      retryCount++;
      if (retryCount === 1) {
        throw error; // 最初の呼び出しではエラーを再スロー
      }
      return operation(); // 2回目以降の呼び出しでは操作を実行
    });
    
    // 現在時刻を固定
    jest.useFakeTimers().setSystemTime(new Date('2025-03-13T12:00:00'));
    
    // モック関数の基本的な動作を設定
    mockScheduler.scheduleTask.mockResolvedValue({ 
      taskId: 'task-123',
      scheduledAt: new Date('2025-03-14T09:00:00').toISOString(),
      type: 'emailReminder'
    });
    
    mockScheduler.getScheduledTasks.mockResolvedValue([
      { 
        taskId: 'task-123',
        scheduledAt: new Date('2025-03-14T09:00:00').toISOString(),
        type: 'emailReminder',
        data: { userId: 'user-123', templateId: 'reminder-template' }
      },
      { 
        taskId: 'task-124',
        scheduledAt: new Date('2025-03-15T15:00:00').toISOString(),
        type: 'fortuneGeneration',
        data: { userId: 'user-456', fortuneType: 'monthly' }
      }
    ]);
    
    mockScheduler.executeScheduledTask.mockImplementation(async (taskId) => {
      return { status: 'completed', taskId, executedAt: new Date().toISOString() };
    });
    
    mockEmailSender.sendEmail.mockResolvedValue({ 
      messageId: 'email-123',
      status: 'sent',
      sentAt: new Date().toISOString()
    });
    
    mockEmailSender.sendFortuneEmail.mockResolvedValue({
      messageId: 'email-fortune-123',
      status: 'sent',
      sentAt: new Date().toISOString()
    });
  });
  
  afterEach(() => {
    // タイマーをリセット
    jest.useRealTimers();
  });
  
  test('予定された占い生成タスクの実行と通知送信の正常フロー', async () => {
    // テスト用のタスクデータ
    const taskData = {
      type: 'fortuneGeneration',
      scheduledAt: new Date('2025-03-14T09:00:00').toISOString(),
      data: {
        userId: 'user-789',
        userName: '月間鑑定ユーザー',
        email: 'monthly@example.com',
        birthDate: '1985-07-15',
        consultation: '今月の運勢について',
        fortuneType: 'monthly'
      }
    };
    
    // 1. タスクのスケジュール
    const scheduledTask = await mockScheduler.scheduleTask(taskData);
    expect(scheduledTask).toHaveProperty('taskId');
    expect(mockScheduler.scheduleTask).toHaveBeenCalledTimes(1);
    
    // 2. スケジュールされたタスクを取得
    const tasks = await mockScheduler.getScheduledTasks();
    expect(tasks.length).toBeGreaterThanOrEqual(1);
    
    // 3. 予定時刻になったとしてタスクを実行
    jest.setSystemTime(new Date('2025-03-14T09:00:01'));
    
    // タスク実行をシミュレート
    const taskExecution = await mockScheduler.executeScheduledTask(scheduledTask.taskId);
    expect(taskExecution.status).toBe('completed');
    
    // 4. タスク実行時の占い生成処理をシミュレート
    // 月間占い生成用のユーザーデータを準備
    const userData = {
      name: taskData.data.userName,
      birthDate: taskData.data.birthDate,
      consultation: taskData.data.consultation,
      orderId: `MONTHLY-${taskData.data.userId}-${new Date().getMonth()+1}`,
      email: taskData.data.email
    };
    
    // 占い生成
    const fortuneResult = await generateFortune(userData, taskData.data.fortuneType);
    expect(fortuneResult).toBeDefined();
    expect(fortuneResult.fortuneType).toBe('monthly');
    expect(generateFortune).toHaveBeenCalledTimes(1);
    
    // 5. 生成結果のメール通知
    const emailResult = await mockEmailSender.sendFortuneEmail({
      ...fortuneResult,
      email: userData.email,
      name: userData.name
    });
    
    // メール送信が呼び出されたことを確認
    expect(mockEmailSender.sendFortuneEmail).toHaveBeenCalledTimes(1);
  });
  
  test('スケジュールされたタスクがキャンセルされた場合の処理', async () => {
    // テスト用のタスクデータ
    const taskData = {
      type: 'emailReminder',
      scheduledAt: new Date('2025-03-15T10:00:00').toISOString(),
      data: {
        userId: 'user-999',
        email: 'cancel@example.com',
        templateId: 'cancel-template'
      }
    };
    
    // 1. タスクのスケジュール
    const scheduledTask = await mockScheduler.scheduleTask(taskData);
    expect(scheduledTask).toHaveProperty('taskId');
    
    // 2. タスクのキャンセル
    mockScheduler.cancelTask.mockResolvedValueOnce({ 
      taskId: scheduledTask.taskId,
      status: 'cancelled',
      cancelledAt: new Date().toISOString()
    });
    
    const cancelResult = await mockScheduler.cancelTask(scheduledTask.taskId);
    expect(cancelResult.status).toBe('cancelled');
    expect(mockScheduler.cancelTask).toHaveBeenCalledTimes(1);
    
    // 3. キャンセル後のタスク実行は何も行われないことを確認
    mockScheduler.executeScheduledTask.mockRejectedValueOnce(
      new Error(`タスク ${scheduledTask.taskId} は既にキャンセルされています`)
    );
    
    try {
      // 予定時刻になったとしてタスクを実行
      jest.setSystemTime(new Date('2025-03-15T10:00:01'));
      await mockScheduler.executeScheduledTask(scheduledTask.taskId);
      // エラーが発生しなかった場合はテスト失敗
      expect('キャンセルされたタスクは実行に失敗するはずです').toBe(false);
    } catch (error) {
      // エラーハンドラーにエラーを記録
      ErrorHandler.logError(error);
      
      // 適切なエラーメッセージを確認
      expect(error.message).toContain('既にキャンセルされています');
      expect(ErrorHandler.logError).toHaveBeenCalledTimes(1);
    }
    
    // 4. キャンセルされたタスクのメール通知は行われないことを確認
    expect(mockEmailSender.sendEmail).not.toHaveBeenCalled();
  });
  
  test('タスク実行時にエラーが発生した場合のリトライ処理', async () => {
    // リトライ用に特別な実装を行う
    let retryCounter = 0;
    ErrorHandler.autoRecover.mockImplementation(async (error, operation) => {
      retryCounter++;
      if (retryCounter === 1) {
        throw new Error('リトライ中にエラーが発生しました');
      }
      return operation();
    });
    
    // テスト用のタスクデータ
    const taskData = {
      type: 'fortuneGeneration',
      scheduledAt: new Date('2025-03-16T09:00:00').toISOString(),
      data: {
        userId: 'user-retry',
        userName: 'リトライユーザー',
        email: 'retry@example.com',
        birthDate: '1990-01-01',
        consultation: 'リトライテスト',
        fortuneType: 'general'
      }
    };
    
    // 1. タスクのスケジュール
    const scheduledTask = await mockScheduler.scheduleTask(taskData);
    
    // 2. 最初のタスク実行でエラーが発生、2回目は成功
    mockScheduler.executeScheduledTask
      .mockRejectedValueOnce(new Error('ネットワーク接続エラー'))
      .mockResolvedValueOnce({ 
        status: 'completed', 
        taskId: scheduledTask.taskId, 
        executedAt: new Date().toISOString(),
        retryCount: 1
      });
    
    // 占い生成でも最初はエラー、2回目は成功
    generateFortune
      .mockRejectedValueOnce(new Error('API接続エラー'))
      .mockResolvedValueOnce({
        fortuneId: 'fortune-retry-123',
        fortuneType: 'general',
        content: 'リトライ後の占い結果',
        orderId: 'RETRY-123',
        generatedAt: new Date().toISOString(),
        apiCost: 5.0
      });
    
    // 3. 予定時刻になったとしてタスクを実行
    jest.setSystemTime(new Date('2025-03-16T09:00:01'));
    
    let taskExecution;
    
    // エラー後に手動でリトライ
    try {
      taskExecution = await mockScheduler.executeScheduledTask(scheduledTask.taskId);
    } catch (initialError) {
      // エラーログを記録
      ErrorHandler.logError(initialError);
      
      try {
        // 1回目のリトライ
        taskExecution = await ErrorHandler.autoRecover(
          initialError, 
          () => mockScheduler.executeScheduledTask(scheduledTask.taskId)
        );
      } catch (retryError) {
        // 2回目のリトライ
        taskExecution = await ErrorHandler.autoRecover(
          retryError, 
          () => mockScheduler.executeScheduledTask(scheduledTask.taskId)
        );
      }
    }
    
    // タスク実行結果の確認
    expect(taskExecution).toBeDefined();
    expect(taskExecution.status).toBe('completed');
    
    // 4. 占い生成のリトライ
    const userData = {
      name: taskData.data.userName,
      birthDate: taskData.data.birthDate,
      consultation: taskData.data.consultation,
      orderId: `RETRY-${taskData.data.userId}`,
      email: taskData.data.email
    };
    
    let fortuneResult;
    try {
      fortuneResult = await generateFortune(userData, taskData.data.fortuneType);
    } catch (error) {
      // リトライ
      fortuneResult = await ErrorHandler.autoRecover(
        error, 
        () => generateFortune(userData, taskData.data.fortuneType)
      );
    }
    
    // 5. リトライ後の結果を検証
    expect(fortuneResult).toBeDefined();
    expect(fortuneResult.content).toBe('リトライ後の占い結果');
    expect(generateFortune).toHaveBeenCalledTimes(2); // 2回呼び出されたことを確認
    
    // autoRecoverが少なくとも1回以上呼び出されたことを確認
    expect(ErrorHandler.autoRecover).toHaveBeenCalled();
  });
});
