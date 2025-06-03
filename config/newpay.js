

module.exports = {
  hashKey: process.env.NEWPAY_HASHKEY || '',
  hashIV: process.env.NEWPAY_HASHIV || '',
  merchantID: process.env.NEWPAY_MERCHANTID || '',
  version: process.env.NEWPAY_VERSION || '2.0',
  host: process.env.NEWPAY_HOST || 'http://localhost:3000/',
  returnUrl: process.env.NEWPAY_RETURNURL || '',
  notifyUrl: process.env.NEWPAY_NOTIFYURL || '',
  respondType: process.env.NEWPAY_RESPONDTYPE || 'JSON'
}
