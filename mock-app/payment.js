const express = require('express');
const axios = require('axios');
const winston = require('winston');
const { withSpan, dbQuery, cacheOp } = require('./tracing');
const logger = winston.createLogger({ format: winston.format.json(), transports: [new winston.transports.Console()] });
const app = express();
app.use(express.json());

app.post('/api/charge', async (req, res) => {
    logger.info('Processing payment charge...');
    
    try {
        // Step 1: Validate card details
        await withSpan('validate_card', {
            minMs: 10, maxMs: 30,
            errorRate: 0.05,
            attributes: { 'payment.card_type': 'visa', 'payment.last4': '4242' },
        });

        // Step 2: Fraud detection check
        await withSpan('fraud_check', {
            minMs: 30, maxMs: 120,
            errorRate: 0.03,
            attributes: { 'fraud.score': Math.random() * 100, 'fraud.provider': 'stripe_radar' },
        });

        // Step 3: Check for duplicate transactions
        await dbQuery('SELECT', 'transactions', {
            statement: "SELECT id FROM transactions WHERE idempotency_key = $1 AND created_at > now() - interval '5 minutes'",
            minMs: 8, maxMs: 25,
        });

        // Step 4: Process the charge
        const isSuccess = Math.random() > 0.15; // 85% success rate
        const txnId = 'txn_' + Date.now();

        if (isSuccess) {
            // Step 5: Record transaction in DB
            await dbQuery('INSERT', 'transactions', {
                statement: `INSERT INTO transactions (id, amount, status, card_last4) VALUES ('${txnId}', 149.99, 'completed', '4242')`,
                minMs: 10, maxMs: 35,
            });

            // Step 6: Update balance cache
            await cacheOp('SET', `balance:merchant_001`);

            // Step 7: Notify (calls notification-service)
            logger.info(`Payment ${txnId} approved`);
            try {
                await axios.post('http://localhost:8084/api/notify', {
                    status: 'success',
                    transaction_id: txnId,
                    message: `Payment completed for ${txnId}`,
                });
            } catch (notifyErr) {
                logger.warn(`Notification failed (non-critical): ${notifyErr.message}`);
            }

            res.json({ success: true, transaction_id: txnId });
        } else {
            // Record failed transaction
            await dbQuery('INSERT', 'transactions', {
                statement: `INSERT INTO transactions (id, amount, status) VALUES ('${txnId}', 149.99, 'declined')`,
                minMs: 8, maxMs: 20,
            });

            logger.warn(`Payment ${txnId} declined`);
            try {
                await axios.post('http://localhost:8084/api/notify', {
                    status: 'failed',
                    transaction_id: txnId,
                    message: `Payment declined for ${txnId}`,
                });
            } catch (notifyErr) {
                logger.warn(`Notification failed (non-critical): ${notifyErr.message}`);
            }

            res.status(400).json({ success: false, error: 'Payment declined' });
        }
    } catch (err) {
        logger.error(`Payment processing failed: ${err.message}`);
        res.status(500).json({ error: 'Payment processing error', detail: err.message });
    }
});

app.get('/api/payment/status/:id', async (req, res) => {
    try {
        // Cache check first
        const cached = await cacheOp('GET', `txn:${req.params.id}`);
        
        if (!cached.hit) {
            await dbQuery('SELECT', 'transactions', {
                statement: `SELECT * FROM transactions WHERE id = '${req.params.id}'`,
                minMs: 10, maxMs: 40,
            });
        }

        res.json({
            transaction_id: req.params.id,
            status: 'completed',
            amount: 149.99,
            created_at: new Date().toISOString(),
        });
    } catch (err) {
        res.status(500).json({ error: 'Status lookup failed' });
    }
});

app.listen(8082, () => {
    logger.info('Payment Service running on 8082');
});
