const express = require('express');
const app = express();

app.post('/api/charge', (req, res) => {
    // Payment processing cascade that has a 10% chance of throwing a 500 error metric
    setTimeout(() => {
        if (Math.random() < 0.1) {
            console.error("Payment Gateway Error!");
            return res.status(500).json({ error: "Upstream Bank Gateway Timeout" });
        }
        res.json({ transaction: "txn_9999", status: "success" });
    }, Math.random() * 300 + 100);
});

app.listen(8082, () => console.log('Payment Service listening on 8082'));
