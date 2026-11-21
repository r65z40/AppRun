import pg from 'pg';

// DATABASE_URL : chaîne de connexion Postgres de Supabase (Project Settings > Database).
// Ne jamais la mettre dans le code : variable d'environnement ou secret GitHub.
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquante.');
  process.exit(1);
}
export const pool = new pg.Pool({ connectionString: url, max: 6, ssl: /localhost|127\.0\.0\.1|host=\/|@\//.test(url) ? undefined : { rejectUnauthorized: false } });

export async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool.query(sql, params);
  return r.rows as T[];
}
