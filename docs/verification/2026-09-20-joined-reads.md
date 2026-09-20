# 조인 기반 조회 통합 검증 (2026-09-20)

## 변경 범위

- `getDashboardData`: 활성 앱 선택·앱 목록·프로필별 자식 목록을 하나의 SELECT로 통합했다. 각 자식 목록을 정렬/제한한 뒤 JSON 집계하는 LEFT JOIN LATERAL을 사용해 여러 일대다 관계의 행 곱셈을 방지한다.
- `getReviewPage`: 활성 앱 확인, 기준 날짜, 필터 전체 건수, 페이지 목록을 하나의 SELECT로 통합했다. 커서는 페이지 목록에만 적용하므로 마지막 페이지를 지난 요청에서도 전체 건수를 유지한다.
- 공통 `joinedRows`는 Drizzle 컬럼 디코더로 날짜·숫자·JSON·null을 기존 SELECT와 같은 타입으로 복원한다. 프로필에서 제외된 테이블은 조회하지 않는다.
- DB 스키마, 저장 데이터, 수집/배치, 계산식, 공개 인증 정책은 변경하지 않았다.

## 쿼리 수

| 조회 함수 | 직전 구현 | 현재 |
| --- | ---: | ---: |
| getDashboardData(full) | 8 | 1 |
| getDashboardData(shell) | 7 | 1 |
| getDashboardData(releases/sync-status/active-users) | 2 | 1 |
| getReviewPage(전체 기간/명시적 날짜) | 3 | 1 |
| getReviewPage(상대 기간) | 4 | 1 |

초기 페이지의 분석용 리뷰 조회는 앱/릴리스 정보로 날짜 범위를 계산한 다음 실행해야 하므로, shell 조회 1회 + 분석용 조회 1회의 순서를 유지한다. 모든 페이지 요청이 SQL 1회만 실행된다는 의미는 아니다.

## 회귀 검증

실제 마이그레이션을 적용한 PGlite의 격리된 데이터로 검증했다.

- 5,006건 리뷰 전체 내용과 정렬이 독립 SELECT와 일치한다.
- 같은 시각의 리뷰도 커서 페이지 순회 시 누락/중복 없이 모두 반환한다.
- 앱·지표·릴리스·동기화·리뷰·배포정보의 조인 결과를 일반 SELECT와 직접 비교했다. 날짜, JSON 배열/객체, 숫자, boolean, null과 ORDER BY/LIMIT가 유지된다.
- 지표 3건·릴리스 2건·동기화 1건·리뷰 5,006건이 서로 증식하지 않는다.
- 빈 앱, 없는 앱, 비활성 앱, 필터 결과 0건, 마지막 페이지 이후 요청을 검증했다.
- 상대 기간은 최신 지표 날짜를 기준으로 기존과 동일한 5,003건을 반환한다.
- 기존 프로필별 집계 및 초기 대시보드 분석 모델과의 동등성 검증도 통과했다.

관련 테스트 11개 통과, typecheck 통과, production build 통과. 전체 테스트는 463개 중 462개 통과했다. 기존 `koboyo-icons.test.ts`의 `shield-alert` 소스 문자열 기대 불일치 1개는 그대로 남아 있다. lint는 오류 없이 기존 dashboard-shell 경고 2개가 남는다.

운영 DB 결과 대조와 실제 실행 계획/응답 시간 측정은 수행하지 않았다. 쿼리 왕복 횟수 감소를 검증한 것이며 운영 성능 개선 비율을 주장하지 않는다.

설계 참고: [Drizzle JOIN](https://orm.drizzle.team/docs/joins), [PostgreSQL LATERAL](https://www.postgresql.org/docs/current/queries-table-expressions.html).
