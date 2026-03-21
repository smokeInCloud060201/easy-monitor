const express = require('express');
const winston = require('winston');
const { dbQuery, cacheOp, withSpan } = require('./tracing');
const logger = winston.createLogger({ format: winston.format.json(), transports: [new winston.transports.Console()] });
const app = express();

const CATEGORIES = {
    electronics: { id: 'electronics', name: 'Premium Electronics', stock: 150, price_range: '$50-$2000' },
    clothing: { id: 'clothing', name: 'Designer Clothing', stock: 320, price_range: '$20-$500' },
    books: { id: 'books', name: 'Books & Media', stock: 890, price_range: '$5-$100' },
    home: { id: 'home', name: 'Home & Garden', stock: 210, price_range: '$10-$800' },
};

app.get('/api/category/:id', async (req, res) => {
    try {
        const categoryId = req.params.id;
        
        // Step 1: Check cache first
        const cacheResult = await cacheOp('GET', `category:${categoryId}`);
        
        let category;
        if (cacheResult.hit) {
            category = CATEGORIES[categoryId] || CATEGORIES.electronics;
        } else {
            // Step 2: DB lookup on cache miss
            await dbQuery('SELECT', 'categories', {
                statement: `SELECT * FROM categories WHERE id = '${categoryId}'`,
                minMs: 15, maxMs: 60,
            });
            category = CATEGORIES[categoryId] || CATEGORIES.electronics;
            
            // Step 3: Warm cache
            await cacheOp('SET', `category:${categoryId}`);
        }

        // Step 4: Load related products
        await dbQuery('SELECT', 'products', {
            statement: `SELECT id, name, price FROM products WHERE category_id = '${categoryId}' LIMIT 10`,
            minMs: 20, maxMs: 70,
        });

        res.json({ ...category, product_count: Math.floor(Math.random() * 50) + 10 });
    } catch (err) {
        logger.error(`Category fetch failed: ${err.message}`);
        res.status(500).json({ error: 'Category lookup failed' });
    }
});

app.get('/api/category/search', async (req, res) => {
    try {
        // Full-text search simulation
        await withSpan('parse_search_query', { minMs: 2, maxMs: 8 });
        
        await dbQuery('SELECT', 'categories', {
            statement: "SELECT * FROM categories WHERE name ILIKE '%electronics%' ORDER BY relevance DESC LIMIT 20",
            minMs: 30, maxMs: 100,
        });

        res.json({ results: Object.values(CATEGORIES), total: 4 });
    } catch (err) {
        logger.error(`Category search failed: ${err.message}`);
        res.status(500).json({ error: 'Search failed' });
    }
});

app.listen(8081, () => logger.info('Category Service running on 8081'));
