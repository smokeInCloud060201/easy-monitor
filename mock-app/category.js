const express = require('express');
const app = express();

app.get('/api/category/:id', (req, res) => {
    // Fast mock DB lookup
    setTimeout(() => res.json({ id: req.params.id, name: 'Premium Electronics', stock: 150 }), Math.random() * 20 + 5);
});

app.listen(8081, () => console.log('Category Service listening on 8081'));
