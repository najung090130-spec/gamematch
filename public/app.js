const game = document.getElementById("game");
const statusBox = document.getElementById("verifyStatus");

let verifiedInfo = null;

const tiers = {
  lol: ["아이언","브론즈","실버","골드","플래티넘","에메랄드","다이아몬드","마스터","그랜드마스터","챌린저"],
  valorant: ["아이언","브론즈","실버","골드","플래티넘","다이아몬드","초월자","불멸","레디언트"],
  overwatch: ["브론즈","실버","골드","플래티넘","다이아몬드","마스터","그랜드마스터","챔피언"]
};

function setStatus(text, color = "") {
  if (!statusBox) return;
  statusBox.className = "status" + (color ? " " + color : "");
  statusBox.textContent = text;
}

/* =========================
   게임 선택 / 인증
========================= */

function selectGame(g) {
  if (!game) return;

  game.value = g;
  game.dispatchEvent(new Event("change"));

  document.getElementById("verify")?.scrollIntoView({
    behavior: "smooth"
  });
}

game?.addEventListener("change", () => {
  document.getElementById("lolVerify")
    ?.classList.toggle("hidden", game.value !== "lol");

  document.getElementById("valVerify")
    ?.classList.toggle("hidden", game.value !== "valorant");

  document.getElementById("owVerify")
    ?.classList.toggle("hidden", game.value !== "overwatch");

  setStatus("인증 전");
});

async function verifyLol() {
  const id = document.getElementById("riotId")?.value.trim();

  if (!id?.includes("#")) {
    return setStatus(
      "Riot ID를 이름#태그 형식으로 입력해주세요.",
      "warn"
    );
  }

  setStatus("Riot API에서 확인하는 중...");

  try {
    const r = await fetch("/api/verify/lol", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        riotId: id
      })
    });

    const d = await r.json();

    if (d.verified) {
      verifiedInfo = {
        game: "lol",
        tier: d.tier.split(" ")[0],
        riotId: d.riotId,
        verified: true,
        source: d.source
      };

      setStatus("✅ " + d.tier + " 인증 완료", "ok");
    } else {
      setStatus("⚠️ " + d.message, "warn");
    }

  } catch (e) {
    setStatus("서버 연결에 실패했습니다.", "warn");
  }
}

function connectValorant() {
  location.href = "/auth/riot/login";
}

/* Overwatch */
function verifyOw() {
  const battleTag =
    document.getElementById("battleTag")?.value.trim();

  if (!battleTag?.includes("#")) {
    return setStatus(
      "BattleTag를 이름#1234 형식으로 입력해주세요.",
      "warn"
    );
  }

  verifiedInfo = {
    game: "overwatch",
    tier: "골드",
    battleTag,
    verified: false,
    source: "manual-battletag"
  };

  setStatus(
    "BattleTag 입력 완료. 관리자 검수가 필요합니다.",
    "warn"
  );
}

/* index.html에서 submitOw()를 호출하고 있으므로 연결 */
function submitOw() {
  verifyOw();
}

async function registerProfile() {
  if (!verifiedInfo) {
    return alert("먼저 게임 인증을 완료해주세요.");
  }

  const nickname = prompt(
    "매칭에 표시할 닉네임을 입력하세요."
  );

  const age = Number(
    prompt("나이를 입력하세요.")
  );

  if (
    !nickname ||
    !Number.isInteger(age) ||
    age < 13 ||
    age > 99
  ) {
    return alert(
      "닉네임과 13~99세 사이의 나이를 입력해주세요."
    );
  }

  try {
    const r = await fetch("/api/profiles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        nickname,
        age,
        game: verifiedInfo.game,
        tier: verifiedInfo.tier,
        riotId: verifiedInfo.riotId,
        battleTag: verifiedInfo.battleTag,
        verified: verifiedInfo.verified,
        verificationSource: verifiedInfo.source
      })
    });

    const d = await r.json();

    alert(
      r.ok
        ? "프로필이 등록되었습니다."
        : d.message
    );

  } catch (e) {
    alert("서버 연결에 실패했습니다.");
  }
}

/* =========================
   검색
========================= */

function quickSearch() {
  const q =
    document.getElementById("quickSearch")?.value.trim();

  if (q) {
    alert(
      `"${q}" 검색 기능은 DB 검색 API로 확장할 수 있습니다.`
    );
  }
}

/* =========================
   로그인 / 회원가입
========================= */

