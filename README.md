# StableCoinBC MCP

StableCoin 프로젝트 공통 MCP 서버 및 AI Slash Command 모음.

## 구조

```
mcp/               ← MCP 서버
commands/          ← Slash Commands (Claude Code 전용)
docs/mcp/          ← MCP 서버별 상세 문서
scripts/           ← CLI 스크립트
```

---

## 설치

```bash
npm install git+https://github.com/KP10834/StableCoinBC_MCP.git --save-dev
npx mcp-setup
```

`mcp-setup`이 `.mcp.json`, `.claude/commands/`를 자동 생성/갱신합니다.
업데이트 시에도 동일하게 실행하면 경로 마이그레이션 + 신규 커맨드 반영.

```bash
npx mcp-setup --mcp       # MCP 설정만
npx mcp-setup --commands   # 슬래시 커맨드만
```

---

## MCP 서버

### 서버 목록

#### 인프라 조회

| 서버 | 용도 | 환경변수 | 문서 |
|------|------|---------|------|
| `kafka-mcp` | 토픽 목록, 메시지 발행/소비, 오프셋 조회 | `KAFKA_BROKERS` | [docs](docs/mcp/kafka-mcp.md) |
| `redis-mcp` | 키 조회/삭제, 락 상태, TTL | `REDIS_HOST`, `REDIS_PORT` 등 | [docs](docs/mcp/redis-mcp.md) |
| `sqlite-mcp` | DB 테이블/데이터 조회 (읽기 전용) | `DATA_DIR`, `SQLITE_DATABASES` | [docs](docs/mcp/sqlite-mcp.md) |
| `evm-mcp` | EVM RPC 호출 (잔액, 논스, 트랜잭션) | `EVM_RPC_URL` | [docs](docs/mcp/evm-mcp.md) |
| `elk-mcp` | Elasticsearch 로그 검색, 요청 추적, 에러 분석 | `ES_URL`, `ES_API_KEY` 등 | [docs](docs/mcp/elk-mcp.md) |

#### 자동화

| 서버 | 용도 | 환경변수 | 문서 |
|------|------|---------|------|
| `workflow-mcp` | 이슈→브랜치→커밋→PR 워크플로우 | `GITHUB_REPO` | [docs](docs/mcp/workflow-mcp.md) |
| `qa-mcp` | 브랜치 자동 테스트 (빌드→실행→Kafka 테스트) | 프로젝트 `.env` 자동 로드 | [docs](docs/mcp/qa-mcp.md) |
| `cross-impact-mcp` | 멀티 레포 변경 영향 분석 (GitHub API) | `GITHUB_TOKEN`, `REPOS` | [docs](docs/mcp/cross-impact-mcp.md) |
| `topic-gen-mcp` | Kafka 토픽 스켈레톤 생성, ABI↔ChainReader 동기화 | `BOARD_DIR` | [docs](docs/mcp/topic-gen-mcp.md) |

### 설정

```bash
cp node_modules/@stablecointf/mcp-servers/.mcp.json.example .mcp.json
```

#### 환경변수 수정

`.mcp.json`의 `env` 값을 프로젝트 환경에 맞게 변경:

```json
{
  "kafka-mcp": {
    "env": { "KAFKA_BROKERS": "10.6.2.100:9092" }
  },
  "redis-mcp": {
    "env": { "REDIS_HOST": "10.6.2.100", "REDIS_PORT": "6379" }
  },
  "evm-mcp": {
    "env": { "EVM_RPC_URL": "http://10.6.2.100:8545" }
  }
}
```

#### sqlite-mcp DB 설정

기본값은 `account.db`, `config.db`, `outbox.db`, `keys.db`.
다른 프로젝트에서는 `SQLITE_DATABASES` 환경변수로 변경:

```json
{
  "env": {
    "DATA_DIR": "./data",
    "SQLITE_DATABASES": "users:users.db,orders:orders.db,logs:logs.db"
  }
}
```

---

## Slash Commands

### 커맨드 목록

