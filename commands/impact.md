멀티 레포 코드 변경의 영향 범위를 분석해줘.

## 동작

`cross-impact-mcp`의 도구들을 사용하여 GitHub API 기반으로 원격 레포 간 영향을 분석한다.

## 절차

$ARGUMENTS 파싱:
- 첫 번째 인자 → `repo` (분석할 레포 이름. 예: adapter, backend)
- 두 번째 인자 → `head` (비교할 브랜치. 예: feature/abc)
- `--base <branch>` → `base` (기준 브랜치. 생략 시 레포별 기본 브랜치)
- 인자 없으면 → 먼저 `cross_impact_repos`로 등록된 레포 목록을 보여주고 선택하게 해

### 1단계: 변경 파일 조회

`cross_impact_changes` 도구를 호출해:
- `repo`, `head`, `base` 전달
- 변경 파일 목록과 영향받는 Kafka 연결 지점 확인

### 2단계: 연결 지점 비교

1단계에서 `affectedTopics`가 있으면, 각 토픽에 대해 `cross_impact_compare` 도구를 호출해:
- 양쪽 레포의 관련 코드를 비교
- 필드명, 타입, required/optional 불일치 확인

### 3단계: 영향 분석 리포트

아래 심각도 기준으로 분류해서 리포트를 생성해:

| 심각도 | 기준 |
|--------|------|
| **CRITICAL** | 배포 시 즉시 에러 — 필드명 변경, 필수 필드 누락, 타입 불일치 |
| **WARNING** | 동작하지만 데이터 유실 가능 — 새 필드 무시됨, 선택 필드 변경 |
| **INFO** | 문서 업데이트 필요 — AsyncAPI 불일치 |

## 출력 형식

```markdown
# Cross-Repo 영향 분석

## 변경 범위
- 프로젝트: {repo}
- 비교: {base} -> {head}
- 변경 파일 수: N개
- 연결 지점 변경: N개

## 영향 분석 결과

### CRITICAL
| 대상 프로젝트 | 파일 | 내용 | 조치 |
|-------------|------|------|------|

### WARNING
| 대상 프로젝트 | 파일 | 내용 | 조치 |
|-------------|------|------|------|

### INFO
| 대상 프로젝트 | 파일 | 내용 | 조치 |
|-------------|------|------|------|

## 요약
- CRITICAL: N건
- WARNING: N건
- INFO: N건
```

## 사용 예시

- `/impact adapter feature/new-field` — adapter 레포의 feature/new-field 브랜치 분석
- `/impact backend fix/schema-update --base develop` — develop 기준으로 비교
- `/impact` — 등록된 레포 목록 표시
