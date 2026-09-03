# GA4 활성 사용자 지표 설계

## 목적

스토어 누적 다운로드와 실제 앱 사용 규모를 분리한다. 모바일인사이트의 대표 사용 지표는 GA4의 1일, 7일, 28일 활성 사용자이며 Android와 iOS를 동일한 GA4 속성의 `platform` 차원으로 나누어 표시한다.

## 데이터 모델

`daily_metrics`에 다음 nullable 정수 컬럼을 추가한다.

- `active_1d_users`
- `active_7d_users`
- `active_28d_users`
- `sessions`

기존 `(app_id, platform, date)` 유니크 키를 그대로 사용한다. 스토어 동기화와 GA4 동기화가 서로 다른 시점에 실행되므로 upsert는 null 값을 기존 값 위에 덮어쓰지 않는다.

## 인증과 설정

앱별 GA4 설정은 `store-config.ts`에서 관리한다. WTC는 기존 `GOOGLE_WTC_SERVICE_ACCOUNT_JSON`을 재사용하고 `GA4_WTC_PROPERTY_ID`만 추가한다. 서비스 계정은 해당 GA4 속성의 Viewer 권한을 가져야 하며 Google Analytics Data API가 활성화되어 있어야 한다.

설정이 없는 앱은 GA4 수집을 건너뛰며 스토어 동기화는 계속 수행한다. 설정은 존재하지만 값 또는 권한이 잘못된 경우 동기화 결과에 analytics 오류를 기록한다.

## 수집 흐름

GA4 Data API `runReport`를 REST로 호출한다. 차원은 `date`, `platform`, 지표는 `active1DayUsers`, `active7DayUsers`, `active28DayUsers`, `sessions`를 사용한다.

- 일반 동기화: 최근 35일을 다시 조회해 지연 도착과 집계 보정을 반영한다.
- 백필: 기본 1년 범위를 조회한다.
- `Android`, `iOS`만 저장하고 Web 등 다른 플랫폼은 무시한다.
- `YYYYMMDD` 날짜를 `YYYY-MM-DD`로 정규화한다.

스토어 수집 실패와 GA4 수집 실패는 서로 독립적이다. 한쪽 데이터는 다른 쪽 오류 때문에 버리지 않는다.

## 대시보드

상단 KPI에 `28D ACTIVE USERS`를 추가하고 전체값과 Android/iOS 분할을 표시한다. 전체값은 같은 날짜의 플랫폼 값을 합산하되 데이터가 없는 플랫폼은 0으로 위조하지 않고 부분 데이터임을 표시한다.

활성 사용자 추이 섹션에는 선택 기간의 28일 활성 사용자 시계열을 Android, iOS, 합계로 표시한다. 기존 다운로드 추이는 유지한다.

## 오류와 한계

- Firebase/GA4 지표는 현재 설치 수가 아니라 최근 실제 활동 사용자다.
- User-ID가 없다면 앱 인스턴스 기준 식별이 포함되어 동일인이 여러 기기에서 중복될 수 있다.
- API 권한 오류는 동기화 로그에 남기고 기존 정상 데이터를 보존한다.
- GA4 설정 전 과거 데이터가 이미 수집되어 있으면 백필할 수 있지만, Firebase SDK 적용 이전의 데이터는 생성되지 않는다.

## 검증

- GA4 응답 파싱과 플랫폼/날짜 정규화 단위 테스트
- null 보존 upsert 테스트
- 최신 28일 활성 사용자 및 플랫폼 합산 대시보드 테스트
- 전체 테스트, 타입 검사, ESLint, Next.js 빌드
