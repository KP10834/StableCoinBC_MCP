# StableCoinBC MCP

StableCoin 프로젝트 공통 MCP 서버 및 AI Slash Command 모음.
Claude Code, VS Code Copilot 등 MCP 지원 AI 도구에서 사용 가능.

## MCP 서버

| 서버 | 용도 | 환경변수 |
|------|------|---------|
| `kafka-mcp` | 토픽 목록, 메시지 발행/소비, 오프셋 조회 | `KAFKA_BROKERS` |
| `redis-mcp` | 키 조회/삭제, 락 상태, TTL | `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`, `REDIS_PASSWORD`, `REDIS_KEY_PREFIX` |
| `sqlite-mcp` | DB 테이블/데이터 조회 (읽기 전용) | `DATA_DIR`, `SQLITE_DATABASES` |
| `evm-mcp` | EVM RPC 호출 (잔액, 논스, 트랜잭션) | `EVM_RPC_URL`, `RPC_TIMEOUT_MS` |
| `pm2-mcp` | PM2 프로세스 관리/로그 조회 | - |
| `error-log-mcp` | PM2 에러 로그 검색, 집계, 추이 | - |

## Slash Commands

| 커맨드 | 용도 |
|--------|------|
| `/impact` | git diff 기반 변경 영향 범위 분석 |
| `/release-note` | Conventional Commits 기반 릴리즈 노트 생성 |
| `/sync-docs` | 코드와 AsyncAPI 문서 동기화 (자동 수정) |

---

## 설치

```bash
npm install git+https://github.com/KP10834/StableCoinBC_MCP.git --save-dev
```

## 설정

### 1. MCP 서버 등록

#### Claude Code

`.mcp.json.example`을 프로젝트 루트에 `.mcp.json`으로 복사 후 환경에 맞게 수정:

```bash
cp node_modules/stablecoinbc-mcp/.mcp.json.example .mcp.json
```

#### VS Code Copilot

```bash
mkdir -p .vscode
cp node_modules/stablecoinbc-mcp/.vscode/mcp.json.example .vscode/mcp.json
```

### 2. Slash Commands 등록 (Claude Code 전용)

```bash
mkdir -p .claude/commands
cp node_modules/stablecoinbc-mcp/commands/*.md .claude/commands/
```

### 3. 의존성 설치

MCP 서버가 사용하는 라이브러리 설치:

```bash
cd node_modules/stablecoinbc-mcp && npm install && cd ../..
```

### 4. 환경에 맞게 수정

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

---

## sqlite-mcp DB 설정

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

## 지원 도구

| AI 도구 | MCP 서버 | Slash Commands |
|---------|---------|----------------|
| Claude Code | O | O |
| VS Code Copilot | O | X |
| Cursor | O | X |
| Windsurf | O | X |
