const config = require('../config/index')
const crypto = require('crypto');

// 交易訊息字串組合
function genDataChain(order) {
  return `MerchantID=${order.MerchantID}&RespondType=${config.get('newpay.respondType')}&TimeStamp=${
    order.TimeStamp
  }&Version=${order.Version}&MerchantOrderNo=${order.MerchantOrderNo}&Amt=${
    order.Amt
  }&ItemDesc=${encodeURIComponent(order.ItemDesc)}&Email=${encodeURIComponent(
    order.Email)}&ANDROIDPAY=${order.ANDROIDPAY}&SAMSUNGPAY=${order.SAMSUNGPAY}&VACC=${order.VACC}`;
}

// 使用 aes 加密
function create_mpg_aes_encrypt(TradeInfo) {
  const encrypt = crypto.createCipheriv('aes256', config.get('newpay.hashKey'), config.get('newpay.hashIV'));
  const enc = encrypt.update(genDataChain(TradeInfo), 'utf8', 'hex');
  return enc + encrypt.final('hex');
}

// 使用 sha256 加密
function create_mpg_sha_encrypt(aesEncrypt) {
  const sha = crypto.createHash('sha256');
  const plainText = `HashKey=${config.get('newpay.hashKey')}&${aesEncrypt}&HashIV=${config.get('newpay.hashIV')}`;
  return sha.update(plainText).digest('hex').toUpperCase();
}

// 將 aes 解密
function create_mpg_aes_decrypt(TradeInfo) {
  const decrypt = crypto.createDecipheriv('aes256', config.get('newpay.hashKey'), config.get('newpay.hashIV'));
  decrypt.setAutoPadding(false);
  const text = decrypt.update(TradeInfo, 'hex', 'utf8');
  const plainText = text + decrypt.final('utf8');
  const result = plainText.replace(/[\x00-\x20]+/g, '');
  return JSON.parse(result);
}

module.exports = { 
  create_mpg_aes_encrypt,
  create_mpg_sha_encrypt,
  create_mpg_aes_decrypt
};

