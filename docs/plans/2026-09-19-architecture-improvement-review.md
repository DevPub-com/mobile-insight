# Mobile Insight 백엔드·프론트엔드 고도화 검토

검토일: 2026-09-19. 대상: 현재 로컬 구현. 이 문서는 개선 제안이며 구현 완료 보고가 아니다.

## 결론

현재의 Next.js 단일 프로젝트, 플랫폼별 어댑터, 순수 계산 함수, Drizzle 저장 구조는 유지할 가치가 있다. 우선순위는 인증·API 계약 정리 → 조회 데이터 축소와 집계 정확성 → 동기화 실행 관리 → 기능별 프론트 분리다. 별도 백엔드 프레임워크나 마이크로서비스 도입이 필요한 근거는 이번 검토에서 확인하지 못했다.

공통화는 같은 변경 이유를 가진 정책과 실행 절차를 캡슐화하는 방향이 적절하다. 플랫폼별 지표 의미와 화면별 표현 차이는 유지한다.

## 확인된 기반

- `src/services/mobile/common/store-adapter.ts`: StoreAdapter/BackfillStoreAdapter와 정규화된 payload가 있다.
- `src/domain/models`: 외부 플랫폼 DTO가 분리되어 있다.
- `src/services/mobile/tabs`, `dashboard-summary.service.ts`: 화면 계산 함수가 분리되어 재사용되고 있다.
- `src/db/upsert.ts`, `schema.ts`: upsert와 식별용 unique index, 앱·날짜 조회 index가 있다.
- `src/components/ui/dp`, `echart.tsx`: UI primitive와 차트 래퍼가 이미 있다.
- 부분 수집 실패, null 값, 출처·품질, 리뷰 절단 여부를 표현하는 기존 계약이 있다. 개선 과정에서 이 의미를 보존해야 한다.

## 우선순위별 발견 사항

### P0: 애플리케이션 인증 범위와 운영 정책 정리

`src/proxy.ts:15`는 사용자명·비밀번호가 모두 없으면 production에서도 접근을 허용한다. `src/proxy.test.ts`도 이 동작을 기대한다. README의 “운영에서 미설정이면 503” 설명과 다르므로 단순한 실수라고 단정할 수는 없지만 정책과 문서가 불일치한다.

`src/proxy.ts:50`의 matcher에는 `/api/ai/briefing`이 없다. 해당 POST route에도 별도 인증 검사가 없으며 DB 조회, BigQuery 조회, AI 생성과 캐시 저장이 가능하다. 외부 reverse proxy가 보호하는지는 이번에 확인하지 않았다. 애플리케이션 단독으로 노출하면 인증되지 않은 호출에 대한 방어가 없는 구조다.

제안: 운영 인증 정책을 한 곳에 정의하고 AI·동기화 mutation에 명시적으로 적용한다. 브라우저 mutation의 origin 검증과 조회/실행 권한을 구분한다. AI 생성 횟수 제한과 요청 중복 억제를 추가한다. README와 테스트의 기대 동작도 같은 정책으로 정리한다.

### P1: API 계약 및 앱 식별자 통일

같은 `/api/dashboard/[appId]` 경로에서 summary/reviews/release-impact는 app code를 사용하고 sync/crash-free/nonfatal은 UUID를 사용한다. 현재 호출부가 이를 구별하는 사례는 확인되므로 모든 요청이 실패한다는 의미는 아니다. 다만 새 기능 추가 시 혼동하기 쉬운 계약이다.

summary/crash-free/crash-impact에 날짜 검증이 중복되고 reviews route는 period/platform을 타입 단언으로 처리한다. `page=abc`나 허용되지 않은 enum에 대한 명시적 400 검증도 없다. AI route는 JSON을 타입 단언하고 클라이언트 cacheKey를 사용하며 예외 message를 그대로 응답한다.

제안:

