# 리팩토링 제안 & 린트/타입 자동 수정 설계

## 개요

qa-mcp에 두 개의 도구를 추가하고, 각각에 대응하는 slash command를 작성한다.

---

## 구현 범위

### 1. `qa_refactor_check` (qa-mcp 도구)

**목적:** 현재 브랜치 변경 파일을 분석용 데이터로 반환

**입력:**
- `base` (string, optional) — 비교 기준 브랜치. 기본값: `BASE_BRANCH` 환경변수

**동작:**
1. `git diff <base>...HEAD --name-only`로 변경 파일 목록 추출
2. 각 파일의 현재 내용 읽기
3. `git diff <base>...HEAD -- <file>`로 파일별 diff 추출

**출력:**
```json
{
  "base": "dev",
  "files": [
    { "path": "src/...", "content": "...", "diff": "..." }
  ]
}
```

---

### 2. `qa_lint_fix` (qa-mcp 도구)

**목적:** eslint 자동 수정 실행 후 tsc 타입 에러 반환

**입력:** 없음

**동작:**
1. `eslint --fix src/` 실행 — 자동 수정 가능한 항목 처리
2. `tsc --noEmit` 실행 — 타입 에러 수집
3. 결과 구조화하여 반환

**출력:**
```json
{
  "eslint": {
    "fixed": ["수정된 파일 경로 목록"],
    "output": "eslint 실행 로그"
  },
  "tsc": {
    "errors": [
      { "file": "src/...", "line": 42, "message": "Type 'string' is not assignable..." }
    ],
    "errorCount": 3
  }
}
```

---

### 3. `/refactor` slash command

**흐름:**
1. `qa_refactor_check` 호출
2. 반환된 파일 목록과 diff를 분석
3. 리팩토링 제안 목록 제시 (중복 제거, 패턴 적용, 책임 분리 등)
4. 사용자 승인 확인
5. 승인된 항목 코드 수정 적용

**옵션:**
- `--base <branch>` — 비교 기준 브랜치 지정

---

### 4. `/lint-fix` slash command

**흐름:**
1. `qa_lint_fix` 호출
2. eslint 자동 수정 결과 보고
3. tsc 에러가 있으면 파일별로 분석하여 수정 제안
4. 수정 적용

---

## 파일 변경 목록

| 파일 | 변경 유형 |
|------|---------|
| `mcp/qa-mcp/index.js` | `qa_refactor_check`, `qa_lint_fix` 도구 추가 |
| `commands/refactor.md` | 신규 생성 |
| `commands/lint-fix.md` | 신규 생성 |

---

## 에러 처리

- 변경 파일 없음 → "변경된 파일이 없습니다" 반환
- eslint 미설치 → eslint 결과 skip, tsc만 실행
- tsc 에러 없음 → "타입 에러 없음" 보고
