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
      nullable: false
    },
    password: {
      type: 'varchar',
      length: 72,
      nullable: false
    },
    status: { //'active', 'blocked'
      type: 'varchar',
      length: 10,
      nullable: false,
      default: 'active'
    },
    serial_no: {
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
  }
});