- 외부 URL은 appCode로 통일하고 내부 DB에서는 AppId를 사용한다. 이행 중에는 기존 계약을 호환하거나 소비자를 함께 이전한다.
- `contracts`에 DateRangeQuery, ReviewQuery, BriefingRequest/Response를 두고 기존 Zod 의존성으로 검증한다.
- `resolveActiveApp`, `ApiError`, `toApiErrorResponse`를 작은 공통 함수로 만든다.
- 사용자 응답에는 오류 코드와 안전한 메시지, 로그에는 requestId와 원인을 남긴다.
- 현재 summary에만 있는 OpenAPI 계약을 핵심 endpoint로 확대하고 스키마와의 불일치를 검사한다.

### P1: 전체 조회 중심 구조와 리뷰 집계 범위

`src/db/dashboard.repository.ts:30`은 일별 지표 전체, 관측값, 평점, 최대 5,001개 리뷰, 릴리스, 동기화 이력을 함께 읽는다. 리뷰는 5,000개로 잘라 반환한다. page는 전체 DashboardData를 client shell에 넘기며 여러 탭 API와 sync-status도 이 전체 조회 함수를 재사용한다.

`dashboard-shell.tsx:393` 이후 필터·평점·VOC 집계는 전달된 리뷰 배열을 사용한다. reviews API의 total도 잘린 배열 기준이다. release-impact는 reviewDataTruncated일 때 일부 값을 null 처리하지만, 화면 전체에서 동일하게 적용되는 것은 아니다. 데이터가 5,000개를 넘으면 기간별 전체 집계와 목록 total의 의미가 달라질 수 있다.

제안: 요약 집계와 리뷰 상세 조회를 분리한다. 요약은 전체 대상 기간을 집계하고 상세는 `(reviewedAt, id)`를 기준으로 cursor pagination한다. 기존 품질·출처·null 계약을 유지한다. 단순히 리뷰 limit만 낮추는 변경은 피한다.

Repository의 첫 분리 후보는 `getDashboardSummarySource`, `getReviewPage`, `getReviewAggregates`, `getReleaseImpactSource`, `getSyncStatus`다. 기간 조회는 이전 비교 기간, 직전 릴리스, 누적 평점의 직전 유효값까지 포함해야 한다. 요청 기간만 잘라 기존 계산 함수에 전달하면 지표가 바뀔 수 있다.

기존 `docs/verification/2026-09-12-query-performance.md`에는 직렬화 데이터 약 2.30MB, 리뷰 약 1.41MB, 페이지 응답 약 2.61MB라는 과거 관측이 있다. 이번 검토에서 다시 측정한 수치가 아니다. 현재 실제 DB의 EXPLAIN, 브라우저 hydration과 p95는 미측정이다.

### P1: 동기화 작업의 실행 생명주기

`sync-app.ts`는 호출한 요청 안에서 외부 수집·저장·리뷰 AI 분석까지 수행한다. 수동 POST도 완료를 기다린다. GitHub Actions의 concurrency는 해당 workflow 실행끼리만 조정하며, 앱 코드에서 수동/cron/backfill을 함께 막는 DB lease는 확인되지 않았다.

GA4·crash-impact는 store별 running row 생성 전에 실행된다. 따라서 GET sync가 검사하는 sync_runs 상태는 전체 작업의 시작·종료를 대표하지 않는다. 이 단계의 결과는 results와 로그에 남지만 store와 같은 run 추적을 거치지 않는다. 또한 metrics scope에서는 GA4 수집이 실행되지 않아 이름에서 기대하는 범위를 계약으로 명확히 해야 한다.

제안:

- 먼저 앱별 lease와 실행 ID를 도입한다. 서로 겹치는 scope의 충돌도 차단한다.
- queued/running/partial/succeeded/failed와 단계별 진행 상태를 관리한다. heartbeat·만료 후 복구 정책을 둔다.
- 다음 단계에서 POST는 jobId와 202를 반환하고 실제 실행은 지속 가능한 runner가 맡게 한다. 프로세스 내부의 fire-and-forget은 사용하지 않는다.
- DB 기반 job을 선택한다면 예약 workflow와 별개로 실제 polling worker 실행 환경까지 마련한다.
- 원본 수집과 AI enrichment를 재실행 가능한 별도 단계로 나눈다.
- transaction은 원자성이 필요한 저장 묶음에 짧게 적용한다. 외부 네트워크 호출 전체를 DB transaction으로 감싸지 않는다.

