현재 PR의 변경 코드를 보안 관점에서 리뷰하고 GitHub에 리뷰를 등록해줘.
모든 출력은 한국어로 작성해.

## 동작

OWASP Top 10 및 블록체인/금융 서비스 보안 항목에 중점을 둔 리뷰를 수행한다.
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
gh repo view --json nameWithOwner
```

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

### 4단계: 보안 취약점 분석

diff를 분석하여 아래 항목을 검토해:

| 분류 | 검토 내용 |
|------|----------|
| 🔴 인젝션 | SQL/NoSQL/Command/LDAP 인젝션, 입력 미검증 |
| 🔴 인증/인가 | 인증 우회, 권한 검증 누락, 세션 처리 취약점 |
| 🔴 민감 정보 노출 | 개인키/시드/API키 하드코딩, 로그 노출, 응답에 민감 정보 포함 |
| 🔴 블록체인 | 정수 오버플로우, 재진입 공격 가능성, 서명 검증 누락, nonce 미검증 |
| 🟡 암호화 | 취약한 알고리즘, 평문 저장, 랜덤 생성 취약점 |
| 🟡 입력 검증 | 타입/범위/형식 검증 누락, 화이트리스트 미적용 |
| 🟡 에러 처리 | 스택트레이스 노출, 내부 구조 유출 가능성 |
| 🔵 의존성 | 알려진 취약점이 있는 패키지 버전 사용 |
| 🔵 로깅 | 보안 이벤트 미기록, 과도한 민감 정보 로깅 |

각 이슈에 대해 파악해:
- 파일 경로, 라인 번호
- 심각도: 🔴 CRITICAL / 🟡 WARNING / 🔵 INFO
- 취약점 유형 및 공격 시나리오
- 수정 방법

### 5단계: 중복 제거

2단계 기존 코멘트와 비교하여 이미 지적된 항목 제외.

### 6단계: 결과 표시 및 확인

```
## 보안 리뷰 결과 — PR #{번호}: {제목}

### 🔴 CRITICAL ({n}건)
- `src/service/withdraw.service.ts:55` — 개인키 로그 노출: logger.info()에 privateKey 포함

### 🟡 WARNING ({n}건)
- `src/handler/payment.handler.ts:22` — 입력 검증 누락: amount 음수 허용 가능

### 🔵 INFO ({n}건)
- `src/infra/config/env.ts:8` — API 키 환경변수 기본값 하드코딩 제거 권장

---
신규 등록 예정: {n}건 / 중복 생략: {n}건

PR에 리뷰를 등록할까요? (신규 {n}건)
1) COMMENT — 코멘트만 달기
2) REQUEST_CHANGES — 변경 요청
3) APPROVE — 보안 이슈 없음, 승인
4) 취소
```

보안 CRITICAL 이슈가 있으면 "보안 취약점이 발견되었습니다. REQUEST_CHANGES를 권장합니다" 라고 강조해줘.

### 7단계: GitHub PR에 리뷰 등록

**전체 리뷰 요약 (한국어):**

```
## 보안 리뷰

{변경 목적 파악 및 보안 관점 전반 평가 — 한국어}

### 보안 이슈 현황
- 🔴 CRITICAL: {n}건
- 🟡 WARNING: {n}건
- 🔵 INFO: {n}건

{이슈 없으면: "보안 취약점 없음. 안전한 코드입니다."}
```

**인라인 코멘트 (한국어):**

```json
{
  "path": "src/service/withdraw.service.ts",
  "line": 55,
  "side": "RIGHT",
  "body": "🔴 **민감 정보 로그 노출**\n\n`privateKey`가 로그에 출력되고 있습니다. 공격자가 로그에 접근하면 자산 탈취가 가능합니다.\n\n```ts\n// 수정 전\nlogger.info('처리 완료', { privateKey, txHash });\n\n// 수정 후\nlogger.info('처리 완료', { txHash });  // 민감 정보 제외\n```"
}
```

```bash
cat > /tmp/security_review.json << 'EOF'
{
  "commit_id": "<headRefOid>",
  "body": "<전체_요약_한국어>",
  "event": "<COMMENT|APPROVE|REQUEST_CHANGES>",
  "comments": [<신규_인라인_코멘트만>]
}
EOF

gh api repos/<owner>/<repo>/pulls/<number>/reviews \
  --method POST \
  --input /tmp/security_review.json
```

완료 후 출력:

```
## 보안 리뷰 등록 완료

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

## 사용 예시

- `/security-review` — 현재 브랜치 PR 보안 리뷰
- `/security-review 42` — PR #42 보안 리뷰
- `/security-review --approve` — 보안 이슈 없음, 승인
- `/security-review --request-changes` — 보안 취약점 발견, 변경 요청
