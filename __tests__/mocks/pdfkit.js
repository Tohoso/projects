// PDFKitのモック
class MockPDFDocument {
  constructor() {
    this.pipe = jest.fn().mockReturnThis();
    this.font = jest.fn().mockReturnThis();
    this.fontSize = jest.fn().mockReturnThis();
    this.fillColor = jest.fn().mockReturnThis();
    this.strokeColor = jest.fn().mockReturnThis();
    this.lineWidth = jest.fn().mockReturnThis();
    this.text = jest.fn().mockReturnThis();
    this.moveDown = jest.fn().mockReturnThis();
    this.addPage = jest.fn().mockReturnThis();
    this.end = jest.fn();
    // 追加メソッド
    this.lineGap = jest.fn().mockReturnThis();
    this.image = jest.fn().mockReturnThis();
    this.stroke = jest.fn().mockReturnThis();
    this.fill = jest.fn().mockReturnThis();
    this.rect = jest.fn().mockReturnThis();
    this.moveTo = jest.fn().mockReturnThis();
    this.lineTo = jest.fn().mockReturnThis();
    this.circle = jest.fn().mockReturnThis();
    this.polygon = jest.fn().mockReturnThis();
    this.save = jest.fn().mockReturnThis();
    this.restore = jest.fn().mockReturnThis();
    // PDFドキュメント状態プロパティ
    this.y = 100;
    this.page = {
      width: 595,
      height: 842
    };
  }
}

const PDFDocument = jest.fn().mockImplementation(() => new MockPDFDocument());

module.exports = {
  default: PDFDocument,
  PDFDocument
};
