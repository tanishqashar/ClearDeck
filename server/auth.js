
const express = require('express');
const bcrypt = require('bcrypt');
const db = require('./db');

const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || typeof password !== 'string') {
            return res.status(400).json({
                error: 'Name, email and password are required'
            });
        }

        if (password.length < 8 || Buffer.byteLength(password) > 72) {
            return res.status(400).json({
                error: 'Password must be at least 8 characters and at most 72 bytes'
            });
        }

        const existingUser = db.prepare(
            'SELECT id FROM users WHERE email = ?'
        ).get(email.trim().toLowerCase());

        if (existingUser) {
            return res.status(409).json({
                error: 'Email is already registered'
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = db.prepare(
            'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)'
        ).run(name.trim(), email.trim().toLowerCase(), passwordHash);

        return res.status(201).json({
            message: 'User registered successfully',
            userId: result.lastInsertRowid
        });
    } catch (error) {
        console.error('Registration error:', error);

        return res.status(500).json({
            error: 'Something went wrong during registration'
        });
    }
});

// Login an existing user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check required fields
        if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
            return res.status(400).json({
                error: 'Email and password are required'
            });
        }

        // Find the user by email
        const user = db.prepare(
            'SELECT * FROM users WHERE email = ?'
        ).get(email.trim().toLowerCase());

        if (!user) {
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        // Compare the entered password with the stored hash
        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        // Create a JWT token
        const jwt = require('jsonwebtoken');

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                error: 'JWT secret is not configured'
            });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Send the token and user details
        return res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Login error:', error);

        return res.status(500).json({
            error: 'Something went wrong during login'
        });
    }
});

module.exports = router;
