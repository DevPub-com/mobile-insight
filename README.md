# Mobile Insight

`Mobile Insight`는 회사가 운영하는 Android/iOS 앱의 다운로드, 평점, 리뷰, 릴리즈 이후 반응을 한 화면에서 연결하는 사내용 운영 대시보드입니다. 첫 등록 앱은 **한국투자 앱**이며, 앱별 UI를 복제하지 않고 `app_master` row와 credential profile을 추가하는 방식으로 확장합니다. 현재 seed의 Store 식별자는 의도적으로 비워 두었으므로 실제 package/app ID를 등록해야 live sync가 실행됩니다.

## Architecture

```text
Google Play reports / Reviews API ─┐
App Store Connect API ─────────────┼─ Normalize → Drizzle UPSERT
GA4 Data API ──────────────────────┘                  │
                                                             ▼
Dashboard / Route Handlers ← Query service ← PostgreSQL (DATABASE_URL)
```

- Next.js App Router 한 프로젝트에서 UI, Route Handler, cron endpoint를 운영합니다.
- Dashboard는 Store API를 호출하지 않고 PostgreSQL만 조회합니다.
- 외부 플랫폼(Google/Apple/GA4) DTO는 `src/domain/models`에 격리하며, 프론트엔드 및 API 컨트롤러 레이어로 직접 노출하지 않습니다.
- 동기화는 플랫폼별로 독립 실행되며 `sync_runs`에 `success`, `partial`, `failed`를 기록합니다.
- 실제 credential은 DB에 저장하지 않고 환경변수 이름만 `src/config/store-config.ts`에서 매핑합니다.

### Database table naming

테이블 이름은 역할을 나타내는 고정 접미사를 사용합니다.

| 접미사 | 역할 | 현재 테이블 |
| --- | --- | --- |
| `_master` | 관리 기준정보 | `app_master` |
| `_summary` | 화면이 읽는 요약 | `overview_daily_summary`, `release_summary` |
| `_records` | 출처 또는 분석 기준을 보존한 기록 | `usage_daily_records`, `rating_daily_records`, `review_records`, `app_version_daily_records`, `os_version_daily_records`, `device_daily_records` |
| `_runs` | 작업 실행 결과 | `sync_runs` |

앱 버전·OS 버전·기기별 GA4 일별 분포는 향후 분석을 위해 `_daily_records`로 유지합니다. 현재 사용 계획이 없는 지역별 GA4 분포와 릴리즈 상태 관측 이력은 저장하지 않습니다.

## Local setup

요구 환경은 Node.js 20.19 이상과 Docker입니다.

```bash
cp .env.example .env.local
npm install
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

브라우저에서 `http://localhost:3000/dashboard/kis`를 엽니다. DB 없이 레이아웃만 검토할 때는 `.env.local`의 `MOBILE_INSIGHT_DEMO_MODE=true`를 사용합니다. 운영에서는 반드시 `false`로 두십시오.

## Database

모든 연결은 `DATABASE_URL`만 사용합니다. Supabase PostgreSQL, 사내 PostgreSQL, 로컬 Docker PostgreSQL에 동일하게 연결할 수 있습니다.

```bash
# schema 변경 후 migration 생성
npm run db:generate

# 미적용 migration 실행
npm run db:migrate

# 한국투자 90일 지표, 리뷰 42건, 릴리즈 4개 seed
npm run db:seed
```

초기 migration은 `drizzle/0000_woozy_morlocks.sql`입니다. Production DB를 수동으로 수정하지 말고 migration을 사용합니다.
시간 컬럼은 Store마다 다른 소수 초 표현을 제거하기 위해 UTC timezone을 유지한 `timestamp(0) with time zone`으로 저장합니다.

## Store credentials

### Google Play

1. Play Console에서 서비스 계정을 연결하고 앱 접근 권한을 부여합니다.
2. 다운로드 보고서의 Cloud Storage URI에서 bucket 이름(`pubsite_prod_rev_...`)을 확인합니다.
3. 서비스 계정에 보고서 bucket 읽기 권한과 Google Play Developer API 리뷰 조회 권한을 부여합니다.
4. JSON 전체와 bucket 이름을 환경변수로 설정합니다.

```text
GOOGLE_KIS_SERVICE_ACCOUNT_JSON={...}
GOOGLE_KIS_BUCKET_NAME=pubsite_prod_rev_...
```

일반 동기화에서 Android 어댑터는 최신 월간 GCS 설치/평점 CSV와 Reviews API를 읽습니다. `db:backfill`은 버킷에 남아 있는 설치/평점 파일 전체와 `reviews/reviews_[package_name]_YYYYMM.csv` 리뷰 파일 전체를 읽습니다. 과거 리뷰 CSV에는 작성자 이름이 없으므로 Dashboard에는 `이름 미제공`으로 표시합니다. 국가별 평점은 rating count가 없어 가중 재집계할 수 없으므로 모든 국가 행의 누적 평균이 동일한 날짜만 저장하며, 나머지는 `null`로 둡니다. GCS 보고서는 보통 3~7일 지연될 수 있으므로 “실시간” 수치로 해석하면 안 됩니다.

