# StableCoinBC MCP

StableCoin 프로젝트 공통 MCP 서버 및 AI Slash Command 모음.

## 구조

```
mcp/               ← MCP 서버 (Claude Code, VS Code Copilot, Cursor 등)
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

MCP 프로토콜을 지원하는 AI 도구에서 사용 가능.

| AI 도구 | 지원 |
|---------|:----:|
| Claude Code | O |
| VS Code Copilot | O |
| Cursor | O |
| Windsurf | O |

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
| `release-note-mcp` | 커밋 히스토리 기반 릴리즈 노트 | 없음 | [docs](docs/mcp/release-note-mcp.md) |
| `cross-impact-mcp` | 멀티 레포 변경 영향 분석 (GitHub API) | `GITHUB_TOKEN`, `REPOS` | [docs](docs/mcp/cross-impact-mcp.md) |

### 설정

#### Claude Code

```bash
cp node_modules/@stablecointf/mcp-servers/.mcp.json.example .mcp.json
```

#### VS Code Copilot

```bash
mkdir -p .vscode
cp node_modules/@stablecointf/mcp-servers/.vscode/mcp.json.example .vscode/mcp.json
```

#### 환경변수 수정

`.mcp.json` (또는 `.vscode/mcp.json`)의 `env` 값을 프로젝트 환경에 맞게 변경:

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

Claude Code 전용. MCP 서버의 도구들을 정형화된 워크플로우로 감싸서 한 줄로 실행.

| AI 도구 | 지원 |
|---------|:----:|
| Claude Code | O |
| VS Code Copilot | X |
| Cursor | X |
| Windsurf | X |

### 커맨드 목록

| 커맨드 | MCP 서버 | 용도 |
|--------|---------|------|
| `/qa` | `qa-mcp` | 현재 브랜치 자동 테스트 (빌드→실행→Kafka 테스트→정리) |
| `/workflow` | `workflow-mcp` | 이슈→브랜치→커밋→PR 워크플로우 자동화 |
| `/impact` | `cross-impact-mcp` | 멀티 레포 변경 영향 분석 |
| `/release-note` | `release-note-mcp` | Conventional Commits 기반 릴리즈 노트 생성 |
| `/sync-docs` | — | 코드와 AsyncAPI 문서 동기화 (자동 수정) |

### 설정

```bash
mkdir -p .claude/commands
cp node_modules/@stablecointf/mcp-servers/commands/*.md .claude/commands/
```

> MCP 서버만 사용하는 경우 이 단계는 생략 가능.
