const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "Order",
  tableName: "ORDER",
  columns: {
    id: {
      primary: true,
      type: "uuid",
      generated: "uuid"
    },
    serialNo: {
      type: 'varchar',
      nullable: false,
      unique: true
    },
    payment_method: {
      type: "varchar",
      length: 50,
      nullable: false,
      comment: "'credit_card', 'bank_transfer', 'line_pay'..."
    },
    created_at: {
      type: "timestamp",
      createDate: true,
      nullable: false
    },
    updated_at: {
      type: "timestamp",
      updateDate: true,
      nullable: false
    },
    user_id: {
      type: "uuid",
      nullable: false
    },
    event_id: {
      type: "uuid",
      nullable: false
    }
  },
  relations: {
    User: {
      type: "many-to-one",
      target: "User",
      joinColumn: {
        name: "user_id",
        referencedColumnName: 'id',
        foreignKeyConstraintName: 'order_user_id_fk'
      }
    },
    Event: {
        type: "many-to-one",
        target: "Event",
        joinColumn: {
          name: "event_id",
          referencedColumnName: 'id',
          foreignKeyConstraintName: 'order_event_id_fk'
        }
    }
  }
});