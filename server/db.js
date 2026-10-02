import pg from "pg";
import crypto from "node:crypto";

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

function hashPassword(password,salt=crypto.randomBytes(16).toString("hex")){
  return new Promise((resolve,reject)=>crypto.scrypt(password,salt,64,(e,key)=>e?reject(e):resolve(`${salt}:${key.toString("hex")}`)));
}
function checkPassword(password,stored){
  return new Promise(resolve=>{
    try{
      const [salt,hex]=String(stored).split(":"); if(!salt||!hex)return resolve(false);
      crypto.scrypt(password,salt,64,(e,key)=>{
        if(e)return resolve(false);
        const expected=Buffer.from(hex,"hex");
        resolve(expected.length===key.length && crypto.timingSafeEqual(expected,key));
      });
    }catch{resolve(false);}
  });
}

export async function initDb(){
  if(!process.env.DATABASE_URL){console.warn("DATABASE_URL이 없어 DB 초기화를 건너뜁니다.");return;}
  await pool.query(`CREATE TABLE IF NOT EXISTS users(
    id UUID PRIMARY KEY, username VARCHAR(30) NOT NULL UNIQUE, email VARCHAR(120) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS profiles(
    id UUID PRIMARY KEY, user_id UUID, nickname VARCHAR(30) NOT NULL, age INTEGER NOT NULL,
    game VARCHAR(20) NOT NULL, tier VARCHAR(40) NOT NULL, riot_id VARCHAR(120),
    battle_tag VARCHAR(120), verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_source VARCHAR(60), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_id UUID`);
}

export async function createUser({username,email,password}){
  const hash=await hashPassword(password), id=crypto.randomUUID();
  const r=await pool.query(`INSERT INTO users(id,username,email,password_hash) VALUES($1,$2,$3,$4) RETURNING id,username,email,created_at`,[id,username,email,hash]);
  return r.rows[0];
}
export async function findUserByLogin(login,password){
  const r=await pool.query(`SELECT id,username,email,password_hash FROM users WHERE LOWER(username)=LOWER($1) OR LOWER(email)=LOWER($1) LIMIT 1`,[login]);
  const u=r.rows[0]; if(!u||!(await checkPassword(password,u.password_hash)))return null;
  return {id:u.id,username:u.username,email:u.email};
}
export async function findUserById(id){
  const r=await pool.query(`SELECT id,username,email FROM users WHERE id=$1 LIMIT 1`,[id]);
  return r.rows[0]||null;
}
export async function addProfile(p){
  const r=await pool.query(`INSERT INTO profiles(id,user_id,nickname,age,game,tier,riot_id,battle_tag,verified,verification_source)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [p.id,p.userId||null,p.nickname,p.age,p.game,p.tier,p.riotId||null,p.battleTag||null,Boolean(p.verified),p.verificationSource||null]);
  return r.rows[0];
}
export async function listProfiles(){
  const r=await pool.query(`SELECT * FROM profiles ORDER BY created_at DESC`); return r.rows;
}
export async function setVerified(id,verified){
  const r=await pool.query(`UPDATE profiles SET verified=$1 WHERE id=$2 RETURNING *`,[verified,id]); return r.rows[0]||null;
}
export async function findMatches({game,age,tierIndex,tierList,ageGap=2,tierGap=1}){
  const r=await pool.query(`SELECT * FROM profiles WHERE game=$1 AND ABS(age-$2)<=$3 AND verified=TRUE ORDER BY created_at DESC`,[game,age,ageGap]);
  return r.rows.filter(p=>{const i=tierList.indexOf(p.tier);return tierIndex>=0&&i>=0&&Math.abs(i-tierIndex)<=tierGap;});
}
