import 'reflect-metadata';
import express from 'express';
import winston from 'winston';
import { AppDataSource } from './data-source';
import { ShippingController } from './controllers/ShippingController';

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
        
        // Mock SAGA Event Listener
        import { redisClient } from './redis';
        const subscriber = redisClient.duplicate();
        await subscriber.subscribe('payment.events');
        subscriber.on('message', (channel, message) => {
            const data = JSON.parse(message);
            logger.info(`Saga Subscribed: Received event ${data.event} for order ${data.orderId}`);
            if (data.event === 'payment.succeeded') {
                logger.info(`[SHIPPING] Allocating fulfillment routes for order ${data.orderId}`);
            }
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
