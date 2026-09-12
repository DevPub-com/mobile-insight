# Firebase 최초 실행 일배치

사용자 요청: 브라우저 자동화 없이 API로 최신 유입을 수집하고 화면에 추가한다.

- 기존 KIS GA4 인증을 재사용해 `runReport`에서 `eventName = first_open`의 `eventCount`를 날짜·플랫폼별 조회한다.
- 기존 전체 일배치에서 최근 35일~어제를 재조회한다. GA4 속성 시간대 기준이며 오늘의 미완성 집계는 포함하지 않는다.
- `usage_daily_records`에 metricKey=`first_open`, source=`firebase`로 저장한다. 스토어 다운로드 및 기존 newUsers와 별도 지표다. 동일 날짜 재수집은 UPSERT한다.
- 보고서 샘플링·임계값·잘못된 수치가 감지되면 저장하지 않고 오류를 반환한다. 다른 GA4 데이터 수집은 계속한다.
- 다운로드 화면에 최초 실행 차트와 최근 일별 값을 추가한다. 수집되지 않은 날짜는 0으로 만들지 않는다.
- 공식 문서: https://support.google.com/analytics/answer/9234069, https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/FilterExpression
