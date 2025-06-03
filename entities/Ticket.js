const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "Ticket",
  tableName: "TICKET",
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
    price_paid: {
      type: 'integer',
      comment: "Actual price paid for this ticket"
    },
    type: {
      type: 'varchar',
      nullable: false,
    },
    status: {
      type: "varchar",
      length: 10,
      nullable: false,
      default: 'unused',
      comment: "'used', 'unused'"
    },
    created_at: {
      type: "timestamp",
      nullable: false,
      createDate: true
    },
    updated_at: {
      type: "timestamp",
      nullable: false,
      updateDate: true
    },
    seat_id: {
      type: "uuid",
      nullable: false
    },
    order_id: {
      type: "uuid",
      nullable: false
    }
  },
  relations: {
    Seat: {
      type: "one-to-one",
      target: "Seat",
      joinColumn: {
        name: "seat_id",
        referencedColumnName: 'id',
        foreignKeyConstraintName: 'ticket_seat_id_fk'
      },
      inverseSide: "Ticket",
      onDelete: "RESTRICT"
    },
    Order: {
      type: "many-to-one",
      target: "Order",
      inverseSide: "Ticket",
      joinColumn: {
        name: "order_id",
        referencedColumnName: 'id',
        foreignKeyConstraintName: 'ticket_order_id_fk'
      },
      onDelete: "RESTRICT"
    }
  }
});