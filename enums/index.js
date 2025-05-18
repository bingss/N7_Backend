
const USER_ROLE = require('./userRole');
const IMAGE_TYPES = require('./imageType');
const PAYMENT_METHOD = require('./paymentMethod');

const {EVENT_STATUS, EVENT_CHINESE_STATUS} = require('./eventStatus');
const TICKET_STATUS = require('./ticketStatus');
const SEAT_STATUS = require('./seatStatus');
const USER_STATUS = require('./userStatus');

module.exports = {
    USER_ROLE,
    IMAGE_TYPES,
    PAYMENT_METHOD,
    EVENT_STATUS,
    TICKET_STATUS,
    SEAT_STATUS,
    USER_STATUS,
    EVENT_CHINESE_STATUS
  };
