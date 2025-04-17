// sian使用，模擬req加入user資料
const fakeLogin = (userRepository, id, logger = console) => {
    // req加入傳入的userid，假裝登入
    return async (req, res, next) => {
      try {
        const user = await userRepository.findOneBy({ id: id })
        if (!user) {
          const error = new Error('尚未登入')
          error.status = 401
          next(error)
          return
        }
        req.user = user
        next()
      } catch (error) {
        logger.error(`[fakeLogin] ${error.message}`)
        next(error)
      }
    }
  };
  
module.exports = fakeLogin;