### P1: 외부 분석 조회와 AI 캐시 비용

`release-impact`는 조회할 때 `loadFirebaseStability`를 호출하고, `ReleaseImpactAiBriefingCard`는 캐시가 있어도 mount 후 fresh 생성을 요청한다. executive 캐시는 route에서 TTL/data revision 검증 없이 반환한다. 한쪽은 반복 생성되고 다른 쪽은 오래된 데이터가 재사용될 수 있다.

제안: 서버가 app/platform/release/dateRange/dataRevision/promptVersion을 바탕으로 key를 생성한다. 최신 데이터 revision이 같으면 재사용하고, 기간별 freshness 정책과 명시적 재생성을 구분한다. 같은 key에 대한 생성은 하나로 합친다. 시간 경과로 변경되는 분석 창도 key에 반영한다.

BigQuery의 빈 결과와 완전 수집된 0건을 구분한다. 결측을 일괄 0으로 바꾸거나 플랫폼 전체 수치를 버전별 수치로 대체하면 안 된다.

### P2: 프론트 기능 경계와 렌더링

`dashboard-shell.tsx`는 1,644줄이며 6개 화면의 상태·계산·표현을 포함한다. `globals.css`는 4,959줄이다. 여러 탭의 계산이 shell 렌더 단계에서 실행되고 view는 로컬 state라 URL 공유나 새로고침 복원이 어렵다.

제안: Dashboard/Acquisition/Reviews/Releases/ReleaseImpact/AppManagement 단위로 컴포넌트와 상태를 이동한다. shell에는 탐색·공통 기간·앱 선택만 남긴다. 탭·기간·리뷰 필터·선택 릴리스는 URL 상태로, 열림/닫힘 같은 일시적 상태는 로컬로 둔다.

서버에서는 화면용 DTO를 만들고 client에는 필요한 차트·리스트 데이터만 전달한다. 기존 순수 계산 함수는 domain에 두어 서버와 테스트가 재사용한다. 서버 전용 DB/credential 모듈과 브라우저용 계산의 import 경계를 명시한다. 기존 서비스 파일을 이름만 바꾸며 일괄 이동할 필요는 없다.

`echart.tsx:38`은 option 변경마다 dispose/init한다. mount/unmount 생명주기와 option 업데이트 effect를 나누고 인스턴스를 재사용한다. 숨겨진 탭의 차트 초기화와 지연 로딩은 실제 측정 후 적용한다.

## 공통 코드 캡슐화 후보

| 공통 모듈 | 현재 중복·책임 | 권장 경계 |
| --- | --- | --- |
| API contracts | 날짜·기간·platform·page·AI body 검증 | 순수 스키마 및 DTO, Next/DB 의존 없음 |
| app resolver | code/UUID 조회·활성 앱 확인 | repository 조회 후 내부 AppId 반환 |
| BigQuery executor | crash-free/crash-impact/crashlytics/release-stability의 인증·job polling·pagination·오류 | 실행 절차만 공통화, 각 SQL/지표 해석은 개별 유지 |
| sync payload writer | sync/backfill의 날짜 변환·upsert·release filtering·batch | 정규화 데이터 저장, AI 분석 정책은 별도 |
| briefing cache policy | key·최신성·중복 생성·갱신 | 서버 소유 정책, 입력 기간과 데이터 revision 포함 |
| browser API client | fetch·HTTP 오류·응답 decode·취소 | 얇은 fetchJson와 기능별 hook, 거대한 범용 hook 회피 |
| metric formatting | 숫자·평점·%·%p·증감·시간대 | presentation 전용 함수, 반올림/단위 규칙 명시 |
| metric UI | KPI card·변화량·empty/error/loading | 기존 Dp primitive 위의 도메인 컴포넌트 |
| chart lifecycle | 인스턴스·resize·dispose | EChart 래퍼, 각 chart option은 기능 소유 |

Store 다운로드/GA4 first_open, 누적 평점/수집 리뷰 평균, 퍼센트/%p, crash 사용자/설치 ID는 의미가 다르므로 하나의 숫자 유틸로 합치지 않는다. Apple의 재시도 가능 GET과 보고서 생성 POST도 같은 재시도 정책으로 묶지 않는다.

