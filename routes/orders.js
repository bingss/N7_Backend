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
router.get('/', (req, res) => {
  res.render('index', { title: 'Express', Host: `${config.get('newpay.host')}/orders` } );
});


// // 交易成功：Return （可直接解密，將資料呈現在畫面上）
// router.post('/payment_return', ordersController.postPaymentReturn);
// 確認交易：Notify


// 12.新增付款資訊(建立交易)(金流)
router.post('/', isAuth, handleErrorAsync(ordersController.postOrder))

// // 13.回應付款結果(金流)
router.post('/payment_notify', ordersController.postPaymentNotify);

// 
router.post('/postTestData', isAuth, handleErrorAsync(ordersController.postTestOrder))

// 16.使用者取得訂單(票券)列表
router.get('/', isAuth, handleErrorAsync(ordersController.getOrders));

// 17.使用者取得單一訂單(票券)詳情
router.get('/:orderId', isAuth, handleErrorAsync(ordersController.getOneOrder));


module.exports = router