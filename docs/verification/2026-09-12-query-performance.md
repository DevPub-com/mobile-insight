# 조회 성능 점검

## 측정 범위

로컬 환경에서 기본 앱의 실제 DB를 읽기 전용으로 조회했다. 운영 서버 및 브라우저의 hydration·차트 그리기 시간은 측정하지 않았다. 수치는 소수 실행의 관측값이며 평균이나 백분위 지표가 아니다.

## 측정 결과

- 첫 DB 전체 조회: 369ms. 두 번째 조회: 230ms.
- 리뷰 조회: 각각 291ms / 209ms, 1,704건.
- 전체 요약 계산: 28ms / 13ms.
- 직렬화된 데이터: 2,299,117 bytes. 리뷰 1,408,008 bytes, 일별 지표 625,754 bytes.
- 로컬 `/dashboard/kis` HTTP 200: 첫 응답 0.072651초, 전체 수신 0.824404초, 응답 2,608,364 bytes. curl의 첫 응답 시간은 화면 완성 시간이 아니다.

## 코드 확인

- `src/db/dashboard.repository.ts`: 활성 앱을 조회한 다음 8개 쿼리를 Promise.all로 병렬 실행한다. 앱 ID를 사용하는 후속 쿼리는 첫 조회에 의존한다.
- `src/db/index.ts`: 연결 풀 최대값은 8이다.
- `src/app/dashboard/[appId]/page.tsx`: 전체 데이터를 기다린 다음 DashboardShell로 전달한다.
- `src/app/api/dashboard/*/route.ts`: 여러 탭 API가 loadDashboardData로 전체 데이터를 다시 읽는다. 실제 첫 화면에서 이 API들이 연속 호출된다는 증거는 확인하지 못했다.
- `src/components/dashboard/echart.tsx`: option이 달라질 때 effect cleanup이 차트를 dispose하고 새로 init한다. 갱신 때 재생성 비용이 발생하는 구조다. 실제 소요 시간은 미측정이다.
- `src/components/dashboard/dashboard-shell.tsx`: availableMetricDateRange(data)의 새 객체가 collectedDownloadTrend의 useMemo 의존성이므로 렌더마다 전체 기간 추이가 재계산된다.

## 판단 및 후속 우선순위

이번 측정에서는 순차 DB 호출로 인한 장시간 지연을 재현하지 못했다. 확인된 비용은 큰 초기 응답과 리뷰 조회다. 브라우저 Performance/Network 측정으로 전송·hydration·차트 갱신을 분리한 뒤, 리뷰 상세 지연 로딩 및 탭별 조회 분리를 검토한다. 리뷰를 단순히 적게 가져오면 평점·비율 집계가 달라지므로 집계와 상세 조회를 함께 설계해야 한다. 차트 인스턴스 재사용 및 날짜 범위 memoization도 별도로 검증할 개선 후보이다.

이번 점검에서는 애플리케이션 동작을 변경하지 않았다.
