const { dataSource } = require('../db/data-source')
const appError = require('../utils/appError')

const bcrypt = require('bcryptjs');

const { generateJWT } = require('../utils/jwtUtils');
const { isValidPassword } = require('../utils/validUtils');
const { isValidString } = require('../utils/validUtils');
const { isValidName } = require('../utils/validUtils');
const { isUndefined } = require('../utils/validUtils');
const { USER_ROLE } = require('../enums/index')
const { createOrLoginGoogleAccount } = require('../services/userService')
const userRepository = dataSource.getRepository('User');


 const googleCallback = async (req,res,next) => {
    const mode = req.authInfo.state
    const user = req.user
    if (mode === 'bind'){
        res.status(200).json({
            status: true,
            message: '綁定成功',
            data: {
                name: user.name,
                google_email : user.google_email
            }
        });
    }else{
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
    }
}



module.exports = {
    googleCallback
}
