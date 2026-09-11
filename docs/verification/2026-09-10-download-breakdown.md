# 다운로드 탭 모델별 분석

## 변경

- 모델별 다운로드·설치 상세, 설치 상위/하위 5개, 모델 검색과 설치 수 정렬을 추가했다.
- Google Play `_device.csv`의 Daily User Installs와 Daily Device Installs를 구분한다. 활성 사용자 수를 설치 수로 사용하지 않는다.
- 모델 미확인 항목은 상세 표에 남기고 순위에서는 제외한다. 0건은 하위 순위에 포함하고 미수집은 제외한다.
- OS 점유율은 선택 기간 앱 다운로드의 Android/iOS 비율이다. 어느 쪽이 미수집이거나 합계가 0이면 비율을 표시하지 않는다.
- iOS 기종별 설치 수집은 구현하지 않았으며 화면에 미수집으로 명시했다.

## 저장 및 동기화

기종별 시계열은 기존 관측 테이블에 `device_downloads:` + JSON `[모델, 측정값 종류]` 키로 저장한다. 전체 다운로드 키와 구분하며 스키마 변경은 없다. 대량 저장은 500개씩 나눠 처리한다. 대시보드 응답에서는 기종 관측을 일반 지표에서 분리해 기존 지표 계산이 수만 건의 기종 데이터를 반복 탐색하지 않도록 했다.

일반 동기화는 최신 보고서, backfill은 모든 보고서를 읽는다. 기종 데이터만 동기화하려면 `node --import tsx scripts/sync-model-downloads.ts`를 사용한다. `--all`, `--app=kis` 옵션을 지원한다.

실제 실행 결과: `kis: 42468 model observations saved (newest).` 이는 설치 건수가 아니라 일자·모델·측정값별 저장 레코드 수다.

## 검증

- 타입 검사 통과.
- 신규 집계·렌더링 테스트 6개 통과, 기존 repository 계약 테스트 1개 통과.
- 변경 파일 ESLint 통과.
- 전체 테스트 실행: 256개 통과, 기존 아이콘 검사 1개 실패. `koboyo-icons.test.ts`가 현재 메뉴에서 제거된 `name="settings"`를 요구한다. 이번 다운로드 추가는 해당 메뉴를 변경하지 않았다.
- 로컬 브라우저의 다운로드 탭에서 1,080개 모델 표시와 상위·하위 순위를 확인했다. `Galaxy S26` 검색 시 3개 결과를 확인하고 검색을 초기화했다.
- 확인 당시 선택 기간은 2026-08-11~2026-09-09이며 연결된 다운로드는 8월 21일까지 수집되어 있었다. iOS 미수집에 따라 OS 비율은 대기로 표시됐다.
- 배포는 수행하지 않았다.

## 출처

- [Google Play 보고서 규격](https://support.google.com/googleplay/android-developer/answer/6135870?hl=en)
- `src/services/google/google-device-installs.ts`
- `src/services/mobile/tabs/download-breakdown.service.ts`
- `src/components/dashboard/download-models.tsx`
- `src/components/dashboard/download-os-share.tsx`
