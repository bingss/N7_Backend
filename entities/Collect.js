const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "Collect",
  tableName: "COLLECT",
  columns: {
    user_id: {
      type: "uuid",
      primary: true,
      nullable: false
    },
    event_id: {
      type: "uuid",
      primary: true,
      nullable: false
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
    }
  },
  relations: {
    User: {
      type: "many-to-one",
      target: "User",
      inverseSide: "Collect",
      joinColumn: {
        name: "user_id",
        referencedColumnName: "id",
        foreignKeyConstraintName: "collect_user_id_fk"
      },
      onDelete: "CASCADE"
    },
    Event: {
      type: "many-to-one",
      target: "Event",
      inverseSide: "Collect",
      joinColumn: {
        name: "event_id",
        referencedColumnName: "id",
        foreignKeyConstraintName: "collect_event_id_fk"
      },
      onDelete: "CASCADE"
    }
  }
});