## 적용 순서와 완료 기준

1. **기준선·정책 정리:** 기존 실패 테스트의 의도 확인, 인증 범위와 API 입력 검증, code/UUID 계약 정리. 완료 기준: 익명 AI 실행 차단, 잘못된 입력 400, 기존 정상 호출 호환.
2. **작은 공통 모듈 추출:** DateRange, App resolver, BigQuery executor, payload writer, formatter. 완료 기준: 기존 fixture 출력 동일, pagination/timeout/부분 실패 테스트 통과.
3. **조회 개선:** 리뷰 집계와 상세 분리, 탭별 read model, summary DTO로 초기 화면 전환. 완료 기준: 5,000개 초과 fixture에서도 전체 집계 일치, cursor 중복/누락 없음, 응답 크기와 지연 측정 개선.
4. **프론트 분리:** 기능별 view/state/CSS, URL 필터, chart 재사용, 공통 query 상태. 완료 기준: 뒤로가기·새로고침 복원, 빠른 필터 변경 시 과거 응답 덮어쓰기 없음, 차트 인스턴스 재사용.
5. **작업 실행·캐시:** lease/runner, 단계별 재실행, revision 기반 AI/분석 캐시. 완료 기준: 동시 요청 중복 수집 방지, 종료된 worker의 작업 복구, 동일 revision의 중복 AI 생성 방지.

초기에는 각 단계의 PR을 작게 유지한다. 동기화 동시 실행 문제가 실제 운영에서 발생 중이면 5단계 중 lease·추적 부분은 1단계로 앞당긴다. 성능 목표 수치는 현재 환경에서 기준선을 다시 측정한 후 정한다.

## 검증 체계

현재 Vitest는 node 환경이며 일부 UI/repository 테스트가 소스 문자열 존재 여부를 검사한다. 함수 추출만 해도 실패할 수 있는 구조다. 이번에도 `koboyo-icons.test.ts:31`에서 `name="shield-alert"` 문자열 기대가 실패했다. 이는 사용자 동작 실패를 증명하지 않는다.

도메인 계산 테스트는 유지하고 구조에 종속적인 문자열 검사는 렌더링·상호작용·계약 검사로 점진 교체한다. 우선 E2E 경로는 앱 전환, 기간 변경, 리뷰 다음 페이지, 동기화 완료/부분 실패, AI 캐시·갱신이다. CI에는 현재 data-sync workflow 외에 PR lint/typecheck/test/build gate를 추가한다. `scripts/check-sync-env.test.mjs`는 현재 Vitest include에서 제외되므로 Node test 명령도 별도 연결한다.

이번 실행 결과:

- `npm run typecheck`: 통과.
- `npm run lint`: 오류 0, 경고 3(Change/total/isProduction 미사용).
- `npm test -- --reporter=dot`: 82개 파일 중 81 통과·1 실패. 테스트 428개 중 427 통과·1 실패.
- build, 브라우저 E2E, 실제 DB 성능, 외부 API 실호출은 실행하지 않았다.
- 현재 shell Node는 20.17.0이며 README 요구 최소 20.19보다 낮다. CI의 Node 22와 로컬 버전을 맞춰 build 기준선을 확보해야 한다.
- git status는 Xcode 라이선스 미동의로 실행되지 않았다. 앱 소스는 수정하지 않았으며 이 검토 문서만 추가했다. typecheck 실행은 증분 캐시를 갱신할 수 있다.

## 참고

설치된 Next.js 문서 `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`의 matcher 설명을 확인했다.

- [Vercel: document size 최적화](https://vercel.com/kb/guide/how-to-optimize-your-document-size-in-next-js): Server Component에서 Client Component로 넘기는 데이터도 초기 응답에 포함된다. 따라서 파일 분리와 함께 전달 DTO를 축소해야 한다.
- [PostgreSQL: Explicit Locking](https://www.postgresql.org/docs/17/explicit-locking.html): advisory lock의 session/transaction 수명이 다르다. 현재 pooler 설정을 고려해 lease 방식을 우선 검토하며 장시간 외부 호출을 위한 transaction lock은 피한다.
