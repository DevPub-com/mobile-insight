# 프론트 공통화 및 컴포넌트 분리 검증

검증일: 2026-09-21. 기존 UI와 데이터 동작을 유지하는 구조 개선이다.

## 변경 내용

- `dashboard-shell.tsx`: 1,632줄에서 158줄로 축소. 화면 조합과 탐색 구조를 담당한다.
- `use-dashboard-model.ts`: 기존 상태, 기간·리뷰 필터, 집계 함수 호출, 추가 조회 observer를 그대로 이동했다. 탭 간 필터 유지와 바로가기 동작을 보존하기 위해 공유 상태는 이 hook에 둔다.
- 화면 영역: sidebar/header, dashboard summary/charts/review/impact panels, review highlights/analytics/list, releases, app management로 분리했다. 다운로드와 릴리스 영향 분석은 기존 컴포넌트를 계속 사용한다.
- 공통 UI: `dashboard-presentation.tsx`의 지표·증감·카드 제목·리뷰 표시, `dashboard-panel-header.tsx`의 반복 패널 헤더를 재사용한다. 기존 Dp primitive를 유지했다.
- 표시 함수: `dashboard-formatters.ts`로 숫자·평점·증감·날짜 표시를 분리했다. null, 반올림, 단위, 시간대 규칙은 유지했다.
- 테마: `src/styles/theme.css`로 기존 색상과 폰트·radius 토큰을 모았다. `globals.css`는 theme/base/dashboard/release-impact/dashboard-refinements를 순서대로 불러온다. 기존 cascade와 반응형 덮어쓰기 순서를 유지했다. 값이 같은 테마 색상과 radius를 변수로 연결했다.
- 차트: `EChart`는 mount에서 생성, option 변경 시 `setOption`, unmount에서 observer 해제와 dispose를 수행한다. 워드클라우드도 인스턴스를 유지하고 최신 데이터·선택 callback을 사용한다.
- 기존 소스 기반 디자인 테스트는 분리된 파일과 CSS import를 따라 읽도록 조정했다. 증감 표시 검사는 문자열 위치 대신 실제 함수 결과를 검증한다.

API, DB schema, 수집 서비스와 도메인 집계 구현은 수정하지 않았다. 새로운 의존성은 추가하지 않았다.

## 검증 결과

| 검증 | 결과 |
| --- | --- |
| 변경 전 기준선 | Vitest 90개 파일, 484개 테스트 통과 |
| 변경 후 전체 테스트 | Vitest 90개 파일, 484개 테스트 통과 |
| lint | 오류·경고 없음 |
| typecheck | 통과 |
| production build | Node 24.5.0, `next build --webpack` 통과 |
| 화면 마크업 비교 | 6개 화면 × 일반/빈 데이터 = 12개 SSR 결과의 SHA-256이 변경 전과 동일 |
| CSS 비교 | 테마 변수를 해석한 3,270개 선언의 선택자·조건·속성·값·important·적용 순서 동일 |
| 브라우저 화면 비교 | Chrome, 1440px·390px, 메뉴 5개 화면의 텍스트와 section/article/heading/button 위치·크기·색상·폰트 크기 동일 |
| 브라우저 오류 | 비교 화면의 pageerror 없음 |
| 차트 생명주기 | 일반 차트·워드클라우드의 갱신 전후 instance ID 동일, 최신 값/키워드 선택 반영, resize 반영, unmount dispose, 재mount 확인 |
| diff whitespace | `git diff --check` 통과 |

브라우저 비교는 데모 데이터를 사용하고 API 요청을 테스트 응답으로 대체했다. CSS transition/animation의 중간 시점 차이는 비교에서 제외했다. 실제 운영 DB·외부 API의 종단 간 검증이나 성능 수치 측정은 수행하지 않았다. 워드클라우드는 임의 배치 특성 때문에 픽셀 동일성을 주장하지 않으며, 데이터와 이벤트 및 인스턴스 생명주기를 검증했다.

