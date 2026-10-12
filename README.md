# V-TAKE 이메일 알림 신청

React + Vite 페이지에서 이메일과 수신 동의를 받아 `POST /api/subscribe`로 전송합니다. Vercel Function이 `@neondatabase/serverless`를 통해 Neon Postgres에 저장합니다. 현재 범위는 신청 정보 저장까지이며 실제 이메일 발송 기능은 없습니다. 설문 버튼은 기존 Google Forms로 연결됩니다.

이 문서는 설정 절차입니다. DB 생성, 환경 변수 등록, 실제 배포는 운영자가 아래 순서로 진행해야 합니다.

## 1. Vercel 프로젝트 설정

GitHub 저장소는 [cookie3029/V-Take_Survey](https://github.com/cookie3029/V-Take_Survey)입니다. 저장소 루트에 `package.json`이 있으므로 다음 값을 사용합니다.

| 항목 | 값 |
| --- | --- |
| Framework Preset | `Vite` |
| Root Directory | `./` (저장소 루트) |
| Install Command | `pnpm install` |
| Build Command | `pnpm build` |
| Output Directory | `dist` |

`api/subscribe.js`도 저장소에 포함되어야 합니다. `dist` 파일만 별도로 올리면 서버 API를 사용할 수 없습니다.

## 2. Neon DB 생성 및 프로젝트 연결

1. Vercel에서 해당 프로젝트의 **Storage → Create Database**를 열고 **Neon**을 선택합니다. 이 메뉴가 보이지 않으면 [Neon Marketplace](https://vercel.com/marketplace/neon)에서 **Install**로 시작합니다.
2. 새 DB를 만들 경우 **Create New Neon Account** 경로에서 이름·리전·플랜을 선택합니다. 기존 Neon 계정이나 DB가 있으면 제공되는 기존 계정 연결 경로를 사용합니다.
3. 생성한 Storage 리소스에서 **Connect Project**를 선택하고 `V-Take_Survey`에 해당하는 Vercel 프로젝트를 연결합니다. 환경은 우선 **Production**을 선택합니다. 변수 이름에 접두사를 추가하지 않습니다.
4. Preview에서 테스트할 경우 Neon의 **Preview Branching**을 활성화하거나 별도의 테스트 DB/브랜치를 연결합니다. Production과 Preview가 같은 연결 문자열을 사용하면 테스트 신청도 운영 DB에 저장됩니다. [Neon 공식 연결 가이드](https://neon.com/docs/guides/vercel-managed-integration)

Marketplace 연결은 DB 자격 증명을 환경 변수로 추가합니다. 연결 뒤 Vercel 프로젝트의 **Settings → Environment Variables**에서 Production에 `DATABASE_URL`이 있는지 확인합니다. [Vercel Storage 문서](https://vercel.com/docs/marketplace-storage)

`DATABASE_URL`이 없거나 다른 이름만 있다면 Neon의 **Connect / Connection Details**에서 운영 브랜치·DB·역할을 선택해 Postgres 연결 문자열을 복사하고 아래처럼 직접 추가합니다.

| 항목 | 값 |
| --- | --- |
| Key | `DATABASE_URL` |
| Value | Neon의 운영 DB 연결 문자열 전체 |
| Type | `Secret` |
| Environment | `Production` |

연결 문자열은 비밀번호를 포함하므로 저장소나 프런트엔드 코드에 넣지 않습니다. 이름을 `VITE_DATABASE_URL` 또는 `NEXT_PUBLIC_DATABASE_URL`로 바꾸지 않습니다. 서버의 `process.env.DATABASE_URL`만 사용합니다. 수동 변수 등록은 [Vercel 환경 변수 관리 문서](https://vercel.com/docs/environment-variables/managing-environment-variables)를 참고하세요.

## 3. 운영 DB에 테이블 생성

1. Vercel Storage의 **Open in Neon**으로 Neon Console을 엽니다.
2. **Postgres database → SQL Editor**에서 Production의 `DATABASE_URL`과 연결된 **같은 브랜치와 DB**를 선택합니다. 기본 브랜치 이름만 보고 선택하지 말고 연결 대상과 대조합니다.
3. [db/001_email_subscriptions.sql](db/001_email_subscriptions.sql) 전체 내용을 붙여 넣고 **Run**을 누릅니다. [Neon SQL Editor 문서](https://neon.com/docs/get-started/query-with-neon-sql-editor)

테이블은 `public.email_subscriptions` 하나입니다.

| 컬럼 | 타입 | 제약 / 기본값 | 의미 |
| --- | --- | --- | --- |
| `id` | `bigint` | Identity, Primary Key | 신청 식별자 |
| `email` | `varchar(254)` | NOT NULL, UNIQUE, 소문자·앞뒤 공백 제거 | 신청 이메일 |
| `created_at` | `timestamptz` | NOT NULL, `now()` | 최초 저장 시각 |
| `consented_at` | `timestamptz` | NOT NULL, `now()` | 수신 동의 저장 시각 |
| `consent_version` | `varchar(40)` | NOT NULL, DB 기본값 없음 | API가 `'2026-10-12'`로 기록하는 동의 문구 버전 |

API는 이메일의 앞뒤 공백을 제거하고 소문자로 저장합니다. 같은 이메일을 다시 신청해도 UNIQUE 제약과 중복 처리로 한 행만 유지합니다. 동의하지 않은 신청은 저장하지 않습니다. 스키마의 정확한 정의는 SQL 파일을 기준으로 합니다.

## 4. 변경 코드 배포

프로젝트 폴더에서 다음 명령으로 수정한 소스를 GitHub에 반영합니다. `main`에 연결된 Vercel 프로젝트가 새 배포를 시작합니다.

```sh
git add .gitignore .env.example README.md package.json pnpm-lock.yaml vercel.json \
  api server shared db tests scripts/dev.mjs src/App.jsx src/styles.css
git commit -m "공개 알림 신청을 DB에 저장"
git push origin main
```

테이블과 Production 환경 변수를 준비한 다음 이 변경 코드가 포함된 커밋을 Vercel의 Production 브랜치에 배포합니다. 변경 코드가 이미 배포되어 있다면 **Deployments → 해당 최신 배포 → Redeploy**를 실행합니다. 이전 코드만 포함된 배포를 다시 실행하지 않도록 커밋을 확인하세요.

환경 변수 변경은 새 배포에만 적용됩니다. 등록·수정만 하고 기존 배포를 그대로 사용하면 API가 새 값을 읽지 못합니다. [Vercel 환경 변수 문서](https://vercel.com/docs/environment-variables)

## 5. 신청 및 저장 확인

배포된 페이지에서 본인이 관리하는 테스트 이메일을 입력하고 수신 동의에 체크한 뒤 신청합니다. 개발자 도구의 Network에서 `/api/subscribe` 요청이 성공했는지 확인하고, Neon SQL Editor에서 다음 쿼리로 저장 결과를 확인합니다. 두 번 신청해도 해당 이메일은 한 행이어야 합니다.

```sql
-- 전체 신청 수
SELECT COUNT(*) AS subscription_count
FROM public.email_subscriptions;

-- 최근 신청 20건 (운영자 확인용)
SELECT id, email, created_at, consented_at, consent_version
FROM public.email_subscriptions
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- 본인이 입력한 테스트 이메일로 교체
SELECT COUNT(*) AS matching_rows
FROM public.email_subscriptions
WHERE email = 'your-test-email@example.com';
```

신청 목록은 Neon Console에서 운영자만 확인합니다. 공개 페이지나 API에 이메일 목록을 노출하지 않습니다. `DATABASE_URL`이 없거나 저장에 실패하면 페이지는 오류를 표시하며 성공으로 처리하지 않습니다.

문제가 생기면 Vercel의 해당 배포 **Functions / Logs**를 확인합니다.

| 증상 | 확인할 내용 |
| --- | --- |
| 설정 오류 | Production에 `DATABASE_URL`이 등록되어 있는지, 등록 후 새 배포를 했는지 |
| 테이블 오류 | API가 연결하는 브랜치·DB에서 SQL 파일을 실행했는지 |
| 연결 오류 | Neon 연결 문자열·DB 상태·환경 범위가 맞는지 |
| `/api/subscribe` 404 | API 파일을 포함한 변경 코드가 배포되었는지, Root Directory가 `./`인지 |

## 로컬 실행

Node.js 24와 pnpm을 사용합니다(`packageManager: pnpm@10.34.7`). `.env.example`을 복사하고 **테스트용 DB** 연결 문자열을 입력합니다. 운영 DB와 별도의 브랜치/DB에 위 SQL을 먼저 실행하세요.

```sh
pnpm install
cp .env.example .env.local
# .env.local의 DATABASE_URL을 테스트 DB 연결 문자열로 수정
pnpm dev
```

`pnpm dev`는 `.env.local`을 서버에 로드하고 Vite 페이지와 구독 API를 함께 실행합니다. 환경 변수를 수정했다면 개발 서버를 다시 시작합니다. `.env.local`은 Git에 올리지 않습니다.

```sh
node --test
pnpm build
```

빌드 결과는 `dist`입니다. 정적 파일 미리보기만으로는 DB 저장 동작을 검증할 수 없으므로 신청 테스트는 `pnpm dev` 또는 API가 배포된 Vercel 주소에서 진행합니다.

## API 요청

```http
POST /api/subscribe
Content-Type: application/json
```

```json
{
  "email": "your-test-email@example.com",
  "consent": true,
  "consentVersion": "2026-10-12"
}
```

이메일·명시적 동의·지원하는 동의 버전을 서버에서 검증합니다. 이 API는 신청 정보 저장만 처리하며 확인 메일이나 알림 메일을 보내지 않습니다.
