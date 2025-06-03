
const config = require('../config/index')
const logger = require('../utils/logger')('TicketsController')
const appError = require('../utils/appError')
const { dataSource } = require('../db/data-source')
const { getOrdersData,getOneOrderData,createTestOrder,createOrder } = require('../services/orderService')
const { orderValid,isUndefined,isNotValidString,isNotValidUuid } = require('../utils/validUtils');
const orderUtils = require('../utils/orderUtils')
const { Not } = require('typeorm')
const ERROR_STATUS_CODE = 400;


const postOrder = async (req, res, next) => {
    // 驗證資料
    const result = orderValid.safeParse(req.body);
    if (!result.success) {
        console.error("[postOrder]", result.error.format());
        throw appError(ERROR_STATUS_CODE, '訂單欄位錯誤');
    }
    //新增訂單
    const { eventTitle , orderNo, orderPrice  } = await createOrder(result.data, req.user.id)

    //建立藍新需要資訊
    const TimeStamp = Math.round(new Date().getTime() / 1000);
    const order = {
        MerchantID: config.get('newpay.merchantID'),
        TimeStamp: TimeStamp,
        Version: config.get('newpay.version'),
        MerchantOrderNo: orderNo,
        Amt: orderPrice,
        ItemDesc: `${eventTitle}票券`,
        Email: req.user.email,
        TradeLimit : 900,
        ReturnURL: `https://n7-backend.onrender.com/api/v1/orders/payment_return/${orderNo}`,
        NotifyURL: `https://n7-backend.onrender.com/api/v1/orders/payment_notify`,
    }
    // 加密第一段字串，此段主要是提供交易內容給予藍新金流
    const aesEncrypt = orderUtils.create_mpg_aes_encrypt(order);
    // 使用 HASH 再次 SHA 加密字串，作為驗證使用
    const shaEncrypt = orderUtils.create_mpg_sha_encrypt(aesEncrypt);

    res.status(201).json({
        status: true,
        message: "新增成功",
        data: {
            MerchantID: order.MerchantID,
            TradeInfo: aesEncrypt,
            TradeSha: shaEncrypt,
            Version: order.Version
        }
    })
}

const postPaymentResult = async (req, res, next) => {
    //新增活動
    const savedTickets = await createTestOrder(req.body, req.user.id)

    res.status(201).json({
        status: true,
        message: "新增成功",
        data: {
            savedTickets
        }
    })
}

const postPaymentNotify = async (req, res, next) => {
    console.log('req.body notify data', req.body);
    const response = req.body;
    const thisShaEncrypt = orderUtils.create_mpg_sha_encrypt(response.TradeInfo);
    // 使用 HASH 再次 SHA 加密字串，確保比對一致（確保不正確的請求觸發交易成功）
    if (!thisShaEncrypt === response.TradeSha) {
        console.log('付款失敗：TradeSha 不一致');
        return res.end();
    }
    // 解密交易內容
    const data = orderUtils.create_mpg_aes_decrypt(response.TradeInfo);
    console.log('data:', data);

    // 取得交易內容，並查詢本地端資料庫是否有相符的訂單
    // if (!orders[data?.Result?.MerchantOrderNo]) {
    //     console.log('找不到訂單');
    //     return res.end();
    // }
    // 交易完成，將成功資訊儲存於資料庫
    // console.log('付款完成，訂單：', orders[data?.Result?.MerchantOrderNo]);

    return res.end();
}

const postPaymentReturn = async (req, res, next) => {
  console.log('req.body return data', req.body);
  res.render('success', { title: 'Express', Host:config.get('newpay.host') });
}

//新增暫時訂單，供做測試使用
const postTestOrder = async (req, res, next) => {
    // //尚缺少欄位驗證
    // const result = proposeEventValid.safeParse(req.body);
    // if (!result.success) {
    //   const errorMessages = result.error.issues.map(issue => issue.message);
    //   logger.error(`[postEvent]欄位錯誤：${errorMessages}`);
    //   next( appError(ERROR_STATUS_CODE, errorMessages ) );
    //   return;
    // }

    //新增訂單
    const savedTickets = await createTestOrder(req.body, req.user.id)

    res.status(201).json({
        status: true,
        message: "新增成功",
        data: {
            savedTickets
        }
    })
}

const getOrders = async (req, res, next) => {
    const orgUserId = req.user.id
    const orders = await getOrdersData(orgUserId)

    res.status(200).json({
        status: true,
        message: "取得活動列表成功",
        data: orders
    })
}

const getOneOrder = async (req, res, next) => {
    const { orderId } = req.params
    if (isUndefined(orderId) || isNotValidString(orderId) || isNotValidUuid(orderId)) {
        next(appError(ERROR_STATUS_CODE, '欄位未填寫正確'))
        return
    }
    const userId = req.user.id
    const order = await getOneOrderData(userId, orderId)

    res.status(200).json({
        status: true,
        message: "取得成功",
        data: order
    })
}

module.exports = {
    getOrders,
    getOneOrder,
    postTestOrder,
    postOrder,
    postPaymentResult,
    postPaymentNotify,
    postPaymentReturn
}
