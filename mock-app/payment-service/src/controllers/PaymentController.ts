import { Request, Response } from "express";
import winston from "winston";
import { PaymentService } from "../services/PaymentService";

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

export class PaymentController {
    private service = new PaymentService();

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
            res.status(500).json({ error: 'Payment processing error', detail: err.message });
        }
    }

    async status(req: Request, res: Response) {
        try {
            const id = (req.params.id as string) || 'unknown';
            const result = await this.service.getStatus(id);
            if (result) {
                logger.info(`GET /api/payment/status/${id} - 200 OK cacheHit=${result.cacheHit}`);
                res.json(result);
            } else {
                logger.warn(`GET /api/payment/status/${id} - 404 NOT FOUND cacheHit=false`);
                res.status(404).json({ error: "Transaction not found" });
            }
        } catch (err: any) {
            logger.error(`GET /api/payment/status - exception: ${err.message}`);
            res.status(500).json({ error: err.message });
        }
    }
}
