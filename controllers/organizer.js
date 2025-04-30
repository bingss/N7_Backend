
const config = require('../config/index')
const logger = require('../utils/logger')('UploadImage')
const appError = require('../utils/appError')
const formidable = require('formidable')

const firebaseAdmin = require('firebase-admin')
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(config.get('secret.firebase.serviceAccount')),
  storageBucket: config.get('secret.firebase.storageBucket')
})
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_FILE_TYPES = {
    'image/jpeg': true,
    'image/jpg': true,
    'image/png': true
}
const bucket = firebaseAdmin.storage().bucket()

const postImage = async  (req, res, next)=> {
    const form = formidable.formidable({
        multiple: false,
        maxFileSize: MAX_FILE_SIZE,
        filter: ({ mimetype }) => {
            return !!ALLOWED_FILE_TYPES[mimetype]
        }
    })
    const [fields, files] = await form.parse(req)

    logger.info('files')
    logger.info(files)
    logger.info('fields')
    logger.info(fields)
    const filePath = files.image[0].filepath
    const remoteFilePath = `images/${new Date().toISOString()}-${files.image[0].originalFilename}`
    await bucket.upload(filePath, { destination: remoteFilePath })
    const options = {
        action: 'read',
        expires: Date.now() + 24 * 60 * 60 * 1000
    }
    const [imageUrl] = await bucket.file(remoteFilePath).getSignedUrl(options)
    logger.info(imageUrl)
    res.status(200).json({
        status: 'success',
        data: {
            image_url: imageUrl
        }
    })
}


const getAllImages = async (req, res, next) => {
  // 取得檔案列表
  const [files] = await bucket.getFiles({ prefix: 'imagesTest/' })
  // const imageList = files.map(file => file.name)
  
  // 設定檔案的存取權限
  const config = {
    action: 'read',
    expires: Date.now() + 24 * 60 * 60 * 1000, // 1 天後過
  };

  // 取得圖片名稱與下載連結
  const imageList = await Promise.all(
    files.map(async file => ({
      name: file.name,
      url: (await file.getSignedUrl(config))[0],
    }))
  );
    
  res.status(200).json({
    status: 'success',
    data: {
      image_list: imageList
    }
  })
}

module.exports = {
    postImage
}