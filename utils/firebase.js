const firebaseAdmin = require('firebase-admin');
const config = require('../config/index')

let firebaseApp = null;
let isFirebaseEnabled = false;
let bucket = null

// 取環境設定（避免直接 JSON.parse 出錯）
let serviceAccount = null;
try {
  serviceAccount = config.get('secret.firebase.serviceAccount');
} catch (err) {
  console.warn('沒有設定Firebase serviceAccount');
}

const storageBucket = config.get('secret.firebase.storageBucket');

if (serviceAccount && storageBucket) {
  firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(serviceAccount),
    storageBucket,
  });
  bucket = firebaseAdmin.storage().bucket()
  isFirebaseEnabled = true;
  console.info('Firebase Admin已初始化');
} else {
  console.warn('Firebase Admin未初始化，確認環境變數');
}

module.exports = {
  firebaseAdmin,
  bucket,
  isFirebaseEnabled,
};