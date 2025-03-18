// GoogleAPIのモック
const mockAuth = {
  getClient: jest.fn().mockResolvedValue({}),
};

const mockGmailSend = jest.fn().mockResolvedValue({
  data: { id: 'mock-email-id' }
});

const mockGmail = {
  users: {
    messages: {
      send: mockGmailSend
    }
  }
};

const googleapis = {
  google: {
    gmail: jest.fn().mockReturnValue(mockGmail),
    auth: {
      GoogleAuth: jest.fn().mockImplementation(() => mockAuth)
    }
  }
};

module.exports = {
  googleapis,
  mockGmailSend,
  mockAuth
};
