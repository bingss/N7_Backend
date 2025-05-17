
const config = require('../config/index')
const logger = require('../utils/logger')('Organizer')
const appError = require('../utils/appError')
const { dataSource } = require('../db/data-source')
const { verifyTicket } = require('../services/ticketService')
const { createNewEvent,updateEvent,getEditEventData,getOrgEventsData,getOneOrgEventData } = require('../services/eventService')
const { uploadImage } = require('../utils/imageUtils')
const { proposeEventValid,isUndefined,isNotValidString,isNotValidUuid } = require('../utils/validUtils');
const { decodeTicketQrcode } = require('../utils/qrcodeUtils')
const ERROR_STATUS_CODE = 400;

const postEvent = async (req, res, next) => {
    //欄位驗證
    const result = proposeEventValid.safeParse(req.body);
    if (!result.success) {
      const errorMessages = result.error.issues.map(issue => issue.message);
      logger.error(`[postEvent]欄位錯誤：${errorMessages}`);
      next( appError(ERROR_STATUS_CODE, errorMessages ) );
      return;
    }

    //新增活動
    const {savedEvent,
        newCoverImgUrl,
        newSectionImgUrl} = await createNewEvent(result.data, req.user.id)

    res.status(201).json({
        status: true,
        message: "新增成功",
        data: {
          id: savedEvent.id,
          title: savedEvent.title,
          cover_image_url: newCoverImgUrl,
          section_image_url: newSectionImgUrl,
          created_at: savedEvent.created_at,
          updated_at: savedEvent.updated_at,
          status: savedEvent.status,
        }
    })
}

const putEvent = async (req, res, next) => {
    //欄位驗證
    const { eventId } = req.params
    if (isUndefined(eventId) || isNotValidString(eventId) || isNotValidUuid(eventId)) {
        next(appError(ERROR_STATUS_CODE, '欄位未填寫正確'))
        return
    }
    const result = proposeEventValid.safeParse(req.body);
    if (!result.success) {
      const errorMessages = result.error.issues.map(issue => issue.message);
      logger.error(`[postEvent]欄位錯誤：${errorMessages}`);
      next( appError(ERROR_STATUS_CODE, errorMessages ) );
      return;
    }

    //編輯活動
    const {savedEvent} = await updateEvent(result.data, eventId, req.user.id)

    res.status(201).json({
        status: true,
        message: "編輯成功",
        data: {
          id: savedEvent.id,
          title: savedEvent.title,
          cover_image_url: savedEvent.cover_image_url,
          section_image_url: savedEvent.section_image_url,
          created_at: savedEvent.created_at,
          updated_at: savedEvent.updated_at,
          status: savedEvent.status,
        }
    })
}

const getEvents = async (req, res, next) => {
    const orgUserId = req.user.id
    const groupedOrders = await getOrgEventsData(orgUserId)

    res.status(200).json({
        status: true,
        message: "取得活動列表成功",
        data: groupedOrders
    })
}

const getEvent = async (req, res, next) => {
    const { eventId } = req.params
    if (isUndefined(eventId) || isNotValidString(eventId) || isNotValidUuid(eventId)) {
        next(appError(ERROR_STATUS_CODE, '欄位未填寫正確'))
        return
    }
    const orgUserId = req.user.id
    const order = await getOneOrgEventData(orgUserId, eventId)

    res.status(200).json({
        status: true,
        message: "取得活動列表成功",
        data: order
    })
}

const getEditEvent = async (req, res, next) => {
    const { eventId } = req.params
    if (isUndefined(eventId) || isNotValidString(eventId) || isNotValidUuid(eventId)) {
        next(appError(ERROR_STATUS_CODE, '欄位未填寫正確'))
        return
    }
    const orgUserId = req.user.id
    const order = await getEditEventData(orgUserId, eventId)

    res.status(200).json({
        status: true,
        message: "取得資料成功",
        data: order
    })
}

const postImage = async  (req, res, next)=> {
    const imageUrl = await uploadImage(req)
    res.status(201).json({
        status: true,
        message:"上傳成功",
        data: {
            image_url: imageUrl
        }
    })
}

const patchTicket = async  (req, res, next)=> {
    const { orgEventId } = req.params
    const token = req.query.token
    if (isUndefined(orgEventId) || isNotValidString(orgEventId) || isNotValidUuid(orgEventId) 
        || isUndefined(token) || isNotValidString(token)) {
        next(appError(ERROR_STATUS_CODE, '欄位未填寫正確'))
        return
    }
    try{
        const ticketInfo =await decodeTicketQrcode(token)
        const formatTicket = await verifyTicket(ticketInfo, orgEventId)
        res.status(201).json({
            status: true,
            message:"驗票成功",
            data: {
                ...formatTicket
            }
        })
    }
    catch(error){
        if(error.status) throw error
        throw appError(ERROR_STATUS_CODE, '驗證發生錯誤！請再次掃描')
    }
}

module.exports = {
    postEvent,
    putEvent,
    getEvents,
    getEvent,
    getEditEvent,
    postImage,
    patchTicket
}