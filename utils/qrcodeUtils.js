const QRCode = require('qrcode');
const { generateJWT, verifyJWT } = require('./jwtUtils');

const generateTicketQRCode = async ( ticketInfo ) => {
  const token = generateJWT(ticketInfo,'10m'); // 產生 JWT token，10分鐘過期
  // 產生 base64 圖片 data:image/png;base64,...
  const qrCodeImage = await QRCode.toDataURL(token);
  return qrCodeImage;
}

const decodeTicketQRCode = async (qrCodeImage) => {
  // 解析 base64 圖片
//   const data = await QRCode.toString(qrCodeImage, { type: 'json' });
//   return JSON.parse(data);
}

module.exports = {
  generateTicketQRCode
};