
const config = require('../config/index')
const logger = require('../utils/logger')('Organizer')
const appError = require('../utils/appError')
const { dataSource } = require('../db/data-source')
const { createNewEvent } = require('../services/eventService')
const { uploadImage } = require('../utils/imageUtils')
const { proposeEventValid } = require('../utils/validUtils');

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
        data: {
          id: savedEvent.id,
          name: savedEvent.title,
          cover_image_url: newCoverImgUrl,
          section_image_url: newSectionImgUrl,
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
    postImage
}