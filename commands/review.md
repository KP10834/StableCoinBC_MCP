현재 PR의 변경 코드를 리뷰하고 GitHub에 리뷰를 등록해줘.
모든 출력은 한국어로 작성해.

## 동작

버그, 보안, 성능, 타입, 스타일을 종합적으로 검토한다.
기존 리뷰 코멘트와 중복되지 않는 항목만 등록한다.
모든 코멘트에는 반드시 개선방안을 포함한다.
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
gh repo view --json nameWithOwner
```

PR이 없으면 "`/workflow pr`로 먼저 PR을 생성하세요" 안내 후 종료.

### 2단계: 기존 리뷰 코멘트 조회

```bash
gh api repos/<owner>/<repo>/pulls/<number>/comments \
  --jq '[.[] | {path: .path, line: .line, body: .body, user: .user.login}]'

gh api repos/<owner>/<repo>/pulls/<number>/reviews \
  --jq '[.[] | {state: .state, body: .body, user: .user.login}]'
```

### 3단계: 변경 코드 조회

```bash
gh pr diff [<number>]
```

### 4단계: 코드 분석

diff를 분석하여 아래 항목을 검토해:

| 분류 | 검토 내용 |
|------|----------|
| 🔴 버그 | 잘못된 로직, null/undefined 미처리, 경계값 오류, off-by-one |
| 🔴 보안 | 인젝션, 인증 누락, 민감 정보 노출, 입력 검증 누락 |
| 🟡 성능 | 불필요한 루프, N+1 쿼리, 블로킹 I/O, 메모리 누수 |
| 🟡 타입 | TypeScript 타입 불일치, any 사용, 타입 캐스팅 위험 |
| 🔵 스타일 | 프로젝트 패턴과 불일치, 불필요한 복잡도, 네이밍 |
| 🔵 개선 | 더 나은 접근법, 테스트 추가 권장 |

### 5단계: 중복 제거

2단계 기존 코멘트와 비교하여 이미 지적된 항목 제외.

### 6단계: 결과 표시

```
## 코드 리뷰 결과 — PR #{번호}: {제목}

### 🔴 CRITICAL ({n}건)
- `src/service/payment.service.ts:42` — null 체크 누락

### 🟡 WARNING ({n}건)
- `src/handler/withdraw.handler.ts:18` — any 타입 사용
- `src/handler/account.handler.ts:31` — ~~성능 이슈~~ (기존 코멘트 있음 — 생략)

### 🔵 INFO ({n}건)
- `src/domain/account.port.ts:5` — 인터페이스 분리 고려

---
신규 등록 예정: {n}건 / 중복 생략: {n}건

PR에 리뷰를 등록할까요? (신규 {n}건)
1) COMMENT — 코멘트만 달기
2) REQUEST_CHANGES — 변경 요청
3) APPROVE — 승인
4) 취소
```

`--approve` / `--request-changes` 플래그가 있으면 해당 이벤트로 바로 확인.

### 7단계: GitHub PR에 리뷰 등록

**전체 리뷰 요약 본문:**

```
## 코드 리뷰

{변경 목적 파악 및 전반적인 평가}

### 이슈 현황
- 🔴 CRITICAL: {n}건
- 🟡 WARNING: {n}건
- 🔵 INFO: {n}건
```

**인라인 코멘트 형식 — 모든 코멘트에 개선방안 필수:**

```
{심각도 이모지} **{이슈 제목}**

**문제:** {무엇이 왜 문제인지 설명}

**개선방안:**
\`\`\`ts
// 수정 예시 코드
\`\`\`
```

**GitHub API 호출:**

```bash
cat > /tmp/review.json << 'EOF'
{
  "commit_id": "<headRefOid>",
  "body": "<전체_요약>",
  "event": "<COMMENT|APPROVE|REQUEST_CHANGES>",
  "comments": [<신규_인라인_코멘트만>]
}
EOF

gh api repos/<owner>/<repo>/pulls/<number>/reviews \
  --method POST \
  --input /tmp/review.json
```

**완료 출력:**

```
## 리뷰 등록 완료

PR: #{번호} {제목}
이벤트: {COMMENT|APPROVE|REQUEST_CHANGES}
신규 인라인 코멘트: {n}건
중복 생략: {n}건
URL: {pr_url}
```

## 오류 처리

| 상황 | 조치 |
|------|------|
| PR 없음 | `/workflow pr`로 먼저 PR 생성 안내 |
| `gh` 미인증 | `gh auth login` 안내 |
| 기존 코멘트 조회 실패 | 경고 후 중복 제거 없이 진행 여부 확인 |
| 인라인 코멘트 API 실패 | 전체 리뷰 본문만으로 재시도 |
| diff 없음 | "변경된 코드가 없습니다" 안내 후 종료 |

## 사용 예시

- `/review` — 현재 브랜치 PR 코드 리뷰
- `/review 42` — PR #42 코드 리뷰
- `/review --approve` — 리뷰 후 승인
- `/review --request-changes` — 리뷰 후 변경 요청
