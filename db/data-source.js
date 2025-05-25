const { DataSource } = require('typeorm')
const config = require('../config/index')


const User = require('../entities/User')
const Event = require('../entities/Event')
const Order = require('../entities/Order')
const Seat = require('../entities/Seat')
const Section = require('../entities/Section')
const Ticket = require('../entities/Ticket')
const Type = require('../entities/Type')
const AccountAuth = require('../entities/AccountAuth')
const {UserSnSubscriber, TicketSnSubscriber, OrderSnSubscriber} =require('../subscribers/serialNoSubscriber')



const dataSource = new DataSource({
  type: 'postgres',
  host: config.get('db.host'),
  port: config.get('db.port'),
  username: config.get('db.username'),
  password: config.get('db.password'),
  database: config.get('db.database'),
  synchronize: config.get('db.synchronize'),
  poolSize: 10,
  entities: [
    User,
    Event,
    Order,
    Seat,
    Section,
    Ticket,
    Type,
    AccountAuth
  ],
  subscribers: [
    UserSnSubscriber,
    TicketSnSubscriber,
    OrderSnSubscriber,
  ],
  ssl: config.get('db.ssl'),
  extra: {
    ssl: config.get('db.ssl') ? { rejectUnauthorized: false } : false
  }
});

module.exports = { dataSource }
