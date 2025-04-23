const { dataSource } = require('../db/data-source')
const appError = require('../utils/appError')

const bcrypt = require('bcryptjs');

const { generateJWT } = require('../utils/jwtUtils');
const { isValidPassword } = require('../utils/validUtils');

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
      role: 'General Member',
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
    // 驗證時已取得user資料，所以不再次尋找
    // const { id } = req.user
    // const userRepository = dataSource.getRepository('User')
    // const user = await userRepository.findOne({
    //     select: ['serialNo','name', 'email','role'],
    //     where: { id }
    // })

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
  async getAuth(req, res) {
    try{
      const { id } = req.user
      const userRepository = dataSource.getRepository('User')
      const user = await userRepository.findOne({
          select: ['serialNo','name', 'email','role'],
          where: { id }
      })

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
    }
    const userRepo = dataSource.getRepository('User')
    // 檢查使用者名稱未變更
    
    const findUser = await userRepo.findOne({
      select:['name'],
      where: { id }
    })

    const updateUser = await userRepo.update({
      id,
      name: user.name
    }, {
      name
    })

    if (updateUser.affected === 0) {
      return res.status(400).json({ status: false, message: '更新使用者失敗' });
    }

    if(findUser.name === name) {
      return res.status(400).json({ status: false, message: '使用者不存在或密碼輸入錯誤' });
    }
    
    const result = await userRepo.findOne({
      select: ['name'],
      where: {
        id
      }
    })

    res.status(200).json({
      status: 'success',
      data: {
        user: result
      }
    })
    }catch(err){
      console.error('putProfile error:', err);
      res.status(500).json({ status: false, message: '伺服器錯誤' });
    }        
  }
};

module.exports = userController

// const userController = {
//     async postSignup(req, res, next) {
//         const passwordPattern = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,16}/
//         const { name, email, password } = req.body
//         // 驗證必填欄位
//         if (isUndefined(name) || isNotValidString(name) || isUndefined(email) || isNotValidString(email) || isUndefined(password) || isNotValidString(password)) {
//           logger.warn('欄位未填寫正確')
//           return next(appError(400, '欄位未填寫正確'))

//         }
//         if (!passwordPattern.test(password)) {
//           logger.warn('建立使用者錯誤: 密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字')
//           return next(appError(400, '密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字'))

//         }
//         const userRepository = dataSource.getRepository('User')
//         // 檢查 email 是否已存在
//         const findUser = await userRepository.findOne({
//           where: { email }
//         })
    
//         if (findUser) {
//           logger.warn('建立使用者錯誤: Email 已被使用')
//           return next(appError(409, 'Email 已被使用'))

//         }
    
    
//         // 建立新使用者
//         const hashPassword = await bcrypt.hash(password, saltRounds)
//         const newUser = userRepository.create({
//           name,
//           email,
//           role: 'USER',
//           password: hashPassword
//         })
    
//         const savedUser = await userRepository.save(newUser)
//         logger.info('新建立的使用者ID:', savedUser.id)
    
//         res.status(201).json({
//           status: 'success',
//           data: {
//             user: {
//               id: savedUser.id,
//               name: savedUser.name
//             }
//           }
//         })
//     },
//     async postLogin(req, res, next) {
//         const { email, password } = req.body
//         if (!isValidString(email) ||! isValidString(password)) {
//           // res.status(400).json({
//           //   status: 'failed',
//           //   message: '欄位未填寫正確'
//           // })
//           next(appError(400, '欄位未填寫正確'))
//           return
//         }
//         if(!isValidPassword(password)) {
//           next(appError(400, '密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字'))
//           // res.status(400).json({
//           //   status: 'failed',
//           //   message: '密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字'
//           // })
//           return
//         }
    
        
//         const userRepo = await dataSource.getRepository('User')
//         // 使用者不存在或密碼輸入錯誤
//         const findUser = await userRepo.findOne({
//           select: ['id', 'name', 'password'],
//           where: { 
//             email 
//           }
//         })
//         if (!findUser) {
//           logger.warn('登入錯誤: 使用者不存在或密碼輸入錯誤')
//           next(appError(400, '使用者不存在或密碼輸入錯誤'))
//           return
//         }
      
