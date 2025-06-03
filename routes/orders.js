const express = require('express')
const config = require('../config/index')
const logger = require('../utils/logger')('Tickets')
const router = express.Router()
const { dataSource } = require('../db/data-source')
const handleErrorAsync = require('../utils/handleErrorAsync')
const ordersController = require('../controllers/orders')
const isAuth = require('../middlewares/auth')({
  secret: config.get('secret').jwtSecret,
  userRepository: dataSource.getRepository('User'),
  logger
})

/* 金流測試用頁面*/
// router.get('/test', (req, res) => {
//   res.render('index', { title: 'Express', Host: `${config.get('newpay.host')}/orders/create` } );
// });

// 12.新增付款資訊(建立交易)(金流)
router.post('/create', isAuth, handleErrorAsync(ordersController.postOrder))

// 13.確認交易：Notify回應付款結果(金流)
router.post('/payment_notify', ordersController.postPaymentNotify);

// 交易成功前端Return
router.post('/payment_return', ordersController.postPaymentReturn);

// 16.使用者取得訂單(票券)列表
router.get('/', isAuth, handleErrorAsync(ordersController.getOrders));

// 17.使用者取得單一訂單(票券)詳情
router.get('/:orderId', isAuth, handleErrorAsync(ordersController.getOneOrder));


module.exports = router