### App Store Connect

1. App Store Connect에서 Team API key를 생성합니다. Sales 보고서는 Individual key가 아니라 Team key가 필요합니다.
2. issuer ID, key ID, `.p8` private key, vendor number를 설정합니다.

```text
APPLE_KIS_ISSUER_ID=
APPLE_KIS_KEY_ID=
APPLE_KIS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
APPLE_KIS_VENDOR_NUMBER=
```

iOS 어댑터는 Sales report, 한국 App Store의 현재 누적 평점, Customer Reviews, App Store Versions를 읽습니다. 리뷰는 App Store 버전별 관계로 조회해 각 리뷰에 정확한 `versionString`을 저장합니다. 다운로드에는 최초 앱 설치를 뜻하는 product type `1`, `1F`, `1T`만 포함하고 재다운로드, 업데이트, 인앱 구매는 제외합니다. App Store Connect의 app resource ID는 현재 `app_master.ios_app_id`에 저장합니다. 일반 동기화는 최신 일별 보고서를 확인하고, `db:backfill`은 Apple의 보관 한도인 최근 365일을 날짜별로 적재합니다. 판매가 없거나 아직 생성되지 않은 일별 보고서는 실패로 기록하지 않고 건너뜁니다.

### Firebase Analytics / GA4

WTC는 Google Play에 사용하는 서비스 계정 JSON을 GA4 조회에도 재사용합니다. 서비스 계정 이메일을 GA4 속성의 Viewer로 추가하고, 해당 Google Cloud 프로젝트에서 Google Analytics Data API를 활성화한 뒤 숫자형 Property ID를 설정합니다.

```text
GOOGLE_WTC_SERVICE_ACCOUNT_JSON={...}
GA4_WTC_PROPERTY_ID=123456789
```

`G-...` 형태의 Measurement ID가 아니라 숫자형 GA4 Property ID를 사용합니다. 일반 동기화는 최근 35일의 `active1DayUsers`, `active7DayUsers`, `active28DayUsers`, `sessions`를 다시 조회해 지연·보정 데이터를 반영합니다. `db:backfill`은 최근 365일을 조회합니다. Android와 iOS는 GA4의 `platform` 차원으로 분리하며 Web 행은 저장하지 않습니다. GA4 설정이 없는 앱은 분석 수집만 건너뛰고 Store 동기화는 계속합니다.

## Historical backfill

Store credential과 `DATABASE_URL`을 `.env.local`에 설정한 로컬 단말에서 최초 1회 실행합니다.

```bash
npm run db:backfill
```

특정 앱과 플랫폼만 다시 처리할 수 있습니다.

```bash
npm run db:backfill -- --app=wtc --platform=android
```

- Android: GCS에 존재하는 설치, 평점, 리뷰 월별 보고서 전체. Review Link로 개별 API 조회가 가능한 과거 리뷰는 작성자명도 보완합니다.
- iOS Sales: 실행일 전날부터 최근 365일의 일별 최초 다운로드
- iOS Analytics: `ONE_TIME_SNAPSHOT`에서 제공하는 전체 설치·삭제 이력. 최초 요청에는 Admin 권한이 필요하며 보고서 생성까지 1~2일 걸릴 수 있음
- iOS Reviews/Releases: App Store 버전별 리뷰 전체 페이지와 릴리즈 상태·현지화 노트·build number·배포 방식·단계 배포 정보
- 릴리즈 날짜 정확도: Apple의 `earliestReleaseDate`가 없으면 버전 `createdDate`, Google Play는 production track의 최초 관측 시각을 사용하며 UI에 `추정`으로 표시합니다. 최초 관측일은 이후 동기화에서도 보존됩니다.
- Android Releases: Google Play production 트랙의 활성 릴리즈와 production 비폐기 릴리즈 목록만 병합합니다. versionCode, 상태, 활성 릴리즈 노트, 단계 배포율을 저장하며 internal/alpha/beta/커스텀 트랙은 수집하지 않습니다.
- 릴리즈 유형: Production/track과 Apple 배포 방식은 Store 원본값으로 표시하고, Major/Minor/Patch는 같은 플랫폼의 직전 버전과 비교한 별도 분류로 표시합니다.
- GA4: 최근 365일의 Android/iOS 1일·7일·28일 활성 사용자와 세션
- 각 데이터 묶음은 즉시 upsert하므로 중간 실패 후 같은 명령을 다시 실행해도 중복되지 않습니다.
- Apple 요청은 앱당 최대 365회 순차 실행하므로 수 분 이상 걸릴 수 있습니다.
- 이 명령은 Vercel 요청 안에서 실행하지 않습니다. 완료 후 일반 동기화는 `POST /api/sync`만 사용합니다.

