import "dotenv/config";
import express from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initDb, addProfile, findMatches, listProfiles, setVerified, createUser, findUserByLogin, findUserById } from "./db.js";
import { verifyLoL } from "./riot.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));

const PgSession = connectPg(session);
if (process.env.DATABASE_URL) {
  app.use(session({
    store: new PgSession({ conString: process.env.DATABASE_URL, createTableIfMissing: true, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false }),
    secret: process.env.SESSION_SECRET || "change-me",
    resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 1000 * 60 * 60 * 24 * 7 }
  }));
} else {
  app.use(session({ secret: process.env.SESSION_SECRET || "dev-only-secret", resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: "lax" } }));
}
app.use(express.static(path.join(__dirname, "../public")));

const tierLists = {
  lol:["아이언","브론즈","실버","골드","플래티넘","에메랄드","다이아몬드","마스터","그랜드마스터","챌린저"],
  valorant:["아이언","브론즈","실버","골드","플래티넘","다이아몬드","초월자","불멸","레디언트"],
  overwatch:["브론즈","실버","골드","플래티넘","다이아몬드","마스터","그랜드마스터","챔피언"]
};
const validAge = age => Number.isInteger(age) && age >= 13 && age <= 99;
const clean = (v, n=100) => String(v ?? "").trim().slice(0,n);
function admin(req,res,next){ if(!process.env.ADMIN_KEY || req.headers["x-admin-key"]!==process.env.ADMIN_KEY) return res.status(401).json({message:"관리자 인증이 필요합니다."}); next(); }

/* 회원가입 */
app.post("/api/auth/signup", async (req,res)=>{
  try {
    const username=clean(req.body?.username,30), email=clean(req.body?.email,120).toLowerCase(), password=String(req.body?.password??"");
    if(!/^[A-Za-z0-9가-힣_]{2,30}$/.test(username)) return res.status(400).json({message:"아이디는 2~30자의 한글/영문/숫자/_만 사용할 수 있습니다."});
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({message:"이메일 형식이 올바르지 않습니다."});
    if(password.length<8 || password.length>128) return res.status(400).json({message:"비밀번호는 8~128자로 입력해주세요."});
    const user=await createUser({username,email,password});
    req.session.userId=user.id; req.session.username=user.username;
    res.status(201).json({ok:true,user:{id:user.id,username:user.username,email:user.email}});
  } catch(e) { console.error(e); if(e.code==="23505") return res.status(409).json({message:"이미 사용 중인 아이디 또는 이메일입니다."}); res.status(500).json({message:"회원가입 중 서버 오류가 발생했습니다."}); }
});

/* 로그인 */
app.post("/api/auth/login", async (req,res)=>{
  try {
    const login=clean(req.body?.login,120), password=String(req.body?.password??"");
    if(!login||!password) return res.status(400).json({message:"아이디/이메일과 비밀번호를 입력해주세요."});
    const user=await findUserByLogin(login,password);
    if(!user) return res.status(401).json({message:"아이디 또는 비밀번호가 올바르지 않습니다."});
    req.session.userId=user.id; req.session.username=user.username;
    res.json({ok:true,user:{id:user.id,username:user.username,email:user.email}});
  } catch(e) { console.error(e); res.status(500).json({message:"로그인 중 서버 오류가 발생했습니다."}); }
});
app.post("/api/auth/logout",(req,res)=>req.session.destroy(err=>{if(err)return res.status(500).json({message:"로그아웃에 실패했습니다."});res.clearCookie("connect.sid");res.json({ok:true});}));
app.get("/api/auth/me",async(req,res)=>{
  try {
    if(!req.session.userId) return res.json({loggedIn:false});
    const user=await findUserById(req.session.userId);
    if(!user){req.session.destroy(()=>{});return res.json({loggedIn:false});}
    res.json({loggedIn:true,user:{id:user.id,username:user.username,email:user.email}});
  } catch(e){console.error(e);res.status(500).json({message:"로그인 상태 확인에 실패했습니다."});}
});

/* 기존 기능 */
app.post("/api/verify/lol",async(req,res)=>{try{res.json(await verifyLoL(req.body?.riotId));}catch(e){console.error(e);res.status(500).json({verified:false,message:"Riot API 처리 중 오류가 발생했습니다."});}});
app.get("/auth/riot/login",(req,res)=>{
  const clientId=process.env.RIOT_RSO_CLIENT_ID, redirectUri=process.env.RIOT_RSO_REDIRECT_URI;
  if(!clientId||!redirectUri)return res.status(503).send("Riot RSO 설정이 완료되지 않았습니다.");
  const state=crypto.randomBytes(24).toString("hex"); req.session.riotState=state;
  const p=new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:"code",scope:"openid offline_access",state});
  res.redirect("https://auth.riotgames.com/authorize?"+p.toString());
});
app.get("/auth/riot/callback",async(req,res)=>{if(!req.query.code||!req.query.state||req.query.state!==req.session.riotState)return res.status(400).send("Riot 로그인 요청이 유효하지 않습니다.");delete req.session.riotState;res.redirect("/?riot=connected");});

app.post("/api/profiles",async(req,res)=>{
  try{
    const {nickname,age,game,tier,riotId,battleTag,verified,verificationSource}=req.body||{};
    if(!nickname||!validAge(Number(age))||!tierLists[game]||!tier)return res.status(400).json({message:"닉네임, 나이, 게임, 티어를 확인해주세요."});
    if(!["lol","valorant","overwatch"].includes(game))return res.status(400).json({message:"지원하지 않는 게임입니다."});
    const profile={id:crypto.randomUUID(),userId:req.session.userId||null,nickname:clean(nickname,30),age:Number(age),game,tier:clean(tier,40),riotId:clean(riotId,120),battleTag:clean(battleTag,120),verified:Boolean(verified),verificationSource:clean(verificationSource,60)};
    await addProfile(profile);res.json({ok:true,id:profile.id});
  }catch(e){console.error(e);res.status(500).json({message:"프로필 저장에 실패했습니다. DATABASE_URL을 확인해주세요."});}
});
app.post("/api/matches",async(req,res)=>{
  try{
    const {game,age,tier,ageGap=2,tierGap=1}=req.body||{};
    if(!tierLists[game]||!validAge(Number(age)))return res.status(400).json({message:"매칭 조건이 올바르지 않습니다."});
    const list=await findMatches({game,age:Number(age),tierIndex:tierLists[game].indexOf(tier),tierList:tierLists[game],ageGap:Number(ageGap),tierGap:Number(tierGap)});
    res.json({matches:list});
  }catch(e){console.error(e);res.status(500).json({message:"매칭 서버 오류입니다."});}
});
app.get("/api/admin/profiles",admin,async(req,res)=>{try{res.json(await listProfiles());}catch(e){res.status(500).json({message:"DB 오류"});}});
app.post("/api/admin/profiles/:id/approve",admin,async(req,res)=>{try{await setVerified(req.params.id,true);res.json({ok:true});}catch(e){res.status(500).json({message:"DB 오류"});}});
app.post("/api/admin/profiles/:id/reject",admin,async(req,res)=>{try{await setVerified(req.params.id,false);res.json({ok:true});}catch(e){res.status(500).json({message:"DB 오류"});}});
app.get("/api/health",async(req,res)=>res.json({ok:true,database:Boolean(process.env.DATABASE_URL)}));

initDb().then(()=>app.listen(port,()=>console.log(`GameMatch running on port ${port}`))).catch(e=>{console.error("Database initialization failed:",e);process.exit(1);});
