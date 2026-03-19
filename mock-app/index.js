const express = require('express');
const app = express();

app.get('/api/users', (req, res) => {
    // Fast simulated user fetch (10-60ms)
    setTimeout(() => res.json({ status: "ok" }), Math.random() * 50 + 10);
});

app.post('/api/checkout', (req, res) => {
    // Simulated DB Failure chance of 15% to trigger the red Dashboard Metric colors!
    if (Math.random() < 0.15) {
       return res.status(500).json({ error: "Payment Gateway Timeout" });
    }
    // Deeply variable latency (20-300ms)
    setTimeout(() => res.json({ status: "success" }), Math.random() * 280 + 20);
});

app.listen(8080, () => {
    console.log('Mock app running on 8080');
    
    // Simulate relentless customer traffic immediately locally
    setInterval(() => {
        require('http').get('http://localhost:8080/api/users').on('error', () => {});
        
        if (Math.random() > 0.4) {
            require('http').request({ method: 'POST', host: 'localhost', port: 8080, path: '/api/checkout' })
              .on('error', () => {}).end();
        }
    }, 1000); // Sends continuous trace pipelines!
});
