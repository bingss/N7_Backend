const express = require('express')
const cors = require('cors')
const path = require('path')
const pinoHttp = require('pino-http')
const logger = require('./utils/logger')('App')
const userRouter = require('./routes/user')
const organizerRouter = require('./routes/organizer')
const ordersRouter = require('./routes/orders')

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(pinoHttp({
  logger,
  serializers: {
    req(req) {
      req.body = req.raw.body
      return req
    }
  }
}))
app.use(express.static(path.join(__dirname, 'public')))

app.get('/healthcheck', (req, res) => {
  res.status(200)
  res.send('OK')
})

app.get('/', (req, res) => {
  res.send('API is running...');
});

app.use('/api/v1/users', userRouter)
app.use('/api/v1/organizer', organizerRouter)
app.use('/api/v1/orders', ordersRouter)


// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  req.log.error(err)
  if (err.status) {
    res.status(err.status).json({
      status: false,
      message: err.message
    })
    return
  }
  res.status(500).json({
    status: false,
    message: '發生伺服器錯誤'
  })
})

module.exports = app
