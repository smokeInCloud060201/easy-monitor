import 'reflect-metadata';
import express from 'express';
import winston from 'winston';
import { AppDataSource } from './data-source';
import { PaymentController } from './controllers/PaymentController';

const app = express();
app.use(express.json());
const PORT = 8082;

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console()
  ]
});

export async function bootstrap() {
    try {
        await AppDataSource.initialize();
        logger.info("Data Source has been initialized!");
        
        const paymentController = new PaymentController();

        app.post('/api/charge', (req, res) => paymentController.charge(req, res));
        app.get('/api/payment/status/:id', (req, res) => paymentController.status(req, res));
        
        app.get('/api/health', (req, res) => {
          res.json({ status: 'healthy', service: 'payment-service (DDD)' });
        });

        app.listen(PORT, () => {
          logger.info(`Payment Service (Express DDD) running on :${PORT}`);
        });

    } catch (err) {
        logger.error("Error during Data Source initialization", err);
        process.exit(1);
    }
}

bootstrap();
