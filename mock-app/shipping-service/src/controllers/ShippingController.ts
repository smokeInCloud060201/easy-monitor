import { Request, Response } from "express";
import winston from "winston";
import { ShippingService } from "../services/ShippingService";

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

export class ShippingController {
    private service = new ShippingService();

    async charge(req: Request, res: Response) {
        const startTime = Date.now();
        try {
            const body = req.body || {};
            const orderId = body.order_id || 'unknown';
            const amount = body.amount || 149.99;
            logger.info(`POST /api/charge - order=${orderId} amount=${amount} started`);

            const result = await this.service.processCharge(orderId, amount);

            if (result.success) {
                logger.info(`POST /api/charge - COMPLETED txn=${result.transaction_id} amount=${amount} took=${Date.now() - startTime}ms`);
                res.json(result);
            } else {
                logger.warn(`POST /api/charge - DECLINED txn=${result.transaction_id || 'none'} took=${Date.now() - startTime}ms`);
                res.status(400).json(result);
            }
        } catch (err: any) {
            logger.error(`POST /api/charge - exception: ${err.message} took=${Date.now() - startTime}ms`);
            res.status(500).json({ error: 'Shipping processing error', detail: err.message });
        }
    }

    async status(req: Request, res: Response) {
        try {
            const orderId = (req.params.id as string) || 'unknown';
            
            // Simulate realistic latency
            await new Promise(resolve => setTimeout(resolve, Math.random() * 20 + 5));

            // Dynamic 15% failure rate for realistic pass/fail APM error tracking
            const isSuccess = Math.random() > 0.15;
            
            if (isSuccess) {
                logger.info(`GET /api/shipping/status/${orderId} - 200 OK cacheHit=false`);
                res.json({
                    transaction_id: `shp_${Math.floor(Math.random() * 100000)}`,
                    status: 'allocated',
                    carrier: ['fedex', 'ups', 'usps'][Math.floor(Math.random() * 3)],
                    tracking_number: `1Z99999999${Math.floor(Math.random() * 10000000)}`,
                    created_at: new Date().toISOString(),
                    cacheHit: false
                });
            } else {
                logger.warn(`GET /api/shipping/status/${orderId} - 404 NOT FOUND cacheHit=false`);
                res.status(404).json({ error: "Shipping allocation pending or failed" });
            }
        } catch (err: any) {
            logger.error(`GET /api/shipping/status - exception: ${err.message}`);
            res.status(500).json({ error: err.message });
        }
    }
}
