
const config = require('../config/index')
const logger = require('../utils/logger')('TicketsController')
const appError = require('../utils/appError')
const { dataSource } = require('../db/data-source')
const { getOrdersData,getOneOrderData,createTestOrder } = require('../services/orderService')
const { proposeEventValid,isUndefined,isNotValidString,isNotValidUuid } = require('../utils/validUtils');
const ERROR_STATUS_CODE = 400;


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
    postTestOrder
}