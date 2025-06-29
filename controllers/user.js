const { dataSource } = require('../db/data-source')
const appError = require('../utils/appError')
const logger = require('../utils/logger')('User')

const bcrypt = require('bcryptjs');

const { generateJWT } = require('../utils/jwtUtils');
const { isValidPassword } = require('../utils/validUtils');
const { isValidString } = require('../utils/validUtils');
const { isValidName } = require('../utils/validUtils');
const { isUndefined } = require('../utils/validUtils');
const { USER_ROLE, USER_STATUS } = require('../enums/index')
const userRepository = dataSource.getRepository('User');
const accountAuthRepository = dataSource.getRepository('AccountAuth')
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
  
    const existingUsers = await userRepository
      .createQueryBuilder("user")
      .innerJoin("user.AccountAuth", "accountauth")
      .where("user.email=:email", { email })
      .select([
          "accountauth.provider AS provider"
      ])
      .getRawMany();;
    
    if ( existingUsers.length !== 0 ) {
      if( existingUsers.some( (user) => user.provider === 'local' ) ){
        return res.status(409).json({ status: false, message: '註冊失敗，Email 已被使用' });
      }
      return res.status(409).json({ status: false, message: '註冊失敗，Email已使用其他登入方式註冊，更新密碼後新增帳密登入方式' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = userRepository.create({
      name: name,
      email: email,
      role: USER_ROLE.GENERAL,
    });

    const savedUser = await userRepository.save(newUser);
    if (!savedUser) {
        throw appError(ERROR_STATUS_CODE, '註冊失敗')
    }
    accountAuth = accountAuthRepository.create({
      provider: 'local',
      password: hashedPassword,
      user_id : savedUser.id
    })
    await accountAuthRepository.save(accountAuth);
    
    res.status(201).json({ status: true, message: '註冊成功' });
  },

  // 登入
  async postLogin(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ status: false, message: '欄位未填寫正確' });
    }

    // const user = await userRepository.findOne({
    //   where: { email },
    //   select: ['id', 'email', 'password', 'name', 'role']
    // });

    const user = await userRepository
      .createQueryBuilder("user")
      .innerJoin("user.AccountAuth", "accountauth")
      .where("user.email=:email", { email })
      .andWhere("accountauth.provider=:local",{ local:'local' })
      .select([
          "user.id AS id",
          "user.email AS email",
          "user.name AS name",
          "user.role AS role",
          "user.status AS status",
          "accountauth.password AS password"
      ])
      .getRawOne();

    if (!user) {
      return res.status(401).json({ status: false, message: '使用者不存在或密碼輸入錯誤' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ status: false, message: '使用者不存在或密碼輸入錯誤' });
    }

    if(user.status === USER_STATUS.BLOCKED){
      return res.status(401).json({ status: false, message: '使用者已被封鎖' });
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

    const userId = req.user.id

    const accountAuthRepo = dataSource.getRepository('AccountAuth')

    //取得帳號之登入方式
    const hasGoogleAuth = (await accountAuthRepo.count({
      where: { user_id: userId, provider: 'google' }
    })) > 0

    res.status(200).json({
        status: true,
        message: '取得成功',
        data: {
          serialNo: req.user.serialNo,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          google_bind: hasGoogleAuth
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
        select: ['id', 'name', 'email', 'role', 'created_at']
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
      id
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
      const { password:oldPassword, new_password: newPassword, confirm_new_password: confirmNewPassword } = req.body
      if ( isUndefined(newPassword) || !isValidString(newPassword) ||
      isUndefined(confirmNewPassword) || !isValidString(confirmNewPassword)) {
        // logger.warn('欄位未填寫正確')
        res.status(400).json({
          status: false,
          message: '欄位未填寫正確'
        })
        return
      }
      if ( !isValidPassword(newPassword) || !isValidPassword(confirmNewPassword)) {
        // logger.warn('密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字')
        res.status(400).json({
          status: false,
          message: '密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字'
        })
        return
      }
      if (newPassword === oldPassword) {
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
      const existingLocalUser = await userRepository
          .createQueryBuilder("user")
          .innerJoin("user.AccountAuth", "accountauth")
          .where("user.id=:id", { id })
          .andWhere("accountauth.provider=:local",{ local:'local' })
          .select([
              "accountauth.password AS password",
          ])
          .getRawOne();
      const salt = await bcrypt.genSalt(10)
      const hashPassword = await bcrypt.hash(newPassword, salt)

      if( !existingLocalUser ){
        accountAuth = accountAuthRepository.create({
            provider: 'local',
            password : hashPassword,
            user_id : id
        })
        await accountAuthRepository.save(accountAuth)
        
      }else{
        //若已存在local帳號，才檢核輸入之舊密碼
        if(isUndefined(oldPassword) || !isValidString(oldPassword)){
          res.status(400).json({
            status: false,
            message: '欄位未填寫正確'
          })
          return
        }
        const isMatch = await bcrypt.compare(oldPassword, existingLocalUser.password)
        if (!isMatch) {
          res.status(400).json({
            status: false,
            message: '舊密碼輸入錯誤'
          })
          return
        }

        const updatedResult = await accountAuthRepository.update({
            user_id : id,
            provider: 'local'
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
      }

      res.status(200).json({
        status: true,
        data: '密碼更新成功'
      })
    } catch (err) {
      console.error('putPassword error:', err);
      res.status(500).json({ status: false, message: '伺服器錯誤' });
    }
  },

  // 取得使用者收藏資料
  async getCollect(req, res, next) {
    const userId = req.user.id
     try {
        const collectRepository = dataSource.getRepository('Collect')
        const collects = await collectRepository
            .createQueryBuilder("collect")
            .leftJoin("collect.Event2", "event")
            .where("collect.user_id = :userId", { userId: userId })
            .select([
                "event.id AS id",
                "event.title AS title",
                "event.location AS location",
                "event.start_at AS start_at",
                "event.end_at AS end_at",
                "event.sale_start_at AS sale_start_at",
                "event.sale_end_at AS sale_end_at",
                "event.cover_image_url AS cover_image_url",
            ])
            .getRawMany();

        res.status(200).json({
            status: true,
            message: "取得收藏列表成功",
            data: collects
        })
    }catch (error) {
        if (error.status) {
            throw error;
        }
        logger.error(`[getCollectData] 取得收藏列表失敗: ${error}`)
        throw appError(ERROR_STATUS_CODE, '發生錯誤')
    }
    return
  },

  // 變更使用者收藏資料
  async patchEventCollect(req, res, next) {
    const { eventId } = req.params;
    const userId = req.user.id;
    if (isUndefined(eventId) ) {
      next(appError(ERROR_STATUS_CODE, '欄位未填寫正確'));
      return;
    }

    let msg = '';
    try {
      const collectRepository = dataSource.getRepository('Collect');
      const event = await collectRepository.findOne({
        where: {
          user_id: userId,
          event_id: eventId,
        }
      });
      if (!event) {
        const newCollect = collectRepository.create({
          user_id: userId,
          event_id: eventId,
        });
        const savedCollect = await collectRepository.save(newCollect);
        if (!savedCollect) {
          throw appError(ERROR_STATUS_CODE, '收藏失敗');
        }
        msg = '已加入收藏';
      } else {
        await collectRepository.remove(event);
        msg = '已刪除收藏';
      }

      res.status(200).json({
        status: true,
        message: msg,
      });

    } catch (err) {
      logger.error(`[patchEventCollect]${err}`);
      if (err.status) {
        return next(err);
      }
      next(appError(ERROR_STATUS_CODE, '發生錯誤'));
    }
  }
};





module.exports = userController
