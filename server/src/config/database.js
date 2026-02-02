import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env from project root (server runs with cwd = server/, so root is ../../ from here)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const dbConfig = {
  dialect: 'postgres',
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  database: process.env.PG_DATABASE || 'costplans',
  username: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '',
  define: {
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
};
