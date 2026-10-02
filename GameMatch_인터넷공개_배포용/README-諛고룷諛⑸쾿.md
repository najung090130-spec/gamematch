# GameMatch 인터넷 공개 방법

이 버전은 `localhost` 전용이 아니라 **Node.js + PostgreSQL 배포용**으로 정리되어 있습니다.

## 가장 쉬운 방법: Render

1. GitHub 계정을 만들고 이 폴더 전체를 새 GitHub 저장소에 올립니다.
2. Render에서 GitHub 저장소를 연결합니다.
3. `render.yaml`을 이용해 Web Service와 PostgreSQL을 생성합니다.
4. Render 환경변수에서 다음 값을 입력합니다.
   - `ADMIN_KEY`: 관리자 페이지에 사용할 강한 비밀번호
   - `RIOT_API_KEY`: Riot API 키
   - `RIOT_RSO_CLIENT_ID`: Riot RSO 클라이언트 ID
   - `RIOT_RSO_CLIENT_SECRET`: Riot RSO 클라이언트 시크릿
   - `RIOT_RSO_REDIRECT_URI`: 배포 후 실제 주소 + `/auth/riot/callback`
5. 배포가 끝나면 Render가 발급한 `https://...` 주소를 다른 사람에게 보내면 됩니다.

## 로컬 테스트

```bash
npm install
npm start
```

Chrome에서:

```text
http://localhost:3000
```

## 중요한 보안 사항

- Riot API 키와 RSO 시크릿은 `public/` 안에 넣지 마세요.
- `.env`는 GitHub에 올리지 마세요.
- 실제 운영에서는 관리자 비밀번호를 충분히 길고 랜덤하게 설정하세요.
- VALORANT Riot 로그인은 Riot에서 RSO 앱 승인을 받아야 실제 계정 정보 연동이 완료됩니다.
- Overwatch 2는 이 버전에서 사진 인증을 사용하지 않습니다. BattleTag 입력은 별도의 Blizzard 인증 API가 연결되지 않은 상태이므로 자동 티어 인증으로 표시하면 안 됩니다.

## 현재 배포 버전의 역할

- PostgreSQL에 여러 사용자의 프로필을 저장
- 인증된 프로필만 매칭 후보로 사용
- 나이 범위와 티어 차이로 매칭 검색
- 관리자 API로 프로필 승인/거절
- Riot API 키는 서버에서만 사용
- Riot 로그인은 RSO 공식 로그인 화면으로 이동

실제 상용 서비스로 운영하려면 회원가입/로그인, 개인정보 처리방침, 신고/차단, rate limit, CAPTCHA 등의 추가 보안·운영 기능을 권장합니다.
