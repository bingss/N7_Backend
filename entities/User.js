const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: 'User',
  tableName: 'USER',
  columns: {
    id: {
      primary: true,
      type: 'uuid',
      generated: 'uuid'
    },
    name: {
      type: 'varchar',
      length: 30,
      nullable: false
    },
    email: {
      type: 'varchar',
      length: 32,
      nullable: false,
      unique: true
    },
    role: {
      type: 'varchar',
      length: 20,
      nullable: false,
      default: 'General'
    },
    password: {
      type: 'varchar',
      length: 72,
      nullable: true
    },
    status: { //'active', 'blocked'
      type: 'varchar',
      length: 10,
      nullable: false,
      default: 'active'
    },
    serialNo: {
      type: 'varchar',
      nullable: true,
      unique: true,
    },
    created_at: {
      type: 'timestamp',
      createDate: true,
      nullable: false
    },
    updated_at: {
      type: 'timestamp',
      updateDate: true,
      nullable: false
    }
  },
  relations: {
    Event: {
      type: "one-to-many",
      target: "Event",
      inverseSide: "User"
    },
    Order: {
      type: "one-to-many",
      target: "Order",
      inverseSide: "User"
    },
    AccountAuth: {
      type: "one-to-many",
      target: "AccountAuth",
      inverseSide: "User"
    }
  }
});