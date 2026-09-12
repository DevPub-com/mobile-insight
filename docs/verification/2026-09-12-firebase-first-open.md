# Firebase 최초 실행 API 수집 검증

2026-09-12 22:15 KST, KIS의 기존 서비스 계정과 GA4 속성으로 공식 Data API를 호출했다. 브라우저에서 값을 수집하지 않았다.

- 요청: date/platform, eventCount, eventName EXACT first_open, 최근 35일~어제.
- 응답: 16행, 속성 시간대 Etc/GMT-9, 2026-09-04~2026-09-11.
- 샘플링·임계값·고카디널리티 데이터 손실 표시 없음.
- `node --import tsx scripts/sync-first-opens.ts kis --apply` 실행 완료.
- 운영 DB `usage_daily_records`에 first_open/firebase 16행 저장 후 재조회로 확인했다. 다운로드 테이블은 변경하지 않는다.

| 날짜 | Android 최초 실행 | iOS 최초 실행 |
|---|---:|---:|
| 2026-09-04 | 2119 | 651 |
| 2026-09-05 | 2493 | 886 |
| 2026-09-06 | 2276 | 914 |
| 2026-09-07 | 4418 | 1594 |
| 2026-09-08 | 4095 | 1451 |
| 2026-09-09 | 4015 | 1391 |
| 2026-09-10 | 4587 | 1648 |
| 2026-09-11 | 4641 | 1583 |

`fetchGa4SyncData`가 최초 실행을 다른 GA4 보고서와 독립적으로 수집하고 `syncAllApps(all)`이 기존 관측값 UPSERT로 저장한다. 최근 35일을 다시 받아 지연 집계를 갱신한다. 기존 `.github/workflows/data-sync.yml`의 매일 06:30 UTC(15:30 KST) 전체 배치 경로에 포함된다. 새 코드를 운영 서버에 배포하지 않았으므로 운영 예약 실행에 적용됐다고 주장하지 않는다.

다운로드 탭의 Firebase 최초 실행 패널에 별도 차트·최근 5일 값을 추가했다. 로컬 UI에서 Android 4,641 / iOS 1,583 렌더링을 확인했다. 차트는 선택 기간 안에서 수집된 첫날~마지막날을 표시하며 중간 누락은 연결하거나 0으로 바꾸지 않는다.

관련 테스트 72개, TypeScript 검사, 변경 파일 ESLint 통과.

최초 실행은 설치·재설치 후 앱을 처음 연 이벤트다. 스토어 다운로드 또는 고유 신규 사용자 수와 동일한 지표가 아니다.

- https://support.google.com/analytics/answer/9234069
- https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/FilterExpression

## 대시보드 차트 표시 보완

사용자가 대시보드 다운로드 차트에서도 최초 실행을 확인하도록 요청했다. 기존 별도 패널 외에 대시보드 차트에 Android/iOS 최초 실행을 파랑/주황 점선으로 추가했다. 스토어 값은 실선을 유지하고 제목·설명·범례로 구분한다. 날짜를 키로 맞춰 연결하며 빈 날짜를 다운로드로 대체하지 않는다. 로컬 대시보드의 4개 시리즈와 실제 점선 렌더링을 확인했다. 관련 테스트 17개, 타입 검사, 변경 컴포넌트 ESLint 통과.
