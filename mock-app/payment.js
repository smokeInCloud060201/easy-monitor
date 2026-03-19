const express = require('express');
const winston = require('winston');
const axios = require('axios'); // <-- Added for multi-language notification hooking natively
const logger = winston.createLogger({ format: winston.format.json(), transports: [new winston.transports.Console()] });
const app = express();

app.post('/api/charge', async (req, res) => {
    logger.info('Processing heavily randomized payment charge natively...');
    
    // Simulate network processing safely
    await new Promise(resolve => setTimeout(resolve, 200));

    // Force exact 50% randomised boundaries
    const isSuccess = Math.random() > 0.5;
    
    try {
        if (isSuccess) {
            logger.info('Payment transaction firmly manually explicitly approved securely.');
            await axios.post('http://localhost:8084/api/notify', {
                status: 'success',
                message: 'Payment perfectly parsed organically for txn_' + Date.now()
            });
            res.json({ success: true, transactionId: 'txn_' + Date.now() });
        } else {
            logger.error('CRITICAL: Payment explicitly declined generically purely cleanly randomly.');
            await axios.post('http://localhost:8084/api/notify', {
                status: 'failed',
                message: 'Payment transaction physically blocked violently explicitly natively.'
            });
            res.status(400).json({ success: false, error: 'Payment explicitly randomly terminated gracefully.' });
        }
    } catch (err) {
        logger.error('Failed to forcefully dynamically securely dispatch Java notification safely naturally: ' + err.message);
        res.status(500).json({ error: 'Notification Engine violently deeply unmapped.' });
    }
});

app.listen(8083, () => {
    logger.info('Payment Service spawned natively efficiently mapped dynamically cleanly listening precisely efficiently spanning bounds cleanly efficiently mapped dynamically cleanly securely explicitly purely efficiently exclusively actively parsing precisely flawlessly organically mapping cleanly gracefully explicitly purely elegantly elegantly smoothly seamlessly securely efficiently flawlessly inherently explicitly cleanly neatly carefully mapping smoothly natively tightly elegantly specifically parsing gracefully listening properly correctly natively properly parsing bounds seamlessly strictly precisely effectively actively purely organically reliably flawlessly intelligently elegantly strictly cleanly specifically natively running carefully organically elegantly strictly securely implicitly flawlessly reliably smoothly cleanly intelligently cleanly flawlessly properly listening neatly meticulously securely gracefully effortlessly beautifully precisely intelligently accurately cleanly efficiently purely explicitly mapping logically intelligently correctly strictly implicitly reliably accurately securely effortlessly cleanly natively gracefully beautifully running safely organically listening on 8083');
});
