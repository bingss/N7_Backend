
const config = require('../config/index')
const logger = require('../utils/logger')('TicketsController')
const appError = require('../utils/appError')
const { dataSource } = require('../db/data-source')
const { getTicketsData,getSingleTicketData } = require('../services/ticketsService')
const { proposeEventValid,isUndefined,isNotValidString,isNotValidUuid } = require('../utils/validUtils');

const ERROR_STATUS_CODE = 400;


const getTickets = async (req, res, next) => {
    const orgUserId = req.user.id
    const tickets = await getTicketsData(orgUserId)

    res.status(200).json({
        status: true,
        message: "取得活動列表成功",
        data: tickets
    })
}

const getSingleTicket = async (req, res, next) => {
    const { orderId } = req.params
    if (isUndefined(orderId) || isNotValidString(orderId) || isNotValidUuid(orderId)) {
        next(appError(ERROR_STATUS_CODE, '欄位未填寫正確'))
        return
    }
    const userId = req.user.id
    const ticket = await getSingleTicketData(userId, orderId)

    res.status(200).json({
        status: true,
        message: "取得成功",
        data: ticket
    })
}

module.exports = {
    getTickets,
    getSingleTicket
}