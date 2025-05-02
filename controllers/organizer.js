
const config = require('../config/index')
const logger = require('../utils/logger')('Organizer')
const appError = require('../utils/appError')
const { dataSource } = require('../db/data-source')
const { createNewEvent,updateEvent } = require('../services/eventService')
const { uploadImage } = require('../utils/imageUtils')
const { proposeEventValid,isUndefined,isNotValidString,isNotValidUuid } = require('../utils/validUtils');

const postEvent = async (req, res, next) => {
    //欄位驗證
    const result = proposeEventValid.safeParse(req.body);
    if (!result.success) {
      const errorMessages = result.error.issues.map(issue => issue.message);
      logger.error(`[postEvent]欄位錯誤：${errorMessages}`);
      next( appError(400, errorMessages ) );
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
          name: savedEvent.name,
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
        next(appError(400, '欄位未填寫正確'))
        return
    }
    const result = proposeEventValid.safeParse(req.body);
    if (!result.success) {
      const errorMessages = result.error.issues.map(issue => issue.message);
      logger.error(`[postEvent]欄位錯誤：${errorMessages}`);
      next( appError(400, errorMessages ) );
      return;
    }

    //新增活動
    const {savedEvent} = await updateEvent(result.data, eventId)

    res.status(201).json({
        status: true,
        message: "編輯成功",
        data: {
          id: savedEvent.id,
          name: savedEvent.name,
          cover_image_url: savedEvent.cover_image_url,
          section_image_url: savedEvent.section_image_url,
          created_at: savedEvent.created_at,
          updated_at: savedEvent.updated_at,
          status: savedEvent.status,
        }
    })
}

const postImage = async  (req, res, next)=> {
    const imageUrl = await uploadImage(req)
    res.status(200).json({
        status: 'success',
        data: {
            image_url: imageUrl
        }
    })
}

module.exports = {
    postEvent,
    putEvent,
    postImage
}