## Daily cron and manual sync

`POST /api/sync`는 `SYNC_SECRET` bearer token 없이는 실행되지 않습니다.

```bash
curl -X POST https://mobile-insight.company.internal/api/sync \
  -H "Authorization: Bearer $SYNC_SECRET"
```

사내 scheduler, Vercel Cron, GitHub Actions 중 배포 환경에 맞는 도구에서 하루 한 번 호출합니다. 이 엔드포인트는 Android 최신 월간 보고서와 새 리뷰, iOS 최신 일별 보고서와 현재 리뷰·평점·릴리즈, GA4 최근 35일 활성 지표를 갱신합니다. Store 하나가 실패해도 다른 Store 및 GA4 결과는 저장됩니다.

## Access control

회사 SSO 또는 사내 reverse proxy가 있으면 그 계층을 우선 사용합니다. 없는 MVP 배포에서는 아래 두 값을 모두 설정하면 브라우저 Basic Auth가 `/dashboard`, 앱 목록과 Dashboard API를 보호합니다.

```text
DASHBOARD_BASIC_USER=
DASHBOARD_BASIC_PASSWORD=
```

운영 환경에서 두 값이 모두 없거나 하나만 있으면 보호 경로는 `503`으로 닫힙니다. 인증을 이미 끝낸 reverse proxy 뒤에서만 `TRUST_REVERSE_PROXY=true`를 명시하십시오. 로컬 development에서는 두 값을 비운 접근을 허용합니다. `/api/sync`는 별도의 `SYNC_SECRET`으로 보호됩니다.

## Add another app

두 번째 앱을 붙일 때 Dashboard component나 Route Handler를 복사하지 않습니다.

1. `app_master`에 새로운 `code`, 이름, Android package name, iOS App Store Connect app ID/bundle ID를 추가합니다.
2. `src/config/store-config.ts`에 그 `code`의 **환경변수 이름**만 추가합니다.
3. 실제 credential 환경변수를 배포 환경 secret store에 등록합니다.
4. `POST /api/sync`를 실행합니다.
5. App Selector에서 새 앱을 선택해 동일 화면을 검증합니다.

앱 추가 시 `if (appId === "...")` 분기나 새 Dashboard page가 필요하다면 구조가 잘못된 것입니다.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | 로컬 개발 서버 |
| `npm test` | 핵심 도메인 테스트 |
| `npm run typecheck` | TypeScript 검사 |
| `npm run lint` | ESLint 검사 |
| `npm run build` | production build |
| `npm run db:up` | 로컬 PostgreSQL 시작 |
| `npm run db:generate` | Drizzle migration 생성 |
| `npm run db:migrate` | migration 적용 |
| `npm run db:seed` | 한국투자 seed 데이터 생성 |
| `npm run db:backfill` | 활성 앱의 Store 과거 데이터 적재 |

## Troubleshooting

- `DATABASE_URL is not configured`: `.env.local`을 만들고 서버를 다시 시작합니다.
- Dashboard에 데이터가 없음: `app_master.is_active`, migration, seed/sync 실행과 `sync_runs`를 확인합니다.
- Google 403: 서비스 계정이 Play Console 앱과 GCS 보고서 bucket 양쪽에 접근 가능한지 확인합니다.
- Apple 401/403: Team key인지, issuer/key ID와 줄바꿈이 보존된 private key인지 확인합니다.
- GA4 403: 서비스 계정 이메일이 GA4 속성 Viewer인지, Google Analytics Data API가 활성화됐는지 확인합니다.
- GA4 데이터 없음: `GA4_WTC_PROPERTY_ID`가 숫자형 Property ID인지, 속성의 데이터 스트림에 Android/iOS 앱이 모두 연결됐는지 확인합니다.
- Partial Data: 플랫폼별 최신 `sync_runs.error_message`는 운영자용 DB/API 로그에서 확인합니다. 일반 Dashboard에는 credential 상세 오류를 표시하지 않습니다.

## Primary API references

- [Google Play report exports](https://support.google.com/googleplay/android-developer/answer/6135870)
- [Google Play reviews.list](https://developers.google.com/android-publisher/api-ref/rest/v3/reviews/list)
- [Google Analytics Data API](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi/)
- [App Store Connect sales reports](https://developer.apple.com/documentation/appstoreconnectapi/get-v1-salesreports)
- [App Store Connect customer reviews](https://developer.apple.com/documentation/appstoreconnectapi/get-v1-apps-_id_-customerreviews)
- [App Store Connect product type identifiers](https://developer.apple.com/help/app-store-connect/reference/reporting/product-type-identifiers/)
- [Next.js Proxy](https://nextjs.org/docs/app/getting-started/proxy)
- [Drizzle ORM migrations](https://orm.drizzle.team/docs/migrations)
