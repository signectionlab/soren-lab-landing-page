# SOREN LAB — 회사소개 랜딩페이지

화장품 R&D · OEM/ODM 기업 **SOREN LAB**의 B2B 회사소개 원페이지 사이트입니다.  
문의 폼은 Google Sheets에 저장되고, 별도 **관리자 페이지**에서 접수된 문의를 조회·관리할 수 있습니다.

**라이브 사이트:** [https://soren-lab-landing-page.vercel.app](https://soren-lab-landing-page.vercel.app)  
**관리자 페이지:** [https://soren-lab-landing-page.vercel.app/admin.html](https://soren-lab-landing-page.vercel.app/admin.html)

---

## 주요 기능

### 랜딩페이지 (`index.html`)

- 7개 섹션 원페이지 구성 (Hero, 소개, 기술, 제품, 역량, 파트너, 문의)
- 반응형 레이아웃 · 스크롤 애니메이션 · 제품 모달
- B2B 문의 폼 → Google Apps Script → **Google Sheets** 저장 + **이메일 알림**

### 관리자 페이지 (`admin.html`)

- 관리자 토큰 로그인
- 문의 목록 (상태 라벨 · 문의자 · 접수 시각)
- 상세 팝업에서 문의 내용 확인, **상담 상태(L열)** · **관리자 메모(J열)** 수정
- 문의 건별 **삭제**

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | HTML, CSS, Vanilla JavaScript |
| 백엔드 | Google Apps Script (Web App) |
| DB | Google Sheets |
| 배포 | Vercel (정적 호스팅) |
| 저장소 | GitHub |

---

## 프로젝트 구조

```
├── index.html              # 랜딩페이지
├── admin.html              # 관리자 페이지
├── css/                    # 스타일
├── js/
│   ├── main.js             # 네비·스크롤 등
│   ├── form.js             # 문의 폼 → GAS
│   ├── admin.js            # 관리자 API 연동
│   ├── animate.js
│   └── video.js
├── assets/                 # 이미지·영상
├── google-apps-script/
│   ├── Code.gs             # GAS 백엔드 (폼 + Admin API)
│   └── script.properties.example
├── scripts/
│   └── build-env.js        # 배포 시 GAS URL 주입
├── vercel.json
└── .env.example
```

---

## 로컬 개발

### 1. 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일에 Apps Script Web App URL을 입력합니다.

```
GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOY_ID/exec
```

### 2. URL 주입 & 로컬 서버

```bash
node scripts/build-env.js
python3 -m http.server 8080
```

| 페이지 | URL |
|--------|-----|
| 랜딩 | http://127.0.0.1:8080/ |
| 관리자 | http://127.0.0.1:8080/admin.html |

> `js/form.js`, `js/admin.js`의 `__GOOGLE_SCRIPT_URL__` placeholder는 `build-env.js` 실행 시 `.env` 값으로 치환됩니다. GitHub에는 placeholder만 커밋됩니다.

---

## Google Apps Script 설정

1. Google Sheets에 문의 DB 시트 생성 (1행 헤더 필수)
2. **확장 프로그램 → Apps Script**에서 `google-apps-script/Code.gs` 전체 붙여넣기
3. **프로젝트 설정 → 스크립트 속성** 등록 (`script.properties.example` 참고)

| 속성 | 설명 |
|------|------|
| `SHEET_NAME` | 시트 탭 이름 |
| `ADMIN_EMAIL` | 문의 알림 수신 이메일 |
| `ADMIN_TOKEN` | 관리자 페이지 로그인 토큰 |

4. **배포 → 새 배포 → 웹 앱** (실행: 나, 액세스: 모든 사용자)
5. 발급된 URL을 `.env`의 `GOOGLE_SCRIPT_URL` 및 Vercel 환경변수에 설정

### Admin API

| action | 설명 |
|--------|------|
| `list` | 문의 목록 조회 |
| `update` | 상태·메모 수정 |
| `delete` | 문의 행 삭제 |

---

## Vercel 배포

1. GitHub 저장소 연결
2. Vercel **Environment Variables**에 `GOOGLE_SCRIPT_URL` 설정 (Production)
3. 배포 시 `vercel.json`의 `buildCommand`가 `node scripts/build-env.js`를 실행해 URL을 주입

```json
{
  "buildCommand": "node scripts/build-env.js",
  "outputDirectory": "."
}
```

---

## 보안 안내

- `.env`, 실제 GAS URL, `ADMIN_TOKEN` 값은 **GitHub에 올리지 않습니다**
- 관리자 토큰은 Google Apps Script **스크립트 속성**에만 저장
- `admin.html`은 `noindex` 처리되어 검색엔진 색인을 제한합니다

---

## 기획 문서

| 파일 | 내용 |
|------|------|
| `1. 브랜딩기획.md` | 브랜드 방향 |
| `2. 디자인기획.md` | UI/UX 기획 |
| `3. 웹구조기획.md` | 페이지 구조 |

---

## License

Private project — SOREN LAB / Signection Lab
