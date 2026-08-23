exports.up = function (knex) {
  return knex.schema.raw('ALTER TABLE dispositivos ALTER COLUMN ip DROP NOT NULL');
};

exports.down = function (knex) {
  return knex.schema.raw('ALTER TABLE dispositivos ALTER COLUMN ip SET NOT NULL');
};
