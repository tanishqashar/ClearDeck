const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const target = process.env.DB_PATH || path.join(__dirname, 'taskboard.db');
// Check before loading db.js. Never overwrite or merge demo rows into user data.
if (target === ':memory:' || fs.existsSync(target)) {
    console.error('Seed refused: target already exists or is not a new file. Choose a NEW DB_PATH for demo data.');
    process.exitCode = 1;
} else {
    const db = require('./db');
    try {
        db.exec(fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8'));
        console.log('Demo created: 2 users, 1 board, 3 columns, 8 tasks. See README for sample credentials.');
    } finally { db.close(); }
}
