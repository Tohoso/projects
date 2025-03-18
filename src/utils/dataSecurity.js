import CryptoJS from 'crypto-js';
import fs from 'fs';
import path from 'path';

class DataSecurityManager {
  constructor() {
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'defaultKey';
    this.logFilePath = path.join(__dirname, 'securityLogs.txt');
  }

  encryptData(data) {
    return CryptoJS.AES.encrypt(JSON.stringify(data), this.encryptionKey).toString();
  }

  decryptData(ciphertext) {
    const bytes = CryptoJS.AES.decrypt(ciphertext, this.encryptionKey);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  }

  accessControl(userId, action) {
    // Example access control logic
    if (userId !== 'admin') {
      this.logSecurityEvent(`${userId} attempted to ${action} without sufficient permissions.`);
      return false;
    }
    return true;
  }

  logSecurityEvent(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} - ${message}\n`;
    fs.appendFileSync(this.logFilePath, logMessage);
  }

  manageDataRetention() {
    // Example data retention management
    const files = fs.readdirSync('/path/to/data');
    files.forEach(file => {
      const filePath = path.join('/path/to/data', file);
      const stats = fs.statSync(filePath);
      const now = new Date().getTime();
      const fileAge = now - new Date(stats.mtime).getTime();

      // If file is older than 30 days, delete it
      if (fileAge > 30 * 24 * 60 * 60 * 1000) {
        fs.unlinkSync(filePath);
        this.logSecurityEvent(`Deleted old file: ${file}`);
      }
    });
  }

  autoDeleteSensitiveData() {
    // Example auto deletion logic for sensitive data
    const sensitiveDataPath = '/path/to/sensitive/data';
    fs.readdirSync(sensitiveDataPath).forEach(file => {
      fs.unlinkSync(path.join(sensitiveDataPath, file));
      this.logSecurityEvent(`Auto-deleted sensitive file: ${file}`);
    });
  }
}

export default DataSecurityManager;