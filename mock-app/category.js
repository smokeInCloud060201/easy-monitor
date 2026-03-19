const express = require('express');
const winston = require('winston');
const logger = winston.createLogger({ format: winston.format.json(), transports: [new winston.transports.Console()] });
const app = express();

app.get('/api/category/:id', (req, res) => {
    // Fast mock DB lookup
    setTimeout(() => res.json({ id: req.params.id, name: 'Premium Electronics', stock: 150 }), Math.random() * 20 + 5);
});

app.listen(8081, () => logger.info('Category Service spawned actively parsing endpoints on 8081'));
