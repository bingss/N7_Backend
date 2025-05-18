const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "Type",
  tableName: "TYPE",
  columns: {
    id: {
      primary: true,
      type: "uuid",
      generated: "uuid"
    },
    name: {
      type: "varchar",
      length: 20,
      nullable: false,
    }
  },
  relations: {
    Event: {
      type: "one-to-many",
      target: "Event",
      inverseSide: "Type"
    },
  }
});