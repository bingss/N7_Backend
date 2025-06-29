
const config = require('../config/index')
const logger = require('../utils/logger')('OrdersController')
const appError = require('../utils/appError')
const { dataSource } = require('../db/data-source')
const { getOrdersData, getOneOrderData, createOrder, updateOrderStatus } = require('../services/orderService')
const { orderValid, isUndefined, isNotValidString, isNotValidUuid } = require('../utils/validUtils');
const orderUtils = require('../utils/orderUtils')
const ERROR_STATUS_CODE = 400;


const postOrder = async (req, res, next) => {
    try {
        // 驗證資料
        const result = orderValid.safeParse(req.body);
        if (!result.success) {
            console.error("[postOrder]", result.error.format());
            throw appError(ERROR_STATUS_CODE, '訂單欄位錯誤');
        }
        //新增訂單
        const { eventTitle, orderNo, orderPrice } = await createOrder(result.data, req.user.id)

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
            TradeLimit: 900,
            WEBATM: 1,
            ANDROIDPAY: 0,
            SAMSUNGPAY: 0,
            VACC: 0
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
    } catch (error) {
        logger.error(`[postOrder]發生錯誤：${error.message}`);
        if (error.status) {
            throw error;
        }
        next(appError(ERROR_STATUS_CODE, '發生錯誤'));
        return;
    }

}

const refundOrder = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const userId = req.user.id;

        if (isUndefined(orderId) || isNotValidString(orderId) || isNotValidUuid(orderId)) {
            return next(appError(ERROR_STATUS_CODE, '發生錯誤'));
        }

        const orderRepo = dataSource.getRepository('Order');
        const ticketRepo = dataSource.getRepository('Ticket');
        const seatRepo = dataSource.getRepository('Seat');
        const eventRepo = dataSource.getRepository('Event');

        const order = await orderRepo.findOne({
            where: { id: orderId, user_id: userId }
        });

        if (!order) {
            return next(appError(404, '找不到此訂單'))
        }

        if (order.payment_status !== 'paid') {
            return next(appError(ERROR_STATUS_CODE, '此訂單尚未付款或已退款'))
        }

        // 活動截止退款時間
        const event = await eventRepo.findOne({ where: { id: order.event_id } });
        if (!event) return next(appError(404, '找不到此活動'));

        const refundDeadline = new Date(event.start_at);
        refundDeadline.setUTCDate(refundDeadline.getUTCDate() - 7);
        refundDeadline.setUTCHours(0, 0, 0, 0); // 設為當天 00:00:00 UTC
        const now = new Date();

        if (now > refundDeadline) {
            return next(appError(400, '已超過可退款期限（活動前 7 天 00:00 截止）'));
        }

        order.payment_status = 'refunded';
        order.refund_at = new Date();
        await orderRepo.save(order);

        // 更新票券狀態
        const tickets = await ticketRepo.find({
            where: { order_id: orderId },
        });

        for (const ticket of tickets) {
            ticket.status = 'refunded';
            await ticketRepo.save(ticket);

            // 如果有座位，釋放座位狀態
            if (ticket.seat_id) {
                const seat = await seatRepo.findOne({ where: { id: ticket.seat_id } });
                if (seat) {
                    seat.status = 'available';
                    await seatRepo.save(seat);
                }
            }
        }

        res.status(200).json({
            status: true,
            message: '訂單退款成功',
        });
    } catch (error) {
        logger.error(`[refundOrder]退款錯誤：${error.message}`);
        if (error.status) {
            return next(error);
        }
        next(appError(ERROR_STATUS_CODE, '發生錯誤'));
    }
}

const postPaymentNotify = async (req, res, next) => {
    try {
        // console.log('req.body notify data', req.body);
        const response = req.body;
        const thisShaEncrypt = orderUtils.create_mpg_sha_encrypt(response.TradeInfo);
        // 使用 HASH 再次 SHA 加密字串，確保比對一致（確保不正確的請求觸發交易成功）
        if (!thisShaEncrypt === response.TradeSha) {
            throw appError(ERROR_STATUS_CODE, `付款失敗：TradeSha 不一致`)
        }
        // 解密交易內容
        const data = orderUtils.create_mpg_aes_decrypt(response.TradeInfo);
        // data: {
        //   Status: 'SUCCESS',
        //   Message: '模擬付款成功',
        //   Result: {
        //     MerchantID: 'MS155503722',
        //     Amt: 4001,
        //     TradeNo: '25060321022626930',
        //     MerchantOrderNo: 'O250603ZG7uVk0zwX',
        //     RespondType: 'JSON',
        //     IP: '118.170.196.114',
        //     EscrowBank: 'HNCB',
        //     PaymentType: 'WEBATM',
        //     PayTime: '2025-06-0321:02:27',
        //     PayerAccount5Code: '12345',
        //     PayBankCode: '809'
        //   }
        // }
        // 取得交易內容，並查詢本地端資料庫是否有相符的訂單
        await updateOrderStatus(data?.Result?.MerchantOrderNo, data?.Result?.PaymentType);
        // 交易完成，將成功資訊儲存於資料庫
        // console.log('付款完成，訂單：', orders[data?.Result?.MerchantOrderNo]);

        return res.end();
    } catch (error) {
        logger.error(`[postPaymentNotify]付款狀態修改錯誤：${error.message}`);
        if (error.status) {
            throw error;
        }
        next(appError(ERROR_STATUS_CODE, '發生錯誤'));
        return;
    }
}

const postPaymentReturn = async (req, res, next) => {
    try {
        // console.log('req.body Return data', req.body);
        const response = req.body;
        const thisShaEncrypt = orderUtils.create_mpg_sha_encrypt(response.TradeInfo);
        // 使用 HASH 再次 SHA 加密字串，確保比對一致（確保不正確的請求觸發交易成功）
        if (!thisShaEncrypt === response.TradeSha) {
            throw appError(ERROR_STATUS_CODE, `付款失敗：TradeSha 不一致`)
        }
        // 解密交易內容
        const data = orderUtils.create_mpg_aes_decrypt(response.TradeInfo) || 'error';
        const order = await dataSource.getRepository('Order').findOne({
            where: {
                serialNo: data?.Result?.MerchantOrderNo
            },
            select: ['id']
        });
        // /tickets/:id/payment_result
        res.redirect(`${config.get('newpay.returnUrl')}/#/tickets/${order.id}/payment_result`);

    } catch (error) {
        logger.error(`[postPaymentReturn]付款返回錯誤：${error.message}`);
        res.redirect(`${config.get('newpay.returnUrl')}/#/ErrorPage`);
    }
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
    postOrder,
    postPaymentNotify,
    postPaymentReturn,
    refundOrder
}


// //新增暫時訂單，供做測試使用
// const postTestOrder = async (req, res, next) => {
//     // //尚缺少欄位驗證
//     // const result = proposeEventValid.safeParse(req.body);
//     // if (!result.success) {
//     //   const errorMessages = result.error.issues.map(issue => issue.message);
//     //   logger.error(`[postEvent]欄位錯誤：${errorMessages}`);
//     //   next( appError(ERROR_STATUS_CODE, errorMessages ) );
//     //   return;
//     // }

//     //新增訂單
//     const savedTickets = await createTestOrder(req.body, req.user.id)

//     res.status(201).json({
//         status: true,
//         message: "新增成功",
//         data: {
//             savedTickets
//         }
//     })
// }
