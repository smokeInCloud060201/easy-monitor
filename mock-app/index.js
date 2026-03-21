const express = require('express');
const axios = require('axios');
const { withSpan, dbQuery, cacheOp } = require('./tracing');
const app = express();

// API Gateway - routes traffic to downstream services
app.get('/api/users', async (req, res) => {
    try {
        // Step 1: Validate auth token
        await withSpan('validate_auth_token', {
            minMs: 3, maxMs: 10,
            attributes: { 'auth.method': 'jwt' },
        });

        // Step 2: Check user cache
        const cached = await cacheOp('GET', 'user:current');

        if (!cached.hit) {
            // Step 3: DB lookup on cache miss
            await dbQuery('SELECT', 'users', {
                statement: 'SELECT id, name, email, role FROM users WHERE id = $1',
                minMs: 15, maxMs: 50,
            });

            // Step 4: Warm cache
            await cacheOp('SET', 'user:current');
        }

        // Step 5: Fetch user preferences
        await dbQuery('SELECT', 'user_preferences', {
            statement: 'SELECT * FROM user_preferences WHERE user_id = $1',
            minMs: 8, maxMs: 30,
        });

        res.json({
            id: 'usr_001',
            name: 'John Doe',
            email: 'john@example.com',
            preferences: { theme: 'dark', notifications: true },
        });
    } catch (err) {
        res.status(500).json({ error: 'User fetch failed' });
    }
});

app.post('/api/checkout', async (req, res) => {
    try {
        // Gateway routes to order-service
        const response = await axios.post('http://localhost:8083/api/checkout', {
            items: [{ id: 'item_1', qty: 2 }],
        });
        res.json(response.data);
    } catch (err) {
        const status = err.response?.status || 500;
        res.status(status).json(err.response?.data || { error: 'Checkout failed' });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', services: ['order', 'category', 'payment', 'notification'] });
});

app.listen(8080, () => {
    console.log('API Gateway running on 8080');

    // Simulate varied customer traffic
    setInterval(() => {
        // User lookups (frequent)
        require('http').get('http://localhost:8080/api/users').on('error', () => {});

        // Checkout flow (60% of ticks)
        if (Math.random() > 0.4) {
            require('http').request({
                method: 'POST', host: 'localhost', port: 8080, path: '/api/checkout',
                headers: { 'Content-Type': 'application/json' },
            }).on('error', () => {}).end(JSON.stringify({ items: [{ id: 'item_1' }] }));
        }
    }, 2000);
});
