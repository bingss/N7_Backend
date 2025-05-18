const QRCode = require('qrcode');
const { generateJWT, verifyJWT } = require('./jwtUtils');

const generateTicketQrcode = async ( ticketInfo ) => {
  const token = generateJWT(ticketInfo,'10m'); // 產生 JWT token，10分鐘過期
  // console.log(`QRCODE：${token}`)
  // 產生 base64 圖片 data:image/png;base64,...
  const qrCodeImage = await QRCode.toDataURL(token);
  return qrCodeImage;
}

const decodeTicketQrcode = async (token) => {
  // 解析 base64 圖片
    try{
      const verifyQrcode = await verifyJWT(token)
      return verifyQrcode
    }
    catch(error){
      if(error.message === 'Token 已過期'){
        error.message = '票券已過期'
      }
      throw(error)
    }

}

module.exports = {
  generateTicketQrcode,
  decodeTicketQrcode
};