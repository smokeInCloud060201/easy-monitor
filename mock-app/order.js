const express = require('express');
const axios = require('axios');
const logger = require('./udp_logger');
const app = express();

app.post('/api/checkout', async (req, res) => {
    try {
        // Step 1: Validate items in Category Service
        await axios.get('http://localhost:8081/api/category/electronics');
        
        // Step 2: Attempt Charge in Payment Service
        const paymentRes = await axios.post('http://localhost:8082/api/charge');
        
        // Step 3: Complete Order structurally returning 200 OK
        setTimeout(() => {
            res.json({ order_id: "ord_front_123", payment: paymentRes.data });
        }, Math.random() * 50 + 10);
        
    } catch (err) {
        logger.error(`Checkout failed cascading backwards: ${err.message}`);
        res.status(500).json({ error: "Order Checkout failed due to cascading upstream services" });
    }
});

app.listen(8083, () => logger.info('Order Service natively spawned listening exclusively on 8083'));
