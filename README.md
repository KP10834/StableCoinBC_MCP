# @stablecointf/mcp-servers

StableCoin 프로젝트 공통 MCP(Model Context Protocol) 서버 및 AI Slash Command 모음.

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

## 설치

```bash
npm install @stablecointf/mcp-servers --save-dev
```

> GitHub Packages를 사용하므로 `.npmrc` 설정 필요:
> ```
> @stablecointf:registry=https://npm.pkg.github.com
> ```

## 설정

### Claude Code (`.mcp.json`)

`.mcp.json.example`을 `.mcp.json`으로 복사 후 환경에 맞게 수정:

```bash
cp node_modules/@stablecointf/mcp-servers/.mcp.json.example .mcp.json
```

### VS Code Copilot (`.vscode/mcp.json`)

`.vscode/mcp.json.example`을 `.vscode/mcp.json`으로 복사 후 환경에 맞게 수정:

```bash
cp node_modules/@stablecointf/mcp-servers/.vscode/mcp.json.example .vscode/mcp.json
```

### Slash Commands (Claude Code)

`commands/` 폴더의 `.md` 파일을 프로젝트의 `.claude/commands/`에 복사:

```bash
cp node_modules/@stablecointf/mcp-servers/commands/*.md .claude/commands/
```

## sqlite-mcp DB 설정

기본값은 `account.db`, `config.db`, `outbox.db`, `keys.db`입니다.
다른 프로젝트에서는 `SQLITE_DATABASES` 환경변수로 변경:

```json
{
  "env": {
    "DATA_DIR": "./data",
    "SQLITE_DATABASES": "users:users.db,orders:orders.db,logs:logs.db"
  }
}
```
