import pkg from 'pg';
const { Pool } = pkg;

const connectionPool = new Pool({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });

export default connectionPool;
