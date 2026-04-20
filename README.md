# StableCoinBC MCP

StableCoin 프로젝트 개발에 필요한 MCP 서버와 Claude Code 슬래시 커맨드 모음.

Claude Code에서 자연어로 인프라 조회, 테스트 자동화, GitHub 워크플로우, 문서 동기화를 처리할 수 있다.

---

## 사전 요구사항

- **Node.js** 18 이상
- **Claude Code** CLI
- **gh CLI** — GitHub 연동 커맨드 사용 시 (`workflow-mcp`, `cross-impact-mcp`)
  ```bash
  gh auth login
  ```

---

## 빠른 시작

### 1. 패키지 설치

```bash
npm install git+https://github.com/KP10834/StableCoinBC_MCP.git --save-dev
```

### 2. 설정 파일 생성

```bash
npx mcp-setup
```

`.mcp.json`과 `.claude/commands/`가 자동 생성된다.

### 3. 환경변수 설정

`.mcp.json`을 열어 프로젝트 환경에 맞게 수정:

```json
{
  "mcpServers": {
    "kafka-mcp": {
      "env": { "KAFKA_BROKERS": "10.6.2.100:9092" }
    },
    "redis-mcp": {
      "env": { "REDIS_HOST": "10.6.2.100", "REDIS_PORT": "6379" }
    },
    "evm-mcp": {
      "env": { "EVM_RPC_URL": "http://10.6.2.100:8545" }
    },
    "elk-mcp": {
      "env": {
        "ES_URL": "http://10.6.2.100:9200",
        "ES_API_KEY": "your-api-key"
      }
    },
    "cross-impact-mcp": {
      "env": {
        "GITHUB_TOKEN": "ghp_xxxx",
        "REPOS": "{\"adapter\":\"StableCoinTF/StableCoinBC_Adapter\",\"listener\":\"StableCoinTF/StableCoinBC_Adapter_Listener\"}"
      }
    },
    "topic-gen-mcp": {
      "env": { "BOARD_DIR": "/absolute/path/to/StableCoinBC_Adapter_Board" }
    }
  }
}
```

> `workflow-mcp`, `qa-mcp`, `sqlite-mcp`는 환경변수 없이 바로 사용 가능.

### 4. Claude Code 재시작

`.mcp.json` 적용을 위해 Claude Code를 재시작한다.

---

## 업데이트

새 버전 반영 시:

```bash
npm install git+https://github.com/KP10834/StableCoinBC_MCP.git --save-dev
npx mcp-setup
```

---

## MCP 서버

Claude Code 채팅창에서 자연어로 요청하면 자동으로 해당 MCP 도구를 호출한다.

### 인프라 조회

| 서버 | 용도 | 환경변수 | 상세 |
|------|------|---------|------|
| `kafka-mcp` | 토픽 목록, 메시지 발행/소비, 오프셋 조회 | `KAFKA_BROKERS` | [docs](docs/mcp/kafka-mcp.md) |
| `redis-mcp` | 키 조회/삭제, 락 상태, TTL | `REDIS_HOST`, `REDIS_PORT` 등 | [docs](docs/mcp/redis-mcp.md) |
| `sqlite-mcp` | DB 테이블/데이터 조회 (읽기 전용) | `DATA_DIR` | [docs](docs/mcp/sqlite-mcp.md) |
| `evm-mcp` | EVM RPC 호출 (잔액, 논스, 트랜잭션) | `EVM_RPC_URL` | [docs](docs/mcp/evm-mcp.md) |
| `elk-mcp` | Elasticsearch 로그 검색, 요청 추적, 에러 분석 | `ES_URL`, `ES_API_KEY` | [docs](docs/mcp/elk-mcp.md) |

**사용 예시** (채팅창에 그냥 입력):

```
"adapter.payment.request 토픽 최근 메시지 보여줘"
"bc-adapter:nonce:* 패턴 Redis 키 조회해줘"
"payment 테이블 최근 10건 보여줘"
"0xABC... 주소 잔액 확인해줘"
"오늘 withdraw 서비스 에러 로그 검색해줘"
```

### 자동화

| 서버 | 용도 | 환경변수 | 상세 |
|------|------|---------|------|
| `workflow-mcp` | 이슈→브랜치→커밋→PR 워크플로우 | `GITHUB_REPO` (자동 감지 가능) | [docs](docs/mcp/workflow-mcp.md) |
| `qa-mcp` | 브랜치 자동 테스트 (빌드→실행→Kafka 테스트) | 프로젝트 `.env` 자동 로드 | [docs](docs/mcp/qa-mcp.md) |
| `cross-impact-mcp` | 멀티 레포 변경 영향 분석 | `GITHUB_TOKEN`, `REPOS` | [docs](docs/mcp/cross-impact-mcp.md) |
| `topic-gen-mcp` | Kafka 토픽 스켈레톤 생성, ABI↔ChainReader 동기화 | `BOARD_DIR` | [docs](docs/mcp/topic-gen-mcp.md) |

#### cross-impact-mcp REPOS 설정

분석 대상 레포를 JSON 문자열로 지정:

```json
"REPOS": "{\"adapter\":{\"repo\":\"StableCoinTF/StableCoinBC_Adapter\",\"base\":\"dev\"},\"listener\":{\"repo\":\"StableCoinTF/StableCoinBC_Adapter_Listener\",\"base\":\"develop\"}}"
```