function createAuthModal() {
  if (document.getElementById("authModal")) return;

  const modal = document.createElement("div");

  modal.id = "authModal";

  modal.innerHTML = `
    <div class="auth-overlay">
      <div class="auth-modal">

        <button class="auth-close" onclick="closeAuthModal()">×</button>

        <div class="auth-tabs">
          <button id="loginTab" class="auth-tab active"
            onclick="showLogin()">로그인</button>

          <button id="signupTab" class="auth-tab"
            onclick="showSignup()">회원가입</button>
        </div>

        <div id="loginForm">

          <h2>GAMEMATCH 로그인</h2>
          <p class="auth-desc">
            게임 파트너를 찾으려면 로그인해주세요.
          </p>

          <input
            id="loginId"
            class="auth-input"
            placeholder="아이디 또는 이메일"
          >

          <input
            id="loginPassword"
            class="auth-input"
            type="password"
            placeholder="비밀번호"
          >

          <button class="auth-submit" onclick="loginUser()">
            로그인
          </button>

          <p id="loginMessage" class="auth-message"></p>

        </div>

        <div id="signupForm" class="hidden">

          <h2>GAMEMATCH 회원가입</h2>
          <p class="auth-desc">
            새로운 계정을 만들어보세요.
          </p>

          <input
            id="signupUsername"
            class="auth-input"
            placeholder="아이디"
          >

          <input
            id="signupEmail"
            class="auth-input"
            type="email"
            placeholder="이메일"
          >

          <input
            id="signupPassword"
            class="auth-input"
            type="password"
            placeholder="비밀번호 (8자 이상)"
          >

          <button class="auth-submit" onclick="signupUser()">
            회원가입
          </button>

          <p id="signupMessage" class="auth-message"></p>

        </div>

      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function openAuthModal(type = "login") {
  createAuthModal();

  document.getElementById("authModal")
    .classList.add("open");

  if (type === "signup") {
    showSignup();
  } else {
    showLogin();
  }
}

function closeAuthModal() {
  document.getElementById("authModal")
    ?.classList.remove("open");
}

function showLogin() {
  document.getElementById("loginForm")
    ?.classList.remove("hidden");

  document.getElementById("signupForm")
    ?.classList.add("hidden");

  document.getElementById("loginTab")
    ?.classList.add("active");

  document.getElementById("signupTab")
    ?.classList.remove("active");
}

function showSignup() {
  document.getElementById("loginForm")
    ?.classList.add("hidden");

  document.getElementById("signupForm")
    ?.classList.remove("hidden");

  document.getElementById("loginTab")
    ?.classList.remove("active");

  document.getElementById("signupTab")
    ?.classList.add("active");
}

/* 로그인 */
async function loginUser() {

  const login =
    document.getElementById("loginId")?.value.trim();

  const password =
    document.getElementById("loginPassword")?.value;

  const message =
    document.getElementById("loginMessage");

  if (!login || !password) {
    message.textContent =
      "아이디와 비밀번호를 입력해주세요.";
    return;
  }

  message.textContent = "로그인 중...";

  try {

    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        login,
        password
      })
    });

    const data = await r.json();

    if (!r.ok) {
      message.textContent =
        data.message || "로그인에 실패했습니다.";
      return;
    }

    closeAuthModal();

    updateLoginUI(data.user);

    alert(
      `${data.user.username}님, 로그인되었습니다!`
    );

  } catch (e) {

    message.textContent =
      "서버와 연결할 수 없습니다.";
  }
}

/* 회원가입 */
async function signupUser() {

  const username =
    document.getElementById("signupUsername")
      ?.value.trim();

  const email =
    document.getElementById("signupEmail")
      ?.value.trim();

  const password =
    document.getElementById("signupPassword")
      ?.value;

  const message =
    document.getElementById("signupMessage");

  if (!username || !email || !password) {
    message.textContent =
      "모든 항목을 입력해주세요.";
    return;
  }

  message.textContent =
    "회원가입 처리 중...";

  try {

    const r = await fetch("/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        email,
        password
      })
    });

    const data = await r.json();

    if (!r.ok) {
      message.textContent =
        data.message || "회원가입에 실패했습니다.";
      return;
    }

    closeAuthModal();

    updateLoginUI(data.user);

    alert(
      `${data.user.username}님, 회원가입이 완료되었습니다!`
    );

  } catch (e) {

    message.textContent =
      "서버와 연결할 수 없습니다.";
  }
}

/* 로그아웃 */
async function logoutUser() {

  try {

    await fetch("/api/auth/logout", {
      method: "POST"
    });

    updateLoginUI(null);

    alert("로그아웃되었습니다.");

  } catch (e) {

    alert("로그아웃 중 오류가 발생했습니다.");
  }
}

/* 로그인 상태 확인 */
async function checkLogin() {

  try {

    const r =
      await fetch("/api/auth/me");

    const data =
      await r.json();

    if (data.loggedIn) {
      updateLoginUI(data.user);
    } else {
      updateLoginUI(null);
    }

  } catch (e) {

    console.log(
      "로그인 상태 확인 실패"
    );
  }
}

/* 상단 로그인 UI 변경 */
function updateLoginUI(user) {

  const navRight =
    document.querySelector(".nav-right");

  if (!navRight) return;

  if (user) {

    navRight.innerHTML = `
      <button class="icon-btn" title="언어">
        ◎
      </button>

      <span class="login-user">
        👤 ${escapeHtml(user.username)}
      </span>

      <button
        class="ghost"
        onclick="logoutUser()">
        로그아웃
      </button>
    `;

  } else {

    navRight.innerHTML = `
      <button class="icon-btn" title="언어">
        ◎
      </button>

      <button
        class="ghost"
        onclick="openAuthModal('login')">
        로그인
      </button>

      <button
        class="signup"
        onclick="openAuthModal('signup')">
        회원가입
      </button>
    `;
  }
}

function escapeHtml(text) {

  const div =
    document.createElement("div");

  div.textContent = text;

  return div.innerHTML;
}

/* 페이지가 열리면 로그인 상태 확인 */
document.addEventListener(
  "DOMContentLoaded",
  () => {

    checkLogin();

    /*
      HTML에 있던 기존 버튼에 직접 이벤트 연결
    */

    const loginButton =
      document.querySelector(".nav-right .ghost");

    const signupButton =
      document.querySelector(".nav-right .signup");

    loginButton?.addEventListener(
      "click",
      () => openAuthModal("login")
    );

    signupButton?.addEventListener(
      "click",
      () => openAuthModal("signup")
    );
  }
);
