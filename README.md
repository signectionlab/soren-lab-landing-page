# SOREN LAB — 회사소개 랜딩페이지

화장품 R&D · OEM/ODM 기업 **SOREN LAB**의 B2B 회사소개 원페이지 사이트입니다.  
문의 폼은 **Supabase PostgreSQL**에 저장되고, 별도 **관리자 페이지**에서 접수된 문의를 조회·관리할 수 있습니다.

**라이브 사이트:** [https://soren-lab-landing-page.vercel.app](https://soren-lab-landing-page.vercel.app)  
**관리자 페이지:** [https://soren-lab-landing-page.vercel.app/admin.html](https://soren-lab-landing-page.vercel.app/admin.html)

---

## 주요 기능

### 랜딩페이지 (`index.html`)

- 7개 섹션 원페이지 구성 (Hero, 소개, 기술, 제품, 역량, 파트너, 문의)
- 반응형 레이아웃 · 스크롤 애니메이션 · 제품 모달
- B2B 문의 폼 → **Supabase** `inquiries` 테이블 저장 (anon INSERT + RLS)

### 관리자 페이지 (`admin.html`)

- **Supabase Auth** 이메일/비밀번호 로그인
- 문의 목록 (상태 라벨 · 문의자 · 접수 시각)
- 상세 팝업에서 문의 내용 확인, **상담 상태** · **관리자 메모** 수정
- 문의 건별 **삭제**

### 회원 게시판 (`board.html`)

- Supabase Auth 이메일/비밀번호 회원가입·로그인
- 로그인 사용자만 게시판 접근·글 작성 가능
- 작성자는 본인 글만 수정·삭제 가능
- 이메일/비밀번호는 Supabase Authentication에서 관리
- 화면 표시용 회원 프로필은 Supabase `profiles` 테이블에서 관리
- 게시글은 Supabase `board_posts` 테이블에서 관리

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | HTML, CSS, Vanilla JavaScript |
| DB / Auth | Supabase (PostgreSQL + Auth) |
| 배포 | Vercel (정적 호스팅) |
| 저장소 | GitHub |

---

## 프로젝트 구조

```
├── index.html
├── admin.html
├── css/
├── js/
│   ├── form.js                 # 문의 폼 → Supabase INSERT
│   ├── admin.js                # Supabase Auth + CRUD
│   ├── auth.js                 # 회원가입/로그인
│   ├── board.js                # 회원 게시판
│   ├── session-nav.js          # 랜딩 헤더 로그인 상태
│   ├── supabase-config.example.js
│   ├── supabase-config.js      # URL/anon key (build-env 생성, gitignore)
│   └── supabase-client.js
├── supabase/migrations/
│   └── 001_create_inquiries.sql
│   └── 002_create_board.sql
│   └── 003_harden_profiles.sql
│   └── 004_profiles_email_verification.sql
├── scripts/
│   ├── build-env.js
│   ├── check-supabase-schema.js
│   ├── apply-supabase-migration.js
│   └── migrate-sheets-import.js
├── data/                       # Sheets CSV (gitignore)
└── vercel.json
```

---

## Supabase 초기 설정

### 1. 환경변수 (`.env`)

```bash
cp .env.example .env
```

| 변수 | 용도 |
|------|------|
| `SUPABASE_URL` | `https://YOUR_PROJECT_REF.supabase.co` |
| `SUPABASE_ANON_KEY` | 프론트 + build-env |
| `SUPABASE_SERVICE_ROLE_KEY` | 로컬 이관 스크립트 1회용 (**Git/Vercel 금지**) |
| `SUPABASE_ACCESS_TOKEN` | (선택) SQL 자동 적용 |

### 2. 테이블 + RLS 생성

**방법 A — Access Token 자동 적용 (권장)**

1. Supabase Dashboard → **Account → Access Tokens** 에서 Personal Access Token 발급
2. `.env`에 `SUPABASE_ACCESS_TOKEN=...` 추가
3. 실행:

```bash
node scripts/apply-supabase-migration.js
node scripts/check-supabase-schema.js
```

**방법 B — SQL Editor 수동 실행**

Supabase Dashboard → **SQL Editor**에서 [`supabase/migrations/001_create_inquiries.sql`](supabase/migrations/001_create_inquiries.sql) 실행.

회원가입/게시판 기능을 사용하려면 이어서 아래 SQL도 순서대로 실행합니다.

- [`supabase/migrations/002_create_board.sql`](supabase/migrations/002_create_board.sql)
- [`supabase/migrations/003_harden_profiles.sql`](supabase/migrations/003_harden_profiles.sql) *(선택)*
- [`supabase/migrations/004_profiles_email_verification.sql`](supabase/migrations/004_profiles_email_verification.sql) — **Table Editor에서 이메일·인증 상태 확인용**

`004` 실행 후 **Table Editor → profiles** 에서 `email`, `email_verified`, `email_confirmed_at` 컬럼을 확인할 수 있습니다. 회원가입·이메일 인증 시 `auth.users`와 자동 동기화됩니다.

### 3. 관리자 Auth 계정

Supabase Dashboard → **Authentication → Users → Add user** (Auto Confirm)

---

## 기존 Google Sheets 데이터 이관 (1회)

1. Google Sheets → **파일 → 다운로드 → CSV**
2. `data/sheets-export.csv` 로 저장
3. 실행:

```bash
node scripts/migrate-sheets-import.js data/sheets-export.csv
```

---

## 로컬 개발

```bash
node scripts/build-env.js
python3 -m http.server 8080
```

`node scripts/build-env.js`는 `.env` 값을 읽어 `js/supabase-config.js`를 생성합니다. 이 파일은 실제 anon key가 들어가는 로컬/배포용 생성 파일이라 Git에는 올리지 않습니다.

| 페이지 | URL |
|--------|-----|
| 랜딩 | http://127.0.0.1:8080/ |
| 로그인/회원가입 | http://127.0.0.1:8080/auth.html |
| 게시판 | http://127.0.0.1:8080/board.html |
| 관리자 | http://127.0.0.1:8080/admin.html |

---

## Vercel 배포

1. GitHub 저장소 연결
2. Vercel **Environment Variables** (Production):

| 변수 | 필수 |
|------|------|
| `SUPABASE_URL` | O |
| `SUPABASE_ANON_KEY` | O |
| `SUPABASE_SERVICE_ROLE_KEY` | X (설정하지 않음) |

3. 배포 시 `vercel.json`의 `buildCommand`가 `node scripts/build-env.js` 실행
4. 배포 후 검증: `node scripts/setup-verify.js` (로컬 `.env` 기준)

### GAS 비활성화 (이관 검증 후)

Supabase 전환·관리자 CRUD 확인이 끝나면 Google Apps Script Web App 배포를 **비활성화**하세요.
Google Sheets는 2~4주간 read-only 백업으로 유지하는 것을 권장합니다.

---

## 보안 안내

- `.env`, `service_role` key, 관리자 비밀번호는 **GitHub에 올리지 않습니다**
- `anon` key는 프론트 노출 OK (RLS로 INSERT만 허용)
- `admin.html`은 `noindex` 처리

---

## License

Private project — SOREN LAB / Signection Lab
