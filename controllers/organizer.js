
const config = require('../config/index')
const logger = require('../utils/logger')('UploadImage')
const appError = require('../utils/appError')
const { uploadImage,moveFinalImage } = require('../utils/imageUtils')

const postImage = async  (req, res, next)=> {
    const imageUrl = await uploadImage(req)
    logger.info(imageUrl)
    res.status(200).json({
        status: 'success',
        data: {
            image_url: imageUrl
        }
    })
}

const moveImage = async  (req, res, next)=> {
  const {imgUrl, eventId} = req.body

  console.log(`[moveImage] ${imgUrl} to ${eventId}`)
  const newImageUrl = await moveFinalImage(imgUrl, eventId)
  logger.info(newImageUrl)
  res.status(200).json({
      status: 'success',
      data: {
        new_image_url: newImageUrl
      }
  })
}




module.exports = {
    postImage,
    moveImage
}