SSR 비교와 브라우저 검증용 임시 페이지·원본 사본은 검증 후 제거했다. 기존 실행 중인 개발 서버는 종료하지 않았고, build가 갱신한 `next-env.d.ts`는 변경 전 상태로 복원했다. 커밋·푸시는 수행하지 않았다.

## 후속 폴더 정리

대시보드 파일 61개를 `layout`, `shared`, `charts`, `hooks`, `utils`, `views` 및 통합 검증용 `__tests__`로 이동했다. `views`는 overview/reviews/releases/impact/acquisition/apps로 구분한다. 개별 테스트는 대상 컴포넌트 옆에 둔다. 폴더별 책임은 `src/components/dashboard/README.md`에 기록했다.

이번 변경은 파일 이동, import·mock·소스 읽기 경로 갱신과 구조 안내 문서 추가에 한정한다. 기존 UI 마크업, 스타일, 데이터 처리 로직은 수정하지 않았다. 이동 후에도 90개 테스트 파일의 484개 테스트, lint, typecheck, production build와 `git diff --check`가 통과했다. 폴더 이동 후 브라우저 시각 비교는 반복하지 않았다.

## 후속 요청: 테스트 코드 삭제

사용자 요청으로 테스트 파일 91개(Vitest 90개, Node 테스트 1개), Vitest 설정, 테스트 전용 보조 코드와 빈 테스트 폴더를 제거했다. `test`·`test:watch` 스크립트와 테스트 전용 의존성 `vitest`·`@electric-sql/pglite`도 제거하고 lockfile 및 현재 README 안내를 갱신했다. 위의 테스트 통과 결과는 삭제 전 검증 기록이다. 앱 실행 코드와 남아 있는 의존성 버전은 변경하지 않았다.

삭제 후 lint·typecheck·production build와 `git diff --check`가 통과했다.

## 후속 요청: DP 사용 기준 적용

대시보드의 실제 flex/grid 영역은 `DpLayout`, 제목·본문·지표는 `DpText`, 버튼과 카드는 `DpButton`·`DpCard`로 통일했다. 오류·설정 안내의 텍스트도 `DpText`로 정리했다. 차트 마운트, 스크롤·단순 래퍼, 장식·스켈레톤, 표·입력·접기 요소는 의미에 맞는 HTML을 유지한다.

기존 UI 보존을 위해 다음 옵션을 추가했다. 기존 DP의 기본값은 변경하지 않았다.

- `DpLayout display="grid" | "inline-flex"`: 실제 레이아웃 종류를 명시하고 grid에는 flex 기본 방향·정렬을 강제하지 않는다.
- `DpText wrap="inherit"`: 기존 텍스트의 상속된 줄바꿈을 유지한다.
- `DpButton`·`DpCard variant="custom"`: 기존 영역 CSS가 담당하는 크기·여백·스타일을 유지한다.
- 기존 `Button`은 API·스타일 호환 wrapper로 유지하며 `DpButton`에 렌더링을 위임한다.

Chrome 1440px·390px에서 5개 메뉴, 리뷰 필터, 기간 선택/적용 등 16개 화면 상태를 변경 전과 비교했다. AI 분석 성공 결과 및 커스텀 로그 상세도 별도 모의 데이터로 비교했다. 텍스트·요소 수·크기·색상·폰트·여백은 동일했으며, 일부 인라인 텍스트의 x 좌표에만 최대 0.02 CSS px 차이가 관측되었다(비교 허용치 0.05px). 브라우저 pageerror는 없었다. 실서비스 DB/API는 호출하지 않고 모의 응답을 사용했다.

lint·typecheck·production build와 `git diff --check`가 통과했다. 테스트 코드·의존성은 다시 추가하지 않았으며, 임시 비교용 원본 사본·페이지는 제거했다. 사용 기준은 `src/components/dashboard/README.md`에 기록했다.
