현재 PR의 변경 코드를 리뷰하고 GitHub에 리뷰를 등록해줘.

## 동작

`gh` CLI와 GitHub API를 사용하여 코드를 분석하고 PR에 직접 리뷰를 등록한다.
기존 리뷰 코멘트와 중복되지 않는 항목만 등록한다.
MCP 없이 동작.

## 절차

### 1단계: PR 정보 조회

$ARGUMENTS 파싱:
- 숫자 또는 `#숫자` → 해당 PR 번호 사용
- `--approve` → 최종 이벤트를 APPROVE로
- `--request-changes` → 최종 이벤트를 REQUEST_CHANGES로
- 인자 없으면 현재 브랜치의 PR 자동 조회

```bash
gh pr view [<number>] --json number,title,headRefName,baseRefName,headRefOid,url
```

PR이 없으면 "`/workflow pr`로 먼저 PR을 생성하세요" 안내 후 종료.

레포 정보 조회:
```bash
gh repo view --json nameWithOwner
```

### 2단계: 기존 리뷰 코멘트 조회

PR에 이미 달린 인라인 코멘트와 리뷰 전체를 가져와:

```bash
# 인라인 코멘트 (모든 리뷰어의 것)
gh api repos/<owner>/<repo>/pulls/<number>/comments \
  --jq '[.[] | {path: .path, line: .line, body: .body, user: .user.login}]'

# 전체 리뷰 목록
gh api repos/<owner>/<repo>/pulls/<number>/reviews \
  --jq '[.[] | {id: .id, state: .state, body: .body, user: .user.login}]'
```

수집된 기존 코멘트를 내부적으로 보관해. 중복 판단에 사용한다.

### 3단계: 변경 코드 조회

```bash
gh pr diff [<number>]
```

### 4단계: 코드 리뷰 분석

diff를 분석하여 아래 항목을 검토해:

| 분류 | 검토 내용 |
|------|----------|
| 🔴 버그 | 잘못된 로직, null/undefined 미처리, 경계값 오류, off-by-one |
| 🔴 보안 | SQL/Command 인젝션, 인증 누락, 민감 정보 노출, 입력 검증 누락 |
| 🟡 성능 | 불필요한 루프, N+1 쿼리, 블로킹 I/O, 메모리 누수 가능성 |
| 🟡 타입 | TypeScript 타입 불일치, any 사용, 타입 캐스팅 위험 |
| 🔵 스타일 | 프로젝트 패턴과 불일치, 불필요한 복잡도, 네이밍 |
| 🔵 개선 | 더 나은 접근법, 테스트 추가 권장 |

각 이슈에 대해 파악해:
- 파일 경로 (`src/...`)
- 변경된 파일 기준 라인 번호 (diff의 `+` 라인 기준)
- 심각도: 🔴 CRITICAL / 🟡 WARNING / 🔵 INFO

### 5단계: 중복 제거

분석한 이슈와 2단계에서 수집한 기존 코멘트를 비교해서 중복을 제거해.

**중복 판단 기준 — 아래 조건 중 하나라도 해당하면 중복으로 간주:**

1. **같은 파일 + 같은 라인**에 이미 코멘트가 있고, **같은 주제**(null 체크, any 타입 등)를 언급함
2. 전체 리뷰 본문에서 이미 같은 문제를 지적한 내용이 있음 (키워드 기반 비교)

중복인 경우 해당 이슈를 등록 목록에서 제외하고 `(기존 코멘트 있음 — 생략)` 으로 표시.

### 6단계: 리뷰 결과 표시 및 등록 확인

분석 결과를 아래 형식으로 보여줘:

```
## 코드 리뷰 결과 — PR #{number}: {title}

### 🔴 CRITICAL ({n}건)
- `src/service/payment.service.ts:42` — null 체크 누락

### 🟡 WARNING ({n}건)
- `src/handler/withdraw.handler.ts:18` — any 타입 사용
- `src/handler/account.handler.ts:31` — ~~성능 이슈~~ (기존 코멘트 있음 — 생략)

### 🔵 INFO ({n}건)
- `src/domain/account.port.ts:5` — 인터페이스 분리 고려

---
신규 등록 예정: {n}건 / 중복 생략: {n}건
```

신규 등록할 이슈가 없으면 "새로운 리뷰 이슈 없음 (기존 리뷰에서 모두 다뤄짐)" 보고 후,
APPROVE 여부만 물어봐.

신규 이슈가 있으면 사용자에게 물어봐:

```
PR에 리뷰를 등록할까요? (신규 {n}건)
1) COMMENT — 코멘트만 달기
2) REQUEST_CHANGES — 변경 요청
3) APPROVE — 승인 (이슈 있어도 진행)
4) 취소
```

`--approve` 플래그가 있으면 APPROVE로, `--request-changes`가 있으면 REQUEST_CHANGES로 바로 진행.

### 7단계: GitHub PR에 리뷰 등록

사용자가 선택하면 **중복 제거된 이슈만** 등록:

**전체 리뷰 요약 본문 작성:**

```
## 코드 리뷰

{전체 요약 — 변경 목적 파악, 주요 이슈 요약}

### 이슈 현황
- 🔴 CRITICAL: {n}건
- 🟡 WARNING: {n}건
- 🔵 INFO: {n}건

{이슈 없으면: "특별한 이슈 없음. 깔끔한 코드입니다."}
```

**인라인 코멘트 JSON 구성 (신규 이슈만):**

```json
{
  "path": "src/service/payment.service.ts",
  "line": 42,
  "side": "RIGHT",
  "body": "🔴 **null 체크 누락**\n\n`result`가 null일 경우 TypeError 발생 가능합니다.\n\n```ts\nif (!result) throw new AppError('NOT_FOUND');\n```"
}
```

**GitHub API 호출:**

```bash
cat > /tmp/review_body.json << 'EOF'
{
  "commit_id": "<headRefOid>",
  "body": "<overall_summary>",
  "event": "<COMMENT|APPROVE|REQUEST_CHANGES>",
  "comments": [<신규_inline_comments만>]
}
EOF

gh api repos/<owner>/<repo>/pulls/<number>/reviews \
  --method POST \
  --input /tmp/review_body.json
```

등록 완료 후 결과 출력:

```
## 리뷰 등록 완료

PR: #{number} {title}
이벤트: {COMMENT|APPROVE|REQUEST_CHANGES}
신규 인라인 코멘트: {n}건
중복 생략: {n}건
URL: {pr_url}
```

## 오류 처리

| 상황 | 조치 |
|------|------|
| PR 없음 | `/workflow pr`로 먼저 PR 생성 안내 |
| `gh` 미설치 / 미인증 | `gh auth login` 안내 |
| 기존 코멘트 조회 실패 | 경고 후 중복 제거 없이 전체 등록 여부 확인 |
| 인라인 코멘트 API 실패 | 전체 리뷰 본문만으로 재시도 (인라인 제외) |
| diff 없음 | "변경된 코드가 없습니다" 안내 후 종료 |

## 사용 예시

- `/review` — 현재 브랜치 PR 코드 리뷰 (중복 제거 후 등록)
- `/review 42` — PR #42 코드 리뷰
- `/review --approve` — 리뷰 후 APPROVE
- `/review --request-changes` — 리뷰 후 변경 요청
