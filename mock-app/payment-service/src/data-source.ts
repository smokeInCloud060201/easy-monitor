import "reflect-metadata";
import { DataSource } from "typeorm";
import { PaymentTransaction } from "./entities/PaymentTransaction";

export const AppDataSource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5432,
    username: "easymonitor",
    password: "password",
    database: "easymonitor",
    synchronize: true,
    logging: false,
    entities: [PaymentTransaction],
    subscribers: [],
    migrations: [],
});
