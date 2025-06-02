
const config = require('../config/index')
const logger = require('../utils/logger')('Organizer')
const appError = require('../utils/appError')
const { dataSource } = require('../db/data-source')
const userService = require('../services/userService')
const eventService = require('../services/eventService')
const { uploadImage } = require('../utils/imageUtils')
const { proposeEventValid,isUndefined,isNotValidString,isNotValidUuid } = require('../utils/validUtils');
const { decodeTicketQrcode } = require('../utils/qrcodeUtils')
const { EVENT_STATUS, EVENT_CHINESE_STATUS, USER_ROLE, USER_STATUS } = require('../enums/index')
const { extractAndValidateCity } = require('../utils/cityUtils')
const ERROR_STATUS_CODE = 400;


const getUsers = async (req, res, next) => {
    const users = await userService.getUsersData()

    res.status(200).json({
        status: true,
        message: "取得成功",
        data: users
    })
}

const getUser = async (req, res, next) => {
    const{ userId } = req.params;
    if (isUndefined(userId) || isNotValidString(userId) || isNotValidUuid(userId)) {
        next(appError(ERROR_STATUS_CODE, '欄位未填寫正確'))
        return
    }
    const formatUser = await userService.getOneUserData(userId)

    res.status(200).json({
        status: true,
        message: "取得成功",
        data: formatUser
    })
}

const patchUserStatus = async (req, res, next) => {
    const{ userId } = req.params;
    if (isUndefined(userId) || isNotValidString(userId) || isNotValidUuid(userId)) {
        next(appError(ERROR_STATUS_CODE, '欄位未填寫正確'))
        return
    }
    const isBlocked = await userService.updateUserStatus(userId)

    res.status(200).json({
        status: true,
        message: "修改成功",
        data:{
            id : userId,
            isBlocked : isBlocked
        }
    })

  return res.json({
    message: `User ${user.isBlocked ? "blocked" : "unblocked"} successfully`,
    isBlocked: user.isBlocked,
  });
};

const patchEventStatus = async (req, res, next) => {
    const { eventId } = req.params;
    const { isApproved } = req.body;
    if (isUndefined(eventId) || isNotValidString(eventId) || isNotValidUuid(eventId) ||
        typeof isApproved !== 'boolean' || isApproved === '') {
        next(appError(ERROR_STATUS_CODE, '欄位未填寫正確'))
        return
    }

    const event = await eventService.updateEventStatus(eventId, isApproved)

    res.status(200).json({
        status: true,
        message: "修改成功",
        data: event
    })
}

const getEvent = async (req, res, next) => {
    const { eventId } = req.params;
    if (isUndefined(eventId) || isNotValidString(eventId) || isNotValidUuid(eventId)) {
        next(appError(ERROR_STATUS_CODE, '欄位未填寫正確'))
        return
    }
    const event = await eventService.getCheckingEvent(eventId)

    res.status(200).json({
        status: true,
        message: "取得成功",
        data: event
    })
}

const getEvents = async (req, res, next) => {
    const events = await eventService.getAdminEvents()

    res.status(200).json({
        status: true,
        message: "取得成功",
        data: events
    })
}


module.exports = {
    getUsers,
    getUser,
    patchUserStatus,
    patchEventStatus,
    getEvent,
    getEvents
}