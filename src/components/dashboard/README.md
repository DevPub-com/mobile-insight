# Dashboard 프론트 구조

`dashboard-shell.tsx`가 진입점이다. 개별 화면은 `views/`, 여러 화면에서 재사용하는 UI는 `shared/`와 `charts/`에서 찾는다.

```text
dashboard/
├── dashboard-shell.tsx   # 화면 조합 및 조건부 표시
├── layout/               # 헤더, 사이드바, 앱·기간 선택, 동기화 버튼, 메뉴 정의
├── shared/               # 공통 지표·리뷰 표시, 패널 헤더, 플랫폼·품질 UI
├── charts/               # ECharts 래퍼와 공통 미니 차트
├── hooks/                # 대시보드 상태, 조회, 리뷰 페이지, 크래시 조회
├── utils/                # 숫자·평점·증감·날짜 표시 함수
└── views/
    ├── overview/         # 대시보드 요약과 차트·리뷰·배포 영향 패널
    ├── reviews/          # 평점·리뷰·키워드 분석
    ├── releases/         # 릴리스 목록과 타임라인
    ├── impact/           # 배포 전후 영향 분석
    ├── acquisition/      # 사용자·다운로드·획득 분석
    └── apps/             # 앱 및 스토어 연결 관리
```

- 특정 화면에서만 사용하는 UI는 그 화면의 `views/` 폴더에 둔다. 여러 화면에서 재사용할 때 공통 폴더로 옮긴다.
- `hooks/use-dashboard-model.ts`는 탭 간에 유지하는 상태와 기존 집계 호출을 관리한다. 집계 규칙 자체는 `src/domain`과 `src/services/mobile`에 둔다.
- 기본 UI primitive는 `src/components/ui/dp`, 공통 테마와 CSS는 `src/styles`에 있다.
- 불필요한 barrel 파일 없이 실제 파일을 직접 import한다.

## DP와 HTML 사용 기준

| 역할 | 사용 방식 |
| --- | --- |
| 행·열·정렬 구성 | `DpLayout direction="row"` 또는 기본 세로 배치 |
| 격자 구성 | `DpLayout display="grid"`, 열 수와 반응형 규칙은 해당 영역 CSS |
| 제목·본문·지표·보조 문구 | `DpText`, 원래 의미에 맞게 `as="h3"`, `as="span"` 등 지정 |
| 버튼·카드 | `DpButton`, `DpCard` |
| 차트 마운트, 스크롤·단순 래퍼 | 기본 `div` 유지 |
| 아이콘·별점·색상 표식·스켈레톤 | 기본 HTML 유지 |
| 표·목록·입력·접기 등 고유 의미가 있는 요소 | `table`, `ul`, `input`, `details`, `summary` 등 유지 |

- 기존 DP의 기본 스타일은 그대로다. `DpText` 기본 줄바꿈은 `keep`이며, 기존 화면의 상속된 줄바꿈을 보존할 때 `wrap="inherit"`를 명시한다.
- `DpButton`·`DpCard`의 `variant="custom"`은 필터·날짜 선택·히트맵·AI 카드처럼 기존 영역 CSS가 디자인을 담당하는 경우에 사용한다. 기본 DP의 크기·여백·배치를 덧씌우지 않는다. 일반적인 새 UI에는 기본 variant를 우선 사용한다.
- `DpLayout display="grid"`에는 flex 방향·기본 정렬을 강제하지 않는다. 필요하면 `align`·`justify`를 명시한다.
- 로딩 화면의 스켈레톤과 접근성용 시각 숨김 요소는 HTML로 유지한다.
- 기존 `components/ui/button.tsx`는 오류 화면의 스타일/API 호환용이며, 실제 버튼 렌더링은 `DpButton`에 위임한다.
