import pg from "pg";
const { Pool } = pg;
let pool;

export function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
    });
  }
  return pool;
}

export async function initDb() {
  const p = getPool();
  if (!p) return;
  await p.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id UUID PRIMARY KEY,
      nickname TEXT NOT NULL,
      age INTEGER NOT NULL CHECK (age >= 13 AND age <= 99),
      game TEXT NOT NULL CHECK (game IN ('lol','valorant','overwatch')),
      tier TEXT NOT NULL,
      riot_id TEXT,
      battletag TEXT,
      verified BOOLEAN NOT NULL DEFAULT FALSE,
      verification_source TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_profiles_match
      ON profiles(game, verified, age);
  `);
}

export async function addProfile(profile) {
  const p = getPool();
  if (!p) throw new Error("DATABASE_URL is not configured");
  await p.query(
    `INSERT INTO profiles
      (id,nickname,age,game,tier,riot_id,battletag,verified,verification_source)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [profile.id, profile.nickname, profile.age, profile.game, profile.tier,
     profile.riotId || null, profile.battleTag || null, !!profile.verified,
     profile.verificationSource || null]
  );
  return profile;
}

export async function findMatches({game, age, tierIndex, tierList, ageGap=2, tierGap=1}) {
  const p = getPool();
  if (!p) throw new Error("DATABASE_URL is not configured");
  const {rows} = await p.query(
    `SELECT id,nickname,age,game,tier FROM profiles
     WHERE game=$1 AND verified=true AND age BETWEEN $2 AND $3
     ORDER BY created_at DESC LIMIT 100`,
    [game, Math.max(13, age-ageGap), Math.min(99, age+ageGap)]
  );
  return rows
    .map(x => ({
      ...x,
      score: Math.max(0, 100
        - Math.abs(x.age-age)*20
        - Math.abs(tierList.indexOf(x.tier)-tierIndex)*20)
    }))
    .filter(x => Math.abs(tierList.indexOf(x.tier)-tierIndex) <= tierGap)
    .sort((a,b)=>b.score-a.score)
    .slice(0,20);
}

export async function listProfiles() {
  const p = getPool();
  if (!p) throw new Error("DATABASE_URL is not configured");
  const {rows} = await p.query(
    `SELECT id,nickname,age,game,tier,riot_id,battletag,verified,
            verification_source,created_at
     FROM profiles ORDER BY created_at DESC LIMIT 200`
  );
  return rows;
}

export async function setVerified(id, verified) {
  const p = getPool();
  if (!p) throw new Error("DATABASE_URL is not configured");
  await p.query(`UPDATE profiles SET verified=$2 WHERE id=$1`, [id, verified]);
}