키는 `/impact` 커맨드에서 레포 이름으로 사용된다 (예: `/impact adapter feature/new-field`).

---

## Slash Commands

`/커맨드명`으로 실행. Claude Code 채팅창에서 입력하면 된다.

| 커맨드 | 용도 |
|--------|------|
| `/workflow` | 이슈→브랜치→커밋→PR 워크플로우 자동화 |
| `/qa` | 현재 브랜치 변경 핸들러 자동 테스트 |
| `/impact` | 멀티 레포 변경 영향 분석 |
| `/release-note` | Conventional Commits 기반 릴리즈 노트 생성 |
| `/lint-fix` | ESLint 자동 수정 + tsc 타입 에러 분석·수정 |
| `/refactor` | 변경 코드 리팩토링 제안 및 적용 |
| `/sync-docs` | 코드 Zod 스키마 ↔ AsyncAPI YAML 동기화 |

---

## 사용 예시

### /workflow — 개발 워크플로우

새 기능 작업부터 PR까지:

```
# 이슈 생성 + 브랜치 자동 생성 + 체크아웃
/workflow create 출금 요청 시 잔액 부족 에러 처리 추가 --type feat

# 기존 이슈로 작업 시작 (브랜치가 없으면 생성, 있으면 체크아웃)
/workflow start 42

# 현재 작업 상태 확인 (브랜치 / 이슈 / 변경파일 / PR 상태)
/workflow status

# 커밋 (메시지 자동 분석, 이슈 번호 자동 추가)
/workflow commit 잔액 부족 시 INSUFFICIENT_BALANCE 에러 반환

# 메시지 없이 쓰면 diff 분석 후 메시지 제안
/workflow commit

# push + PR 생성 (이슈 자동 연결, 본문 자동 작성)
/workflow pr

# 드래프트 PR
/workflow pr --draft
```

---

### /qa — 브랜치 자동 테스트

```
# 변경된 핸들러만 자동 감지 후 테스트
/qa

# 전체 핸들러 회귀 테스트
/qa --all

# 빌드 생략
/qa --skip-build

# 기준 브랜치 직접 지정
/qa --base dev

# 테스트 후 서비스 유지 (수동 확인용)
/qa --keep-alive
```

---

### /impact — 멀티 레포 영향 분석

```
# adapter 레포의 feature/new-payment-field 브랜치가 다른 레포에 미치는 영향
/impact adapter feature/new-payment-field

# 기준 브랜치 직접 지정
/impact adapter feature/new-field --base main

# 인자 없이 실행하면 등록된 레포 목록 표시
/impact
```

결과는 심각도별로 분류됨:
- **CRITICAL** — 배포 시 즉시 에러 (필드명 변경, 필수 필드 누락 등)
- **WARNING** — 데이터 유실 가능 (새 필드 무시 등)
- **INFO** — 문서 업데이트 필요

---

### /release-note — 릴리즈 노트

```
# 최근 태그부터 HEAD까지 자동 생성
/release-note

# 특정 태그부터 HEAD
/release-note v1.0.0

# 태그 간 범위
/release-note v1.0.0..v1.1.0

# 커밋 목록 테이블
/release-note commits

# 태그 목록 조회
/release-note tags
```

---

### /lint-fix — 코드 품질

```
# ESLint 자동 수정 + tsc 타입 에러 분석·수정
/lint-fix
```

---

### /refactor — 리팩토링

```
# 현재 브랜치 변경 코드 리팩토링 제안
/refactor

# 기준 브랜치 직접 지정
/refactor --base main
```

중복 코드, 책임 분리, 네이밍, 복잡도, 패턴 불일치를 분석해서 제안 목록을 보여주고 승인하면 직접 수정.

---

### /sync-docs — AsyncAPI 문서 동기화

코드의 Zod 스키마와 asyncapi.yaml을 비교해서 불일치를 감지하고 수정 후 PR까지 진행.

**사전 설정** (`package.json`):

```json
{
  "syncDocs": {
    "docsRepo": "StableCoinTF/StableCoinBC_Adapter_Docs",
    "asyncapiPath": "../StableCoinBC_Adapter_Docs/asyncapi.yaml"
  }
}
```

```
/sync-docs
```

전체 프로세스:
1. 불일치 감지 → 목록 표시
2. 수정 여부 확인
3. Docs 레포 없으면 자동 클론
4. asyncapi.yaml 수정 → 변경 내용 표시
5. `@asyncapi/cli validate` 검증
6. AsyncAPI Studio 로컬 미리보기 (http://localhost:3210)
7. commit → push → PR 생성

---

### topic-gen-mcp — Kafka 토픽 스켈레톤 생성

슬래시 커맨드 없이 채팅창에 직접 요청:

```
"networkInquiry 토픽 스켈레톤 만들어줘"
  → port / service / handler 파일 생성
  → index.ts, env.ts 자동 수정
  → 다음 단계 안내

"ABI 변경사항 확인해줘"
  → ABI JSON과 chain-reader.port.ts 비교
  → 누락 메서드 감지 + 구현 스니펫 제안
```

---

## 프로젝트 구조

```
mcp/          ← MCP 서버 구현
commands/     ← Slash Command 정의 (.md)
docs/mcp/     ← MCP 서버별 상세 문서
scripts/      ← CLI 스크립트 (mcp-setup, sync-docs)
```

각 MCP 서버의 상세 파라미터와 출력 예시는 `docs/mcp/` 참고.
