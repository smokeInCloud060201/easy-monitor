const express = require('express');
const logger = require('./udp_logger');
const app = express();

app.post('/api/charge', (req, res) => {
    // Payment processing cascade that has a 10% chance of throwing a 500 error metric
    setTimeout(() => {
        if (Math.random() < 0.1) {
            logger.error("Payment Gateway Sync Error! Upstream 500 Threshold breached.");
            return res.status(500).json({ error: "Upstream Bank Gateway Timeout" });
        }
        res.json({ transaction: "txn_9999", status: "success" });
    }, Math.random() * 300 + 100);
});

app.listen(8082, () => logger.info('Payment Service spawned natively capturing payments on 8082'));
