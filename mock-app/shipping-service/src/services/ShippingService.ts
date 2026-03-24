import { AppDataSource } from "../data-source";
import { ShippingTransaction } from "../entities/ShippingTransaction";
import { redisClient } from "../redis";

function randomMs(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class ShippingService {
    private repo = AppDataSource.getRepository(ShippingTransaction);

    async processCharge(orderId: string, amount: number): Promise<{ success: boolean; transaction_id?: string; error?: string; status?: string; amount?: number }> {
        const txnId = 'txn_' + Date.now();

        await sleep(randomMs(10, 30));
        if (Math.random() < 0.05) return { success: false, error: 'Card validation failed' };

        await sleep(randomMs(30, 120));
        if (Math.random() < 0.03) return { success: false, error: 'Flagged by fraud detection' };

        await sleep(randomMs(8, 25));

        const isSuccess = Math.random() > 0.15;
        if (isSuccess) {
            await sleep(randomMs(10, 35));
            
            const txn = new ShippingTransaction();
            txn.id = txnId;
            txn.order_id = orderId;
            txn.amount = amount;
            txn.status = "completed";
            await this.repo.save(txn);

            await redisClient.set(`shipping:${txnId}`, JSON.stringify(txn), "EX", 600);

            return { success: true, transaction_id: txnId, amount, status: 'completed' };
        } else {
            await sleep(randomMs(8, 20));
            
            const txn = new ShippingTransaction();
            txn.id = txnId;
            txn.order_id = orderId;
            txn.amount = amount;
            txn.status = "declined";
            await this.repo.save(txn);
            
            return { success: false, error: 'Shipping declined', transaction_id: txnId };
        }
    }

    async getStatus(txnId: string): Promise<{ transaction_id: string; status: string; amount: number; created_at: string; cacheHit: boolean } | null> {
        await sleep(randomMs(2, 5));
        
        const cached = await redisClient.get(`shipping:${txnId}`);
        if (cached) {
            const data = JSON.parse(cached);
            return {
                transaction_id: data.id,
                status: data.status,
                amount: data.amount,
                created_at: data.created_at,
                cacheHit: true
            };
        }

        await sleep(randomMs(10, 40));
        
        const txn = await this.repo.findOneBy({ id: txnId });
        if (txn) {
            await redisClient.set(`shipping:${txnId}`, JSON.stringify(txn), "EX", 600);
            return {
                transaction_id: txn.id,
                status: txn.status,
                amount: txn.amount,
                created_at: txn.created_at.toISOString(),
                cacheHit: false
            };
        }
        
        return null;
    }
}
