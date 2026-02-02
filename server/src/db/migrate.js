import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { sequelize } from '../models/index.js';

async function migrate() {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    console.log('Sync complete.');
    process.exit(0);
  } catch (err) {
    console.error('Sync failed:', err.message);
    process.exit(1);
  }
}

migrate();
