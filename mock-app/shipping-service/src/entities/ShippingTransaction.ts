import { Entity, PrimaryColumn, Column, CreateDateColumn } from "typeorm";

@Entity("shipping_transactions")
export class ShippingTransaction {
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
