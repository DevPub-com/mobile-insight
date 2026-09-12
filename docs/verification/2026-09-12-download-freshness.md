# Android 다운로드 최신성 확인

2026-09-12 KST에 DB와 Google Cloud Storage를 읽기 전용으로 조회했다.

- KIS Android 다운로드의 DB 최신 날짜: 2026-08-21.
- KIS Android 다운로드 최근 sync_runs: 2026-09-12 07:59:52 KST, success, 오류 없음.
- KIS iOS 다운로드의 DB 최신 날짜: 2026-09-09.
- KIS 패키지: com.truefriend.neosmartarenewal.
- 해당 패키지의 2026년 overview 보고서를 나열했을 때 최신 파일은 `stats/installs/installs_com.truefriend.neosmartarenewal_202608_overview.csv`였다.
- 원본 객체 updated: 2026-08-26T05:25:59.057Z.
- 원본 행 수: 21. 마지막 Date: 2026-08-21. Daily User Installs: 2607.
- 원본 최신 날짜와 DB 최신 날짜가 일치한다. 이 overview 보고서 경로에는 이후 날짜를 채울 원본이 없다. Google 측 갱신 중단 이유나 Play Console 화면의 최신 날짜는 확인하지 않았다.

수집 코드는 `src/services/google/adapter/google-play.adapter.ts`의 sync에서 최근 월별 보고서를 조회한다. `.github/workflows/data-sync.yml`에는 매일 06:30 UTC 전체 동기화가 정의되어 있다. 워크플로 정의만으로 실제 예약 실행 여부를 확정하지 않는다.

공식 문서: https://support.google.com/googleplay/android-developer/answer/6135870?hl=en
Google은 일별 데이터를 월별 CSV에 게시하며 3~7일 지연될 수 있다고 안내한다. 이번 공백은 이 안내보다 길다.

## Play Console에서 최신 데이터 확보

로그인된 Chrome의 Play Console 통계 화면을 직접 조회했다. 개발자 ID `8245469396302428159`, 앱 ID `4975213402310084344`.

- 사용자 → 사용자 획득 → 새 사용자 수, 모든 이벤트·구간별·일별, 모든 국가/지역 합계.
- URL 지표: `USER_ACQUISITION-NEW-EVENTS-PER_INTERVAL-DAY`.
- 최근 90일 요청, 실제 제공된 표는 2026-06-14~2026-09-06의 연속 85행.
- 원본 스냅샷: `data/2026-09-12-play-console-installs.json`.
- DB와 겹치는 69일 중 60일은 동일했다. 나머지 9일의 차이 원인은 확정하지 않았다.
- 원본 지표를 `play_console_new_user_acquisitions`, source=`manual`, quality=`exact`로 별도 보존했다. `manual`은 현재 스키마의 브라우저 직접 확인 출처다.
- 다운로드가 비어 있던 2026-08-22~2026-09-06의 16일을 신규 사용자 획득 실측값으로 보완했다. 기존 CSV 다운로드 값은 덮어쓰지 않았다.
- 대시보드용 `daily_user_installs` 매핑은 동일 지표라고 과장하지 않도록 quality=`derived`와 원본 지표·URL 설명을 저장했다. 보간이나 Firebase first_open 대체는 하지 않았다.
- 적용 후 Android 최신 다운로드 날짜: 2026-09-06. 로컬 다운로드 차트가 9월 6일까지 이어지고 상세 기준일이 2026-09-06임을 UI와 스크린샷으로 검증했다.
- 9월 7일 이후 값은 이번 Console 통계 표에서도 제공되지 않았다. 오늘 수치 확보를 완료했다고 주장하지 않는다.

## 재사용 가능한 가져오기

`node --import tsx scripts/import-play-console-installs.ts <snapshot.json>`은 읽기 전용 검증이다. `--apply`를 붙이면 트랜잭션으로 누락 다운로드 날짜만 보완하고 Console 원본 지표를 UPSERT한다. 다른 플랫폼과 기존 다운로드·설치·삭제 값은 유지한다.

입력에는 packageName, sourceUrl, observedAt, metric, dimension=`OVERALL`, expectedRowCount, rows(date,value)가 필요하다. 실제 Console 표의 전체 행을 읽고 저장해야 한다. 잘못된 지표, 부분 캡처, 중복·누락 날짜, 음수, 잘못된 날짜를 거부한다. 테스트 9개와 타입 검사·해당 파일 린트를 통과했다.

매일 10:30 KST에 Console을 읽고 운영 DB를 보완하는 Codex 예약을 시도했지만 자동 승인 검토에서 반복 운영 DB 변경에 대한 명시적 승인이 필요하다고 거절했다. 예약은 생성되지 않았다. 사용자 승인 후 구성해야 한다. 이 방식은 Chrome 로그인 세션 및 로컬 Codex 실행 환경에 의존하며 기존 서버 배치에 연결된 API 수집이라고 표현하지 않는다.

## 일별 상세 표 추가 보완

사용자의 빈 값 추가 보완 요청에 따라 원본을 다시 확인했다.

- Android Console 새로고침 후에도 신규 사용자 획득 마지막 날짜는 2026-09-06이다.
- Apple ONGOING 원본 재조회에서 2026-09-10 데이터가 추가로 확인됐다. 최초 다운로드 699 + 재다운로드 629 = 총 다운로드 1,328.
- 2026-09-10의 비어 있던 iOS 다운로드와 관측값만 추가했다. 기존 날짜의 값은 변경하지 않았다. 원본 정규화 결과는 `data/2026-09-12-apple-downloads.json`에 보존했다.
- DB와 로컬 UI에서 9/10 = 1,328, 9/9 = 1,073, 9/8 = 1,067을 확인했다. iOS 최신 기준일이 2026-09-10으로 변경됐다.
- Sales API에는 9/7과 9/10 보고서가 있지만 Analytics와 재다운로드/복원 집계가 다르므로 동일한 총 다운로드 값으로 삽입하지 않았다. 9/11 Sales API 응답은 404 `Report is not available yet`였다.
- 9/7 이전 Analytics 이력을 확보하기 위해 대상 앱 1621986905의 ONE_TIME_SNAPSHOT을 생성했다. 요청 ID: `6ae6d4cc-1848-4263-a33b-c5c5482c0be0`. App Downloads Standard 보고서 ID: `r3-6ae6d4cc-1848-4263-a33b-c5c5482c0be0`. 확인 시 일별 instances 배열은 비어 있었다.
- App Store Connect 브라우저 로그인은 만료되어 사용자에게 로그인을 요청했다. API 인증은 유효하다.
- 최초의 보고서 생성/전체 UPSERT 복합 명령은 자동 승인 검토에서 범위 초과로 거절됐다. 기존 값 덮어쓰기를 제거하고, 빈 날짜 보완과 일회성 이력 요청을 분리한 명령은 각각 승인되어 완료됐다.

추가 수집 시 `fetchAppleDownloadAnalytics`의 `{accessType: "ONE_TIME_SNAPSHOT", maxInstances: null}`로 준비된 이력 데이터를 읽을 수 있다. 기존 backfill 코드도 이 요청을 지원한다. 이번 작업에서는 반복 예약이나 기존 값 덮어쓰기를 승인받지 않았다.

공식 참고: https://developer.apple.com/help/app-store-connect-analytics/overview/analytics-reports-api
