export async function verifyLoL(id) {
  const key = process.env.RIOT_API_KEY;
  if (!key) return {verified:false, message:"서버에 Riot API 키가 설정되지 않았습니다."};
  const [name, tag] = String(id || "").split("#");
  if (!name || !tag) return {verified:false, message:"Riot ID는 이름#태그 형식이어야 합니다."};
  const headers = {"X-Riot-Token": key};
  const region = process.env.RIOT_REGION || "asia";
  const platform = process.env.RIOT_PLATFORM || "kr";

  const accountRes = await fetch(
    `https://${region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
    {headers}
  );
  if (!accountRes.ok) return {verified:false, message:"Riot 계정을 찾지 못했습니다."};
  const account = await accountRes.json();

  const summonerRes = await fetch(
    `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(account.puuid)}`,
    {headers}
  );
  if (!summonerRes.ok) return {verified:false, message:"소환사 정보를 가져오지 못했습니다."};
  const summoner = await summonerRes.json();

  const leagueRes = await fetch(
    `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-summoner/${encodeURIComponent(summoner.id)}`,
    {headers}
  );
  if (!leagueRes.ok) return {verified:false, message:"랭크 정보를 가져오지 못했습니다."};
  const entries = await leagueRes.json();
  const solo = entries.find(x=>x.queueType==="RANKED_SOLO_5x5");
  if (!solo) return {verified:false, message:"솔로 랭크 기록이 없습니다."};

  return {
    verified:true,
    tier:`${solo.tier} ${solo.rank}`,
    riotId:`${name}#${tag}`,
    source:"riot-api"
  };
}
