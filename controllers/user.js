const { dataSource } = require('../db/data-source')
const appError = require('../utils/appError')
const logger = require('../utils/logger')('UsersController ')
const { isValidString, isValidPassword, isUndefined, isNotValidString } = require('../utils/validUtils')
const bcrypt = require('bcrypt')
const isAuth = require('../middleware/isAuth')
const handleErrorAsync = require('../utils/handleErrorAsync')
const { generateJWT } = require('../utils/jwtUtils')

const saltRounds = 10

const usersController = {
    async postSignup(req, res, next) {
        const passwordPattern = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,16}/
        const { name, email, password } = req.body
        // 驗證必填欄位
        if (isUndefined(name) || isNotValidString(name) || isUndefined(email) || isNotValidString(email) || isUndefined(password) || isNotValidString(password)) {
          logger.warn('欄位未填寫正確')
          return next(appError(400, '欄位未填寫正確'))

        }
        if (!passwordPattern.test(password)) {
          logger.warn('建立使用者錯誤: 密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字')
          return next(appError(400, '密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字'))

        }
        const userRepository = dataSource.getRepository('User')
        // 檢查 email 是否已存在
        const findUser = await userRepository.findOne({
          where: { email }
        })
    
        if (findUser) {
          logger.warn('建立使用者錯誤: Email 已被使用')
          return next(appError(409, 'Email 已被使用'))

        }
    
    
        // 建立新使用者
        const hashPassword = await bcrypt.hash(password, saltRounds)
        const newUser = userRepository.create({
          name,
          email,
          role: 'USER',
          password: hashPassword
        })
    
        const savedUser = await userRepository.save(newUser)
        logger.info('新建立的使用者ID:', savedUser.id)
    
        res.status(201).json({
          status: 'success',
          data: {
            user: {
              id: savedUser.id,
              name: savedUser.name
            }
          }
        })
    },
    async postLogin(req, res, next) {
        const { email, password } = req.body
        if (!isValidString(email) ||! isValidString(password)) {
          // res.status(400).json({
          //   status: 'failed',
          //   message: '欄位未填寫正確'
          // })
          next(appError(400, '欄位未填寫正確'))
          return
        }
        if(!isValidPassword(password)) {
          next(appError(400, '密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字'))
          // res.status(400).json({
          //   status: 'failed',
          //   message: '密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字'
          // })
          return
        }
    
        
        const userRepo = await dataSource.getRepository('User')
        // 使用者不存在或密碼輸入錯誤
        const findUser = await userRepo.findOne({
          select: ['id', 'name', 'password'],
          where: { 
            email 
          }
        })
        if (!findUser) {
          logger.warn('登入錯誤: 使用者不存在或密碼輸入錯誤')
          next(appError(400, '使用者不存在或密碼輸入錯誤'))
          return
        }
      
        const isMatch = await bcrypt.compare(password, findUser.password)
        if (!isMatch) {
          console.log(password, findUser.password)
          logger.warn('登入錯誤: 使用者不存在或密碼輸入錯誤')
          next(appError(400, '登入錯誤: 使用者不存在或密碼輸入錯誤'))
          return
        }
        // JWT
        const token = generateJWT({
          id: findUser.id,
          role: findUser.role
          // name: findUser.name
        })
    
    
        res.status(201).json({
          status: 'success',
          data: {
            token,
            user: {
              id: findUser.id,
              name: findUser.name
    
            }
          }
        })
    },
    async getProfile(req, res, next) {
        const { id } = req.user;
        const findUser = await dataSource.getRepository('User').findOne({
          where: { id }
        })
    
        if(!isValidString(id)) {
          next(appError(400, '欄位未填寫正確'))
          return
        }
    
        // if (!findUser) {
        //   logger.warn('取得使用者資料錯誤: 欄位未填寫正確')
        //   next(appError(400, '取得使用者資料錯誤: 欄位未填寫正確'))
        
        res.status(200).json({
          status: 'success',
          data: {
            email: findUser.email,
            name: findUser.name
          }
        })
    },
    async putProfile(req, res, next) {
        const { id } = req.user;
        const { name } = req.body;
        if (!isValidString(name)) {
          next(appError('400', '欄位未填寫正確'))
          return
        }
        const userRepo = dataSource.getRepository('User')
        // 檢查使用者名稱未變更
        const findUser = await userRepo.findOne({
          where: { id }
        })
    
        const updateUser = await userRepo.update({
          id
        }, {
          name
        })
    
        if (updateUser.affected === 0) {
          logger.warn('更新使用者失敗')
          next(appError(400, '更新使用者失敗'))
          return
        }
    
        if(findUser.name === name) {
          logger.warn('更新使用者失敗: 使用者名稱未變更')
          next(appError(400, '更新使用者失敗: 使用者名稱未變更'))
          return
        }
        
        res.status(200).json({
          status: 'success',
        })    
    },
    async putPassword(req, res, next) {
    const { id } = req.user
        const { password, new_password, confirm_new_password } = req.body
        if (!isValidString(password) || !isValidString(new_password) || !isValidString(confirm_new_password)) {
            return next(appError(400, '欄位未填寫正確'))
        }
        if (!isValidPassword(password) || !isValidPassword(new_password) || !isValidPassword(confirm_new_password)) {
            return next(appError(400, '密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字'))
        }
        if (new_password === password) {
            return next(appError(400, '新密碼不能與舊密碼相同'))
        }
        if (new_password !== confirm_new_password ) {
            return next(appError(400, '新密碼與驗證新密碼不一致'))
        }
        const userRepo = dataSource.getRepository('User')
        const findUser = await userRepo.findOne({
            select: ['password'],
            where: { id }
        })

        const isMatch = await bcrypt.compare(password, findUser.password)
        if (!isMatch) {
            return next(appError(400, '密碼輸入錯誤'))
        }
        
        // 密碼加密並更新資料
        const hashPassword = await bcrypt.hash(new_password, saltRounds)
        const updateUser = await userRepo.update({id}, { password: hashPassword})
        if (updateUser.affected === 0) {
            return next(appError(400, '更新密碼失敗'))
        }

        res.status(200).json({
            status: 'success',
            data: null,
        })
    }
}

module.exports = usersController