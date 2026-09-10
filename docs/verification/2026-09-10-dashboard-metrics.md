# 대시보드 지표 확인 (2026-09-10)

## 직접 조회한 근거

설정된 DB의 `kis` 앱을 `getDashboardData`로 읽고, 화면에서 사용하는 집계 함수를 실행했다. DB 데이터는 변경하지 않았다.

- `buildOverview().totalDownloads`: 48,701. Android 48,701, iOS null.
- `buildDownloadTrendForRange`의 일별 total 합계: 48,701. 유효한 다운로드 날짜는 2026-08-01~2026-08-21, 21일이다. 따라서 차트는 수집분 누적 합계이며, 출시 이후 전체 다운로드가 아니다. 날짜 선택과 무관한 카드다.
- `buildStoreRatingSummary().android`: 2026-09-09 수동 확인 기록 4.386 한 건. `singlePoint` 모드에서도 symbol이 숨겨져 차트가 비었다. 한 점을 표시하도록 고쳤으며 과거 추이를 생성하지 않았다.
- `buildDashboardSummaryForRange(data, {startDate: '2026-08-11', endDate: '2026-09-09'})`: Android 부정 리뷰 69.4%, iOS 77.8%. 분자는 1~2점 수집 리뷰, 분모는 동일 플랫폼/기간의 전체 수집 리뷰다. 날짜는 `reviewedAt`의 UTC 날짜로 판정한다. Google 리뷰는 수집기가 마지막 수정 시각을 사용하므로 최초 작성일 기준만의 집계는 아니다.
- 양쪽 신규 크래시 이슈: DB 응답에 `crashIssues`가 없고, 실제 이슈 수집 구현도 없다. `dailyMetrics.crashes`의 유효 기록도 없다. 별도로 수집된 Android `user_perceived_crash_rate_28d`의 최신 값은 2026-09-07의 0.23%이며 신규 이슈 건수와 다르다.

## 1.01.46 원문 대조

DB 리뷰 `externalId=3ee7dee9-9577-44c6-afeb-c34de811eaa0`, source=`google_play_api`를 Google Android Publisher API의 동일 앱 `/reviews/{reviewId}` GET으로 다시 조회했다.

```json
{"appVersionName":"1.01.46","appVersionCode":23062316}
```

API가 직접 반환한 값이다. 화면과 수집기는 해당 이름을 그대로 사용한다. 이것이 실제 배포 이력에 없는 이유는 확인되지 않았으며, 다른 버전으로 임의 교체하지 않았다. 화면 버전에 원문 기준임을 알리는 설명을 추가했다.

## 변경 및 검증

- 대시보드 AI Executive Briefing 제거.
- Android 단일 평점 기록 표시와 기록 수 안내.
- 다운로드 수집 기간, 수집 일수, iOS 미수집 표시. 누적선 곡선 보간 제거.
- 부정 리뷰 차트가 플랫폼별 집계 결과를 사용하도록 수정. 기존에는 양쪽 모두 통합 리뷰 추이를 사용했다.
- 부정 리뷰 카드에 선택 날짜와 1~2점 기준 명시.
- 관련 7개 테스트 파일의 71개 테스트 통과. 단일 점 렌더링과 플랫폼 차트 혼합은 수정 전 실패, 수정 후 통과 확인.
- 타입 검사 통과. localhost:3000/dashboard/kis 브라우저에서 AI 카드 제거, 실제 수집 기간과 단일 평점 점 표시 확인.

## 남은 작업

Android/iOS 신규 크래시 이슈를 표시하려면 실제 크래시 수집 서비스와 프로젝트 연결 정보가 필요하다. 이를 요청했으며, 원천 데이터 없이 숫자나 차트를 생성하지 않았다.
