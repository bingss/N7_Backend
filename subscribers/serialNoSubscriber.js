const { EventSubscriber } = require('typeorm');
const generateSerialNo = require('../utils/generateSerialNo');
const decorateHelper = require('../utils/decorateHelper');

const createSnSubscriber = (entityName, prefix, length = 8) => {
  return decorateHelper(
    EventSubscriber(),
    class {
      static get name() {
        return `${entityName}SerialNoSubscriber`;
      }
      listenTo() {
        return entityName;
      }
      async beforeInsert(event) {
        if (!event.entity.serialNo) {
          event.entity.serialNo = generateSerialNo(prefix, length);
        }
      }
    }
  )
};

module.exports = {
  UserSnSubscriber:createSnSubscriber('User', 'U', 8),
  OrderSnSubscriber:createSnSubscriber('Order', 'O', 10), 
  TicketSnSubscriber:createSnSubscriber('Ticket', 'T', 10)
}

//單一支狀態，留著備用
// const { EventSubscriber } = require('typeorm')
// const decorateHelper = require('../utils/decorateHelper')
// const generateSerialNo = require('../utils/generateSerialNo')

// class UserSubscriber {
//   listenTo() {
//     return "User";
//   }

//   async beforeInsert(event) {
//     if (!event.entity.serialNo) {
//       event.entity.serialNo = generateSerialNo("U", 8);
//     }
//   }
// }

// module.exports = decorateHelper(EventSubscriber(), UserSubscriber);
