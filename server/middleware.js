const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];

    const token = /^Bearer (\S+)$/i.exec(authHeader || '')?.[1];

    if (!token) {
        return res.status(401).json({
            error: 'Access denied. Please log in.'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(401).json({
                error: 'Invalid or expired token'
            });
        }

        req.user = user;
        next();
    });
}

module.exports = authenticateToken;