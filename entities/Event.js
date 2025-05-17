const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "Event",
  tableName: "EVENT",
  columns: {
    id: {
      primary: true,
      type: "uuid",
      generated: "uuid"
    },
    title: {
      type: "varchar",
      length: 100,
      nullable: false
    },
    location: {
      type: "varchar",
      length: 100,
      nullable: false
    },
    address: {
      type: "varchar",
      length: 100,
      nullable: false
    },
    start_at: {
      type: "timestamp",
      nullable: false
    },
    end_at: {
      type: "timestamp",
      nullable: false
    },
    sale_start_at: {
      type: "timestamp",
      nullable: false
    },
    sale_end_at: {
      type: "timestamp",
      nullable: false
    },
    performance_group: {
      type: "varchar",
      length: 50,
      nullable: true
    },
    description: {
      type: "text"
    },
    cover_image_url: {
      type: "varchar",
      length: 2048,
      nullable: true
    },
    section_image_url: {
      type: "varchar",
      length: 2048,
      nullable: true
    },
    view_count: {
      type: 'integer',
      nullable: false,
      default: 0
    },
    type: {
      type: "varchar",
      length: 50,
      nullable: false
    },
    status: { 
      type: "varchar",
      length: 10,
      nullable: false,
      default: 'checking',
      comment: "'checking', 'approved', 'rejected'"
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
    check_at: {
      type: "timestamp",
      nullable: true
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
      inverseSide: "Event",
      joinColumn: {
        name: "user_id",
        referencedColumnName: 'id',
        foreignKeyConstraintName: 'event_user_id_fk'
      }
    },
    Order: {
      type: "one-to-many",
      target: "Order",
      inverseSide: "Event"
    },
    Section: {
      type: "one-to-many",
      target: "Section",
      inverseSide: "Event"
    }
  }
});