# 크래시 이력 연결 검증

2026-09-10 한국투자 앱(`kis`)의 실제 Google Play / App Store 계정으로 수집하고 DB에 저장했다. 기존 동기화의 `stability` 작업에도 연결했다. 앞선 dashboard-metrics 보고서의 크래시 미연동 상태는 이 작업으로 갱신되었다.

## 실제 결과

- Android 크래시 일별 기록 59건 저장. 선택 기간 2026-08-11~2026-09-09에는 29일 수집분 100,935건, 최신 날짜 2026-09-08.
- iOS 크래시 일별 기록 5건 저장. 동일 선택 기간에는 5일 수집분 417건, 최신 날짜 2026-09-09.
- 양쪽의 동기화 최종 결과는 오류 없음. 브라우저 localhost:3000/dashboard/kis에서 카드와 날짜별 차트에 위 값들이 나타나는 것을 확인했다.
- 이 값은 반복 발생을 포함한 크래시 보고 건수다. 신규 고유 오류 종류 수나 사용자 수가 아니다. 수집 일수가 다른 두 플랫폼 합계를 직접 비교하면 안 된다.
- 보고가 없는 날짜는 null로 유지하고 선을 연결하지 않는다. 불완전한 기간의 증감 비교는 제공하지 않는다.

## 원천 정의

- [Google ErrorCountMetricSet](https://developers.google.com/play/developer/reporting/reference/rest/v1beta1/vitals.errors.counts): `errorReportCount`를 `reportType`별로 조회하고 CRASH 유형만 저장한다. 일별 날짜는 America/Los_Angeles 기준이다. freshness에 포함된 시(hour)는 일별 쿼리에서 제거한다.
- [Apple App Crashes](https://developer.apple.com/documentation/analytics-reports/app-crashes): APP_USAGE의 App Crashes 보고서에서 앱 ID를 확인하고 날짜별 Crashes를 합산한다. 공유 동의 사용자 기준이며 개인정보 보호 임계값이 적용된다. 전체 사용자 전수는 아니다.

## 리뷰 버전과 시각

앞선 직접 Google API 조회에서 같은 리뷰에 `appVersionName=1.01.46`, `appVersionCode=23062316`, `lastModified.seconds=1788967661`이 반환되었다. 마지막 수정 시각은 UTC 2026-09-09 15:27:41, 한국시간 2026-09-10 00:27:41이다.

[Google UserComment 정의](https://developers.google.com/android-publisher/api-ref/rest/v3/reviews#UserComment)에 따르면 appVersionCode와 appVersionName은 리뷰 작성 당시 설치된 앱 버전이며, lastModified는 리뷰의 마지막 갱신 시각이다. 따라서 최근 작성 또는 수정된 리뷰임은 확인되지만, 최초 작성일과 현재 사용 버전은 이 응답만으로 확정할 수 없다.

## 검증

- 관련 10개 테스트 파일 53개 테스트 통과. Google 날짜 정규화 회귀 테스트는 시각 필드 제거 전 실패, 제거 후 통과했다.
- 타입 검사, 변경 코드 린트, git diff --check 통과.
- 실제 DB 저장과 양쪽 차트 시각 확인 완료.
- 전체 테스트의 중간 실행에서는 기존 아이콘 기대값과 병행 작업 중인 다운로드 파일 등의 실패가 있어 전체 테스트 통과를 주장하지 않는다.

수동 재수집: `node --import tsx scripts/sync-crash-history.ts kis`.
