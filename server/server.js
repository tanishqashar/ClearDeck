const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
if (!process.env.JWT_SECRET) throw new Error('Set JWT_SECRET in server/.env before starting.');
require('./db');

const express = require('express');
const cors = require('cors');


const app = express();
const authRoutes = require('./auth');
const boardRoutes = require('./boards');
const PORT = Number(process.env.PORT) || 5000;
const authenticateToken = require('./middleware');


app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method) &&
        (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))) {
        return res.status(400).json({ error: 'A JSON object body is required' });
    }
    next();
});
app.use('/api/auth', authRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api', require('./resources'));
app.get('/api/test-protected', authenticateToken, (req, res) => {
    res.json({
        message: 'You accessed a protected route!',
        user: req.user
    });
});
app.get('/', (req, res) => {
    res.send('TaskBoard backend is running!');
});

app.use((req, res) => res.status(404).json({ error: 'Endpoint not found' }));
app.use((err, req, res, next) => {
    const status = err.status >= 400 && err.status < 500 ? err.status : 500;
    res.status(status).json({ error: status === 500 ? 'Internal server error' : 'Invalid request body' });
});

if (require.main === module) app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
