import 'reflect-metadata';
import express from 'express';
import winston from 'winston';
import { AppDataSource } from './data-source';
import { ShippingController } from './controllers/ShippingController';
import { redisClient } from './redis';

const app = express();
app.use(express.json());
const PORT = 8087;

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
        
        const shippingController = new ShippingController();

        app.post('/api/charge', (req, res) => shippingController.charge(req, res));
        app.get('/api/shipping/status/:id', (req, res) => shippingController.status(req, res));
        
        // REST Integration endpoint
        app.post('/api/shipping/allocate', (req, res) => {
            const orderId = req.body.orderId;
            logger.info(`REST Ingress: Received allocation request for order ${orderId}`);
            logger.info(`[SHIPPING] Allocating fulfillment routes for order ${orderId}`);
            res.json({ status: 'allocated', orderId });
        });
        
        app.get('/api/health', (req, res) => {
          res.json({ status: 'healthy', service: 'shipping-service (DDD)' });
        });

        app.listen(PORT, () => {
          logger.info(`Shipping Service (Express DDD) running on :${PORT}`);
        });

    } catch (err) {
        logger.error("Error during Data Source initialization", err);
        process.exit(1);
    }
}

bootstrap();
