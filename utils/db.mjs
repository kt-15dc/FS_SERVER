import pkg from 'pg';
const { Pool } = pkg;

const connectionPool = new Pool({
    connectionString:
    "postgresql://postgres.iyvawuqdeirkrxlfmqeo:FSBSV1234$@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
    
})

export default connectionPool;
