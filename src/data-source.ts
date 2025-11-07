import  {DataSource, DataSourceOptions}from 'typeorm';
import { config } from 'dotenv';
import { User } from './entities/User';
import { Patient } from './entities/Patient';
import { RefreshToken } from './entities/RefreshToken';
import { Doctor } from './entities/Doctor';
config();
export const dataSourceOptions: DataSourceOptions = {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [User, Patient, Doctor, RefreshToken],
    migrations:[],
    logging:false,
    synchronize:false
}
const dataSource=new DataSource(dataSourceOptions);
export default dataSource;