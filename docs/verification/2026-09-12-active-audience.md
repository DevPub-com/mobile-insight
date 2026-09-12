# DAU·MAU 대시보드 교체

- 총 다운로드 카드를 Android·iOS별 DAU와 MAU(최근 28일)로 교체했다. 플랫폼별 최신 유효 수집일을 표시한다.
- 대시보드의 다운로드 차트를 DAU 실선 / MAU(28일) 점선으로 교체했다. 일별 값을 누적 합산하지 않으며 누락 구간은 연결하지 않는다.
- 기존 GA4 API를 최근 35일로 재조회해 16행을 저장했다. 2026-09-11: Android DAU 739041 / MAU28 1252096, iOS DAU 283917 / MAU28 531596.
- 로컬 UI에서 카드의 네 값과 차트의 네 시리즈를 확인했다.
- TypeScript와 변경 컴포넌트 ESLint 통과. 일별 감소 및 마지막 누락일 처리 테스트 통과.
- 운영 배포는 수행하지 않았다. 기존 GA4 일배치가 active1DayUsers / active28DayUsers를 수집한다.

지표 정의: https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema
