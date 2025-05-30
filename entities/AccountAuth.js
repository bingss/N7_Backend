const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "AccountAuth",
  tableName: "ACCOUNTAUTH",
  columns: {
    id: {
      primary: true,
      type: "uuid",
      generated: "uuid"
    },
    password: {
      type: 'varchar',
      length: 72,
      nullable: true
    },
    provider: {
      type: 'varchar',
      length: 20,
      nullable: false,
      default: 'local'
    },
    provider_id: {
      type: 'varchar',
      length: 72,
      nullable: true
    },
    created_at: {
      type: "timestamp",
      createDate: true,
      nullable: false
    },
    user_id: {
      type: "uuid",
      nullable: false
    }
  },
  relations: {
    User: {
      target: "User",
      type: "many-to-one",
      inverseSide: "AccountAuth",
      joinColumn: {
        name: "user_id",
        referencedColumnName: 'id',
        foreignKeyConstraintName: 'accountauth_user_id_fk'
      },
      onDelete: 'CASCADE'
    }
  }
});
