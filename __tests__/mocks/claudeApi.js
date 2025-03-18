// Claude APIのモック
const mockClaudeResponse = {
  data: {
    content: [
      {
        type: "text",
        text: "テスト占い結果：あなたは近い将来、大きな幸運に恵まれるでしょう。新しい出会いや機会が訪れ、長年の夢が叶う可能性があります。日々の小さな幸せに感謝する気持ちを忘れないことが、さらなる幸運を引き寄せるカギとなります。"
      }
    ]
  }
};

const mockAxios = {
  post: jest.fn().mockResolvedValue(mockClaudeResponse)
};

module.exports = {
  mockClaudeResponse,
  mockAxios
};
