import express from 'express';

const app = express();
app.use(express.json());
const PORT = 8082;

function randomMs(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// POST /api/charge
app.post('/api/charge', async (req, res) => {
  const startTime = Date.now();
  try {
    const body = req.body || {};
    const txnId = 'txn_' + Date.now();
    console.log(`[INFO] POST /api/charge - order=${body.order_id || 'unknown'} amount=${body.amount || 149.99} started`);

    // Step 1: Validate card
    await sleep(randomMs(10, 30));
    if (Math.random() < 0.05) {
      console.log(`[ERROR] POST /api/charge - card validation FAILED took=${Date.now() - startTime}ms`);
      res.status(400).json({ success: false, error: 'Card validation failed' });
      return;
    }

    // Step 2: Fraud detection
    const fraudScore = Math.random() * 100;
    await sleep(randomMs(30, 120));
    if (Math.random() < 0.03) {
      console.log(`[WARN] POST /api/charge - fraud detected score=${fraudScore.toFixed(1)} took=${Date.now() - startTime}ms`);
      res.status(400).json({ success: false, error: 'Flagged by fraud detection' });
      return;
    }

    // Step 3: Check duplicate transactions
    await sleep(randomMs(8, 25));

    // Step 4: Process charge
    const isSuccess = Math.random() > 0.15;
    if (isSuccess) {
      await sleep(randomMs(10, 35));
      console.log(`[INFO] POST /api/charge - COMPLETED txn=${txnId} amount=${body.amount || 149.99} took=${Date.now() - startTime}ms`);
      res.json({ success: true, transaction_id: txnId, amount: body.amount || 149.99, status: 'completed' });
    } else {
      await sleep(randomMs(8, 20));
      console.log(`[WARN] POST /api/charge - DECLINED txn=${txnId} took=${Date.now() - startTime}ms`);
      res.status(400).json({ success: false, error: 'Payment declined', transaction_id: txnId });
    }
  } catch (err: any) {
    console.log(`[ERROR] POST /api/charge - exception: ${err.message} took=${Date.now() - startTime}ms`);
    res.status(500).json({ error: 'Payment processing error', detail: err.message });
  }
});

// GET /api/payment/status/:id
app.get('/api/payment/status/:id', async (req, res) => {
  try {
    const id = req.params.id || 'unknown';
    const cacheHit = Math.random() < 0.7;
    await sleep(cacheHit ? randomMs(1, 5) : randomMs(2, 8));
    if (!cacheHit) {
      await sleep(randomMs(10, 40));
    }
    console.log(`[INFO] GET /api/payment/status/${id} - 200 OK cacheHit=${cacheHit}`);
    res.json({ transaction_id: id, status: 'completed', amount: 149.99, created_at: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', service: 'payment-service' });
});

app.listen(PORT, () => {
  console.log(`Payment Service (Express) running on :${PORT}`);
});
