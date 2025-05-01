const { dataSource } = require('../db/data-source')
const appError = require('../utils/appError')

const bcrypt = require('bcryptjs');

const { generateJWT } = require('../utils/jwtUtils');
const { isValidPassword } = require('../utils/validUtils');
const { isValidString } = require('../utils/validUtils');
const { isValidName } = require('../utils/validUtils');
const { isUndefined } = require('../utils/validUtils');
const { USER_ROLE } = require('../enums/index')

const userRepository = dataSource.getRepository('User');
const emailRule = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userController = {

  // 註冊
  async postSignup(req, res) {
    const { name, email, password, confirm_password } = req.body;
  
    if (!name || !email || !password || !confirm_password) {
      return res.status(400).json({ status: false, message: '欄位未填寫正確' });
    }

    if (!emailRule.test(email)) {
      return res.status(400).json({ status: false, message: 'Email 不符合格式' });
    }

    if(!isValidPassword(password)) {
      return res.status(400).json({ status: false, message: '密碼不符合規則，需要包含英文數字大小寫，最短 8 個字，最長 32 個字' });
    }
  
    if (password !== confirm_password) {
      return res.status(400).json({ status: false, message: '密碼與確認密碼不一致' });
    }
  
    const existingUser = await userRepository.findOne({ where: { email } });
  
    if (existingUser) {
      return res.status(409).json({ status: false, message: '註冊失敗，Email 已被使用' });
    }
  
    const hashedPassword = await bcrypt.hash(password, 12);
  
    const newUser = userRepository.create({
      name,
      email,
      role: USER_ROLE.GENERAL,
      password: hashedPassword
    });
  
    await userRepository.save(newUser);
  
    res.status(201).json({ status: true, message: '註冊成功' });
  },

  // 登入
  async postLogin(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ status: false, message: '欄位未填寫正確' });
    }

    const userRepository = dataSource.getRepository('User');
    const user = await userRepository.findOne({
      where: { email },
      select: ['id', 'email', 'password', 'name', 'role']
    });

    if (!user) {
      return res.status(401).json({ status: false, message: '使用者不存在或密碼輸入錯誤' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ status: false, message: '使用者不存在或密碼輸入錯誤' });
    }

    const token = generateJWT({ userId: user.id });
    res.status(200).json({
      status: true,
      message: '登入成功',
      data: {
        token,
        user: {
          name: user.name,
          role: user.role
        }
      }
    });
  },

  // 取得使用者資料
  async getProfile(req, res, next) {
    res.status(200).json({
        status: true,
        message: '取得成功',
        data: {
          'serialNo':req.user.serialNo,
          'name': req.user.name,
          'email': req.user.email,
          'role': req.user.role
        }
    })
    return
  },

  // 驗證登入狀態
  async postAuth(req, res) {
    try{
      // const { id } = req.user
      // const userRepository = dataSource.getRepository('User')
      // const user = await userRepository.findOne({
      //     select: ['serialNo','name', 'email','role'],
      //     where: { id }
      // })
      res.status(200).json({
          status: true,
          message: '驗證成功'
      })
    } catch (err) {
      console.error('getAuth error:', err);
      res.status(500).json({ status: false, message: '伺服器錯誤' });
    }
  },
  
  // 取得所有使用者
  async getAllUsers(req, res) {
    try {
      const users = await userRepository.find({
        select: ['id', 'name', 'email', 'role', 'password', 'created_at']
      });

      res.status(200).json({
        status: true,
        message: '取得使用者成功',
        users
      });
    } catch (err) {
      console.error('getAllUsers error:', err);
      res.status(500).json({ status: false, message: '伺服器錯誤' });
    }
  },

  async putProfile(req, res, next) {
    try{
      const { id } = req.user;
      const { name } = req.body;
    if (!isValidString(name)) {
      next(appError('400', '欄位未填寫正確'))
      return
    }else if(!isValidName(name)){
      return res.status(400).json({ status: false, message: '欄位未填寫正確，最少 2 個字元，最長 10 字元，不得包含特殊字元與空白' });
    }

    const userRepo = dataSource.getRepository('User')
    // 檢查使用者名稱未變更
    
    const findUser = await userRepo.findOne({
      select:['name'],
      where: { id }
    })

    const updateUser = await userRepo.update({
      id,
      //name: user.name
    }, {
      name
    })

    if (updateUser.affected === 0) {
      return res.status(400).json({ status: false, message: '欄位未填寫正確' });
    }

    if(findUser.name === name) {
      return res.status(400).json({ status: false, message: '欄位未填寫正確，與變更前名稱重複' });
    }
    
    // if(!isValidName(name)){
    //   return res.status(400).json({ status: false, message: '欄位未填寫正確，最少 2 個字元，最長 10 字元，不得包含特殊字元與空白' });
    // }

    const result = await userRepo.findOne({
      select: ['name'],
      where: {
        id
      }
    })

    res.status(200).json({
      status: true,
      data: {
        user: result
      }
    })
    }catch(err){
      console.error('putProfile error:', err);
      res.status(500).json({ status: false, message: '伺服器錯誤' });
    }        
  },

  async putPassword (req, res, next) {
    try {
      const { id } = req.user
      const { password:password, new_password: newPassword, confirm_new_password: confirmNewPassword } = req.body
      if (isUndefined(password) || !isValidString(password) ||
      isUndefined(newPassword) || !isValidString(newPassword) ||
      isUndefined(confirmNewPassword) || !isValidString(confirmNewPassword)) {
        // logger.warn('欄位未填寫正確')
        res.status(400).json({
          status: false,
          message: '欄位未填寫正確'
        })
        return
      }
      if (!isValidPassword(password) || !isValidPassword(newPassword) || !isValidPassword(confirmNewPassword)) {
        // logger.warn('密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字')
        res.status(400).json({
          status: false,
          message: '密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字'
        })
        return
      }
      if (newPassword === password) {
        // logger.warn('新密碼不能與舊密碼相同')
        res.status(400).json({
          status: false,
          message: '新密碼不能與舊密碼相同'
        })
        return
      }else if (newPassword !== confirmNewPassword) {
        // logger.warn('新密碼與驗證新密碼不一致')
        res.status(400).json({
          status: false,
          message: '新密碼與再次驗證密碼欄位不一致'
        })
        return
      }
      const userRepository = dataSource.getRepository('User')
      const existingUser = await userRepository.findOne({
        select: ['password'],
        where: { id }
      })
      const isMatch = await bcrypt.compare(password, existingUser.password)
      if (!isMatch) {
        res.status(400).json({
          status: false,
          message: '舊密碼輸入錯誤'
        })
        return
      }
      const salt = await bcrypt.genSalt(10)
      const hashPassword = await bcrypt.hash(newPassword, salt)
      const updatedResult = await userRepository.update({
        id
      }, {
        password: hashPassword
      })
      if (updatedResult.affected === 0) {
        res.status(400).json({
          status: false,
          message: '更新密碼失敗'
        })
        return
      }
      res.status(200).json({
        status: true,
        data: '密碼更新成功'
      })
    } catch (err) {
      console.error('putPassword error:', err);
      res.status(500).json({ status: false, message: '伺服器錯誤' });
    }
  }
};


module.exports = userController