| 커맨드 | MCP 서버 | 용도 |
|--------|---------|------|
| `/qa` | `qa-mcp` | 현재 브랜치 자동 테스트 (빌드→실행→Kafka 테스트→정리) |
| `/workflow` | `workflow-mcp` | 이슈→브랜치→커밋→PR 워크플로우 자동화 |
| `/impact` | `cross-impact-mcp` | 멀티 레포 변경 영향 분석 |
| `/release-note` | — | Conventional Commits 기반 릴리즈 노트 생성 (git 직접 실행) |
| `/lint-fix` | `qa-mcp` | ESLint 자동 수정 + tsc 타입 에러 분석 및 수정 |
| `/refactor` | `qa-mcp` | 변경 코드 리팩토링 제안 및 적용 |
| `/sync-docs` | — | 코드와 AsyncAPI 문서 동기화 (자동 수정) |

### 설정

```bash
mkdir -p .claude/commands
cp node_modules/@stablecointf/mcp-servers/commands/*.md .claude/commands/
```

> MCP 서버만 사용하는 경우 이 단계는 생략 가능.

---

## 사용 예시

### 개발 워크플로우

새 기능 작업부터 PR까지 한 흐름:

```
/workflow create 출금 수수료 계산 로직 추가 --type feat
  → GitHub 이슈 생성 + 브랜치 생성 + 자동 체크아웃

... 코드 작업 ...

/workflow commit
  → 변경사항 분석 후 Conventional Commits 형식 커밋 메시지 제안

/workflow pr
  → push + PR 생성 (이슈 자동 연결)
```

### 브랜치 자동 테스트

```
/qa
  → 현재 브랜치의 변경 핸들러만 자동 감지 후 테스트

/qa --all
  → 전체 핸들러 회귀 테스트

/qa --skip-build
  → 빌드 생략하고 테스트만
```

### 멀티 레포 영향 분석

```
/impact adapter feature/new-payment-field
  → adapter 레포의 해당 브랜치가 다른 레포에 미치는 영향 분석
  → CRITICAL / WARNING / INFO 심각도로 분류

/impact
  → 등록된 레포 목록 표시 후 선택
```

### 릴리즈 노트 생성

```
/release-note
  → 최근 태그부터 HEAD까지 자동 생성

/release-note v1.0.0
  → v1.0.0부터 HEAD까지

/release-note v1.0.0..v1.1.0
  → 특정 범위

/release-note tags
  → 태그 목록 조회
```

### 코드 품질

```
/lint-fix
  → ESLint 자동 수정 + tsc 타입 에러 분석 및 수정

/refactor
  → 변경 코드 리팩토링 제안 (중복/책임분리/네이밍 등) 후 승인 시 적용

/refactor --base main
  → main 기준으로 비교
```

### AsyncAPI 문서 동기화

```
/sync-docs
  → 코드 Zod 스키마와 asyncapi.yaml 불일치 감지 → 확인 → 수정
  → Docs 레포 없으면 자동 클론 → validate → Studio 미리보기 → commit/push/PR
```

`package.json` 설정 필요:

```json
{
  "syncDocs": {
    "docsRepo": "StableCoinTF/StableCoinBC_Adapter_Docs",
    "asyncapiPath": "../StableCoinBC_Adapter_Docs/asyncapi.yaml"
  }
}
```

### Kafka 토픽 스켈레톤 생성

Claude에게 직접 요청:

```
"networkInquiry 토픽 스켈레톤 만들어줘"
→ topic_gen 도구 호출
→ port/service/handler 파일 생성 + index.ts, env.ts 자동 수정
```

### 인프라 조회

Claude에게 자연어로 요청:

```
"adapter.payment.request 토픽 최근 메시지 보여줘"  → kafka-mcp
"bc-adapter:nonce:* 패턴 키 조회해줘"             → redis-mcp
"payment 테이블 최근 10건 보여줘"                  → sqlite-mcp
"0xABC... 주소 잔액 확인해줘"                      → evm-mcp
"오늘 withdraw 서비스 에러 로그 검색해줘"           → elk-mcp
```
