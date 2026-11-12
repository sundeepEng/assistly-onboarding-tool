exports.up = async knex => {
  await knex.schema.createTable('product_walkthrough', t => {
    t.string('user_id').notNullable(); t.string('home_id').notNullable();
    t.string('version').notNullable(); t.string('screen_id'); t.string('task_id');
    t.jsonb('viewed').notNullable().defaultTo('[]');
    t.jsonb('acknowledged').notNullable().defaultTo('[]');
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    t.primary(['user_id','home_id','version']);
  });
};
exports.down = knex => knex.schema.dropTableIfExists('product_walkthrough');