//         const isMatch = await bcrypt.compare(password, findUser.password)
//         if (!isMatch) {
//           console.log(password, findUser.password)
//           logger.warn('登入錯誤: 使用者不存在或密碼輸入錯誤')
//           next(appError(400, '登入錯誤: 使用者不存在或密碼輸入錯誤'))
//           return
//         }
//         // JWT
//         const token = generateJWT({
//           id: findUser.id,
//           role: findUser.role
//           // name: findUser.name
//         })
    
    
//         res.status(201).json({
//           status: 'success',
//           data: {
//             token,
//             user: {
//               id: findUser.id,
//               name: findUser.name
    
//             }
//           }
//         })
//     },
//     async getProfile(req, res, next) {
//       似乎驗證時已取得user資料,所以不再次尋找
//       const { id } = req.user
//       const userRepository = dataSource.getRepository('User')
//       const user = await userRepository.findOne({
//           select: ['serialNo','name', 'email','role'],
//           where: { id }
//       })

    //   res.status(200).json({
    //       status: true,
    //       message: '取得成功',
    //       data: {
    //         'serialNo':req.user.serialNo,
    //         'name': req.user.name,
    //         'email': req.user.email,
    //         'role': req.user.role
    //       }
    //   })
    //   return
    // },
    // async putProfile(req, res, next) {
    //     const { id } = req.user;
    //     const { name } = req.body;
    //     if (!isValidString(name)) {
    //       next(appError('400', '欄位未填寫正確'))
    //       return
    //     }
    //     const userRepo = dataSource.getRepository('User')
    //     // 檢查使用者名稱未變更
    //     const findUser = await userRepo.findOne({
    //       where: { id }
    //     })
    
    //     const updateUser = await userRepo.update({
    //       id
    //     }, {
    //       name
    //     })
    
    //     if (updateUser.affected === 0) {
    //       logger.warn('更新使用者失敗')
    //       next(appError(400, '更新使用者失敗'))
    //       return
    //     }
    
    //     if(findUser.name === name) {
    //       logger.warn('更新使用者失敗: 使用者名稱未變更')
    //       next(appError(400, '更新使用者失敗: 使用者名稱未變更'))
    //       return
    //     }
        
    //     res.status(200).json({
    //       status: 'success',
    //     })    
    // },
    // async putPassword(req, res, next) {
    // const { id } = req.user
    //     const { password, new_password, confirm_new_password } = req.body
    //     if (!isValidString(password) || !isValidString(new_password) || !isValidString(confirm_new_password)) {
    //         return next(appError(400, '欄位未填寫正確'))
    //     }
    //     if (!isValidPassword(password) || !isValidPassword(new_password) || !isValidPassword(confirm_new_password)) {
    //         return next(appError(400, '密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字'))
    //     }
    //     if (new_password === password) {
    //         return next(appError(400, '新密碼不能與舊密碼相同'))
    //     }
    //     if (new_password !== confirm_new_password ) {
    //         return next(appError(400, '新密碼與驗證新密碼不一致'))
    //     }
    //     const userRepo = dataSource.getRepository('User')
    //     const findUser = await userRepo.findOne({
    //         select: ['password'],
    //         where: { id }
    //     })

    //     const isMatch = await bcrypt.compare(password, findUser.password)
    //     if (!isMatch) {
    //         return next(appError(400, '密碼輸入錯誤'))
    //     }
        
    //     // 密碼加密並更新資料
    //     const hashPassword = await bcrypt.hash(new_password, saltRounds)
    //     const updateUser = await userRepo.update({id}, { password: hashPassword})
    //     if (updateUser.affected === 0) {
    //         return next(appError(400, '更新密碼失敗'))
    //     }

    //     res.status(200).json({
    //         status: 'success',
    //         data: null,
    //     })
    // }
// }