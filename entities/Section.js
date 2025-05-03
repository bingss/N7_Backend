const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "Section",
  tableName: "SECTION",
  columns: {
    id: {
      primary: true,
      type: "uuid",
      generated: "uuid"
    },
    section: {
      type: "varchar",
      length: 20,
      nullable: false
    },
    total_seats: {
      type: 'integer',
      nullable: false,
      default: 0
    },
    price_default: {
      type: 'integer',
      nullable: false,
      default: 0
    },
    event_id: {
      type: "uuid",
      nullable: false
    }
  },
  relations: {
    Event: {
      type: "many-to-one",
      target: "Event",
      inverseSide: "Section",
      joinColumn: {
        name: "event_id",
        referencedColumnName: 'id',
        foreignKeyConstraintName: 'section_event_id_fk'
      },
      onDelete: "CASCADE"
    },
    Seat: {
      type: "one-to-many",
      target: "Seat",
      inverseSide: "Section"
    }
  }
});