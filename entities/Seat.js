const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "Seat",
  tableName: "SEAT",
  columns: {
    id: {
      primary: true,
      type: "uuid",
      generated: "uuid"
    },
    seat_number: {
      type: "varchar",
      length: 10,
      nullable: false
    },
    status: {
      type: "varchar",
      length: 10,
      nullable: false,
      default: 'available',
      comment: "'available', 'sold', 'reserved'"
    },
    section_id: {
      type: "uuid",
      nullable: false,
    }
  },
  relations: {
    Section: {
      type: "many-to-one",
      target: "Section",
      inverseSide: "Seat",
      joinColumn: {
        name: "section_id",
        referencedColumnName: 'id',
        foreignKeyConstraintName: 'seat_section_id_fk'
      },
      onDelete: "CASCADE"
    },
    Ticket: {
      type: "one-to-one",
      target: "Ticket",
      inverseSide: "Seat",
      mappedBy: "Seat"
    }

  }
});