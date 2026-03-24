import "reflect-metadata";
import { DataSource } from "typeorm";
import { ShippingTransaction } from "./entities/ShippingTransaction";

export const AppDataSource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5432,
    username: "easymonitor",
    password: "password",
    database: "easymonitor",
    synchronize: true,
    logging: false,
    entities: [ShippingTransaction],
    subscribers: [],
    migrations: [],
});
