
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database(process.env.DB_PATH || path.join(__dirname, 'taskboard.db'));

db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(
    path.join(__dirname, 'schema.sql'),
    'utf8'
);

db.exec(schema);

console.log('Database connected and tables created!');

module.exports = db;
