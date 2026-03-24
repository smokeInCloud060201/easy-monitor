import { Entity, PrimaryColumn, Column, CreateDateColumn } from "typeorm";

@Entity("payment_transactions")
export class PaymentTransaction {
    @PrimaryColumn()
    id!: string;

    @Column()
    order_id!: string;

    @Column("decimal", { precision: 10, scale: 2 })
    amount!: number;

    @Column()
    status!: string;

    @CreateDateColumn()
    created_at!: Date;
}
