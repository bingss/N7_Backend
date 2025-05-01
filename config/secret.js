let serviceAccount = null;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }
} catch (err) {
  console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT 解析失敗，請確認格式正確');
}

module.exports = {
  jwtSecret: process.env.JWT_SECRET || 'default-secret',
  jwtExpiresDay: process.env.JWT_EXPIRES_DAY || '7d',
  firebase: {
    serviceAccount,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  }
}