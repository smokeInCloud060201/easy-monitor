const express = require('express');
const axios = require('axios');
const winston = require('winston');
const { withSpan, dbQuery, cacheOp } = require('./tracing');
const logger = winston.createLogger({ format: winston.format.json(), transports: [new winston.transports.Console()] });
const app = express();
app.use(express.json());

app.post('/api/checkout', async (req, res) => {
    try {
        // Step 1: Validate cart items
        await withSpan('validate_cart', {
            minMs: 5, maxMs: 15,
            attributes: { 'cart.items': 3, 'cart.total': 149.99 },
        });

        // Step 2: Check category/stock via Category Service
        const categoryRes = await axios.get('http://localhost:8081/api/category/electronics');

        // Step 3: Check inventory in cache
        const cacheResult = await cacheOp('GET', 'inventory:electronics');
        if (!cacheResult.hit) {
            // Cache miss → query DB for inventory
            await dbQuery('SELECT', 'inventory', {
                statement: 'SELECT stock, reserved FROM inventory WHERE category_id = $1',
                minMs: 15, maxMs: 40,
            });
        }

        // Step 4: Attempt payment via Payment Service
        const paymentRes = await axios.post('http://localhost:8082/api/charge', {
            amount: 149.99,
            currency: 'USD',
        });

        // Step 5: Create order in DB
        const orderId = 'ord_' + Date.now();
        await dbQuery('INSERT', 'orders', {
            statement: `INSERT INTO orders (id, status, amount) VALUES ('${orderId}', 'completed', 149.99)`,
            minMs: 10, maxMs: 30,
        });

        // Step 6: Update inventory cache
        await cacheOp('SET', 'inventory:electronics');

        logger.info(`Order ${orderId} completed successfully`);
        res.json({
            order_id: orderId,
            status: 'completed',
            category: categoryRes.data,
            payment: paymentRes.data,
        });
    } catch (err) {
        logger.error(`Checkout failed: ${err.message}`);
        res.status(500).json({ error: 'Order checkout failed', detail: err.message });
    }
});

app.get('/api/orders/:id', async (req, res) => {
    try {
        // Cache lookup first
        const cacheResult = await cacheOp('GET', `order:${req.params.id}`);
        
        if (!cacheResult.hit) {
            // DB fallback
            await dbQuery('SELECT', 'orders', {
                statement: `SELECT * FROM orders WHERE id = '${req.params.id}'`,
                minMs: 10, maxMs: 40,
            });
        }

        res.json({
            id: req.params.id,
            status: 'completed',
            amount: 149.99,
            created_at: new Date().toISOString(),
        });
    } catch (err) {
        logger.error(`Order lookup failed: ${err.message}`);
        res.status(500).json({ error: 'Order lookup failed' });
    }
});

app.listen(8083, () => logger.info('Order Service running on 8083'));
