# StableCoinBC MCP

StableCoin 프로젝트 개발에 필요한 **MCP 서버**와 **Claude Code 슬래시 커맨드** 모음.

Claude Code 채팅창에서 자연어로 인프라를 조회하고, 테스트를 돌리고, GitHub 워크플로우를 자동화하고, 문서를 동기화할 수 있다.

```
┌──────────────────────────────────────────────────────────────┐
│  Claude Code (대화창)                                          │
│    ├─ 자연어 요청      → MCP 서버 도구 자동 호출                  │
│    └─ /슬래시 커맨드    → 정해진 워크플로우 실행                    │
│              ↓                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  MCP 서버 (stdio)                                        │  │
│  │   kafka / redis / sqlite / evm / elk  ← 인프라 조회        │  │
│  │   grafana / kibana                     ← 모니터링 (UI 프록시) │  │
│  │   workflow / qa / cross-impact         ← 개발 자동화        │  │
│  │   slack                                ← 메시징/알림        │  │
│  │   github-wiki                          ← Wiki 조회/편집     │  │
│  │   topic-gen                            ← 스캐폴딩         │  │
│  │   context7 (외부)                      ← 라이브러리 문서    │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 목차

1. [사전 요구사항](#사전-요구사항)
2. [빠른 시작](#빠른-시작)
3. [디렉터리 구조](#디렉터리-구조)
4. [MCP 서버](#mcp-서버)
5. [Slash Commands](#slash-commands)
6. [사용 시나리오](#사용-시나리오)
7. [업데이트 / 트러블슈팅](#업데이트--트러블슈팅)

---

## 사전 요구사항

- **Node.js** 18 이상
- **Claude Code** CLI
- **gh CLI** — GitHub 연동 커맨드 사용 시 (`workflow-mcp`, `cross-impact-mcp`, `/review` 계열)
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

프로젝트 루트에 다음이 생성된다:

- `.mcp.json` — Claude Code가 읽는 MCP 서버 설정
- `.claude/commands/` — 슬래시 커맨드 정의(.md) 자동 복사

옵션:

```bash
npx mcp-setup --mcp        # .mcp.json만 생성/갱신
npx mcp-setup --commands   # 슬래시 커맨드만 갱신
```

### 3. 환경변수 설정

`.mcp.json`을 열어 프로젝트 환경에 맞게 수정한다. 자주 쓰는 값은 [`.env.example`](.env.example)을 참고.

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
    },
    "slack-mcp": {
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-...",
        "SLACK_USER_TOKEN": "xoxp-...",
        "SLACK_DEFAULT_CHANNEL": "#bc-adapter-alerts"
      }
    },
    "grafana-mcp": {
      "env": {
        "GRAFANA_URL": "https://grafana.company.com",
        "GRAFANA_SA_TOKEN": "glsa_xxxx",
        "GRAFANA_PROM_DATASOURCE_UID": "prom-default",
        "GRAFANA_LOKI_DATASOURCE_UID": "loki-default"
      }
    },
    "kibana-mcp": {
      "env": {
        "KIBANA_URL": "https://kibana.company.com",
        "KIBANA_API_KEY": "xxxx"
      }
    },
    "github-wiki-mcp": {
      "env": {
        "GITHUB_TOKEN": "ghp_xxxx",
        "WIKI_REPOS": "{\"adapter\":\"StableCoinTF/StableCoinBC_Adapter\"}"
      }
    }
  }
}
```

> `workflow-mcp`, `qa-mcp`, `sqlite-mcp`, `context7`는 환경변수 없이 바로 사용 가능.

### 4. Claude Code 재시작

`.mcp.json`은 Claude Code가 부팅 시점에 읽기 때문에 재시작이 필요하다.

확인:

```
"카프카 토픽 목록 보여줘"
```

→ `kafka-mcp` 도구가 호출되면 정상 동작.

---

## 디렉터리 구조

```
StableCoinBC_MCP/
├── README.md                  ← 이 파일
├── package.json               ← bin: mcp-setup, sync-docs
├── .env.example               ← 환경변수 템플릿 (필수 항목 모음)
├── .mcp.json.example          ← .mcp.json 초기 템플릿 (setup이 복사)
│
├── mcp/                       ← MCP 서버 구현 (stdio 프로토콜)
│   ├── kafka-mcp/             ─┐    각 디렉터리에 index.js + README.md
│   ├── redis-mcp/              │    (README.md = 도구 명세 / 파라미터 / 출력 예시)
│   ├── sqlite-mcp/             ├─ 인프라 조회
│   ├── evm-mcp/                │
│   ├── elk-mcp/               ─┘
│   ├── grafana-mcp/          ─┐
│   ├── kibana-mcp/             ├─ 모니터링 (UI 프록시)
│   │                          ─┘   (백엔드 포트 막힌 환경용)
│   ├── workflow-mcp/          ─┐
│   ├── qa-mcp/                 ├─ 개발 자동화
│   ├── cross-impact-mcp/      ─┘
│   ├── slack-mcp/             ── 메시징/알림
│   ├── github-wiki-mcp/       ── GitHub Wiki 조회/편집
│   └── topic-gen-mcp/         ── 스캐폴딩 / ABI 동기화
│
├── commands/                  ← Slash Command 정의 (.md)
│   ├── workflow.md            ← /workflow
│   ├── qa.md                  ← /qa
│   ├── impact.md              ← /impact
│   ├── release-note.md        ← /release-note
│   ├── lint-fix.md            ← /lint-fix
│   ├── refactor.md            ← /refactor
│   ├── review.md              ← /review (PR 리뷰 + GitHub 등록)
│   ├── security-review.md     ← /security-review
│   ├── sync-docs.md           ← /sync-docs
│   └── codex/
│       └── review.md          ← /codex:review (네임스페이스)
│
├── docs/                      ← 상세 문서 (MCP 외)
│   ├── commands/              ← 슬래시 커맨드 상세 가이드
│   │   └── review.md
│   └── superpowers/           ← 설계/리팩토링 계획 문서
│
├── scripts/                   ← CLI 스크립트 (package.json bin)
│   ├── setup.mjs              ← npx mcp-setup
│   └── sync-docs.mjs          ← npx sync-docs (코드 ↔ asyncapi.yaml)
│
└── tests/                     ← MCP 서버 동작 테스트
    └── topic-gen-mcp.test.mjs
```

### 각 디렉터리 역할

| 경로 | 역할 | 사용자가 손댈 일 |
|------|------|------------------|
| `mcp/<server>/index.js` | MCP 서버 본체. `@modelcontextprotocol/sdk` 기반 stdio 서버 | 새 도구 추가 / 버그 수정 |
| `mcp/<server>/README.md` | 각 MCP 서버가 노출하는 **도구 목록과 파라미터**. 도구 호출 결과 예시 포함 | 새 도구 추가 시 함께 업데이트 |
| `commands/*.md` | Claude Code 슬래시 커맨드 프롬프트 | 새 워크플로우 추가 |
| `commands/<ns>/*.md` | 네임스페이스 커맨드 (`/codex:review` 등) | 그룹화된 커맨드 추가 |
| `scripts/setup.mjs` | 패키지 설치 후 `.mcp.json` / `.claude/commands/` 자동 생성 | 거의 없음 |
| `.mcp.json.example` | 설치 시점에 그대로 복사되는 템플릿 | MCP 서버 추가 시 수정 |

### 설치한 프로젝트에 생기는 파일

`npx mcp-setup` 실행 후 **사용자 프로젝트** 쪽 구조:

```
your-project/
├── .mcp.json                  ← 이 패키지의 .mcp.json.example 복사본
├── .claude/
│   └── commands/              ← 이 패키지의 commands/ 복사본
│       ├── workflow.md
│       ├── qa.md
│       └── ...
└── node_modules/
    └── @stablecointf/
        └── mcp-servers/       ← 이 패키지 본체 (.mcp.json이 여기를 가리킴)
```

`.mcp.json`은 `node_modules/@stablecointf/mcp-servers/mcp/<server>/index.js`를 `node`로 실행하도록 구성되어 있어, 별도 글로벌 설치가 필요 없다.

---

## MCP 서버

Claude Code 채팅창에서 자연어로 요청하면 자동으로 해당 도구가 호출된다. 상세 파라미터와 출력 예시는 `mcp/<server>/README.md`를 참고.

### 개발 보조

| 서버 | 용도 | 환경변수 |
|------|------|----------|
| `context7` | 라이브러리 최신 공식 문서 조회 (ethers.js, kafkajs, Zod 등) | 없음 |

```
"ethers.js v6 AbiCoder.encode 사용법 알려줘"
"kafkajs producer.transaction() 예시 보여줘"
"Zod .transform() + .pipe() 조합 패턴 알려줘"
```

### 인프라 조회

| 서버 | 용도 | 환경변수 | 상세 |
|------|------|----------|------|
| `kafka-mcp` | 토픽 목록, 메시지 발행/소비, 오프셋 조회 | `KAFKA_BROKERS` | [docs](mcp/kafka-mcp/README.md) |
| `redis-mcp` | 키 조회/삭제, 락 상태, TTL | `REDIS_HOST`, `REDIS_PORT` 등 | [docs](mcp/redis-mcp/README.md) |
| `sqlite-mcp` | DB 테이블/데이터 조회 (읽기 전용) | `DATA_DIR` | [docs](mcp/sqlite-mcp/README.md) |
| `evm-mcp` | EVM RPC 호출 (잔액, 논스, 트랜잭션) | `EVM_RPC_URL` | [docs](mcp/evm-mcp/README.md) |
| `elk-mcp` | Elasticsearch 로그 검색, 요청 추적, 에러 분석 | `ES_URL`, `ES_API_KEY` | [docs](mcp/elk-mcp/README.md) |

```
"adapter.payment.request 토픽 최근 메시지 보여줘"
"bc-adapter:nonce:* 패턴 Redis 키 조회해줘"
"payment 테이블 최근 10건 보여줘"
"0xABC... 주소 잔액 확인해줘"
"오늘 withdraw 서비스 에러 로그 검색해줘"
```

### 모니터링 (UI 프록시 경유)

백엔드 포트(9090 Prom / 3100 Loki / 9200 ES)가 차단된 환경에서, Grafana/Kibana UI URL만 닿으면 동작.

| 서버 | 용도 | 환경변수 | 상세 |
|------|------|----------|------|
| `grafana-mcp` | PromQL/LogQL 쿼리, 알림 조회, 대시보드 검색, 어노테이션 추가 | `GRAFANA_URL`, `GRAFANA_SA_TOKEN` | [docs](mcp/grafana-mcp/README.md) |
| `kibana-mcp` | ES 검색/임의 요청 (Console proxy), Saved Object, Alerting 룰 | `KIBANA_URL`, `KIBANA_API_KEY` | [docs](mcp/kibana-mcp/README.md) |

```
"최근 30분 adapter 에러율 PromQL로 보여줘"
"지금 firing 중인 grafana 알림 뭐 있어?"
"kibana로 오늘 withdraw 에러 로그 검색"
"'v1.4.2 deploy' grafana 마커 찍어줘"
```

### 자동화

| 서버 | 용도 | 환경변수 | 상세 |
|------|------|----------|------|
| `workflow-mcp` | 이슈→브랜치→커밋→PR 워크플로우 | `GITHUB_REPO` (자동 감지) | [docs](mcp/workflow-mcp/README.md) |
| `qa-mcp` | 브랜치 자동 테스트 (빌드→실행→Kafka 테스트) | 프로젝트 `.env` 자동 로드 | [docs](mcp/qa-mcp/README.md) |
| `cross-impact-mcp` | 멀티 레포 변경 영향 분석 | `GITHUB_TOKEN`, `REPOS` | [docs](mcp/cross-impact-mcp/README.md) |
| `topic-gen-mcp` | Kafka 토픽 스켈레톤 생성, ABI↔ChainReader 동기화 | `BOARD_DIR` | [docs](mcp/topic-gen-mcp/README.md) |
| `slack-mcp` | 메시지 발송, 채널/스레드 조회, 메시지 검색 | `SLACK_BOT_TOKEN`, `SLACK_USER_TOKEN` | [docs](mcp/slack-mcp/README.md) |
| `github-wiki-mcp` | GitHub Wiki 조회/검색/생성/갱신 (git 기반, 자동 commit+push) | `GITHUB_TOKEN`, `WIKI_REPOS` | [docs](mcp/github-wiki-mcp/README.md) |

#### cross-impact-mcp REPOS 설정

분석 대상 레포를 JSON 문자열로 지정:

```json
"REPOS": "{\"adapter\":{\"repo\":\"StableCoinTF/StableCoinBC_Adapter\",\"base\":\"dev\"},\"listener\":{\"repo\":\"StableCoinTF/StableCoinBC_Adapter_Listener\",\"base\":\"develop\"}}"
```

키는 `/impact` 커맨드에서 레포 이름으로 사용된다 (예: `/impact adapter feature/new-field`).

---

## Slash Commands

`/커맨드명`으로 실행. Claude Code 채팅창에서 입력.

| 커맨드 | 용도 | 의존하는 MCP / 도구 | 상세 |
|--------|------|----------------------|------|
| `/workflow` | 이슈→브랜치→커밋→PR 자동화 | `workflow-mcp`, gh CLI | |
| `/qa` | 현재 브랜치 변경 핸들러 자동 테스트 | `qa-mcp`, `kafka-mcp` | |
| `/impact` | 멀티 레포 변경 영향 분석 | `cross-impact-mcp`, gh CLI | |
| `/release-note` | Conventional Commits 기반 릴리즈 노트 | git | |
| `/lint-fix` | ESLint 자동 수정 + tsc 타입 에러 분석·수정 | npm / tsc | |
| `/refactor` | 변경 코드 리팩토링 제안 및 적용 | git | |
| `/review` | PR 코드 리뷰 + GitHub 인라인 코멘트 등록 | gh CLI | [docs](docs/commands/review.md) |
| `/codex:review` | PR 코드 품질/설계/패턴 중점 리뷰 | gh CLI | |
| `/security-review` | PR 보안 취약점 중점 리뷰 (OWASP, 블록체인) | gh CLI | |
| `/sync-docs` | 코드 Zod 스키마 ↔ AsyncAPI YAML 동기화 | `sync-docs` 스크립트, gh CLI | |

---

## 사용 시나리오

### 시나리오 1. 기능 개발 (이슈부터 PR까지)

```
# 1) 이슈 + 브랜치 생성 + 체크아웃 (한 번에)
/workflow create 출금 요청 시 잔액 부족 에러 처리 추가 --type feat

# 2) 작업 중 인프라 확인 (자연어)
"adapter.withdraw.request 최근 메시지 보여줘"
"bc-adapter:lock:withdraw:* Redis 키 확인해줘"

# 3) 변경된 핸들러만 자동 테스트
/qa

# 4) 변경 코드 리팩토링 검토
/refactor

# 5) 린트/타입 정리
/lint-fix

# 6) 커밋 (메시지 자동 분석, 이슈 번호 자동 추가)
/workflow commit

# 7) push + PR (이슈 자동 연결, 본문 자동 작성)
/workflow pr

# 8) PR 리뷰 — 본인 검토 후 GitHub 등록
/review
```

### 시나리오 2. 멀티 레포 영향 분석

스키마 필드를 바꿨는데 어떤 레포가 깨질지 확인:

```
# adapter 레포의 feature 브랜치가 다른 레포에 미치는 영향
/impact adapter feature/new-payment-field

# 결과:
# CRITICAL — be-wallet/src/payment.handler.ts: 필수 필드 누락
# WARNING — fe-admin: 새 필드 무시됨
# INFO    — docs: asyncapi.yaml 업데이트 필요
```

### 시나리오 3. Kafka 토픽 추가

```
"networkInquiry 토픽 스켈레톤 만들어줘"
  → port / service / handler 파일 생성
  → index.ts, env.ts 자동 수정
  → 다음 단계 안내

"ABI 변경사항 확인해줘"
  → ABI JSON과 chain-reader.port.ts 비교
  → 누락 메서드 감지 + 구현 스니펫 제안
```

### 시나리오 4. 운영 이슈 조사

```
"오늘 14시쯤 0xABC... 주소 관련 트랜잭션 실패 원인 찾아줘"
  → elk-mcp: 해당 시간대 에러 로그 검색
  → kafka-mcp: 관련 토픽 메시지 추적
  → evm-mcp: 온체인 트랜잭션 상태 확인
  → sqlite-mcp: DB 상태 확인
  → 종합 분석 결과 반환
```

### 시나리오 5. 릴리즈 작업

```
# 최근 태그부터 HEAD까지 릴리즈 노트 자동 생성
/release-note

# 태그 간 범위
/release-note v1.0.0..v1.1.0

# 커밋 목록만 (테이블)
/release-note commits
```

### 시나리오 6. AsyncAPI 문서 동기화

`package.json`에 사전 설정:

```json
{
  "syncDocs": {
    "docsRepo": "StableCoinTF/StableCoinBC_Adapter_Docs",
    "asyncapiPath": "../StableCoinBC_Adapter_Docs/asyncapi.yaml"
  }
}
```

실행:

```
/sync-docs
```

전체 프로세스:
1. 코드 Zod 스키마 ↔ asyncapi.yaml 불일치 감지 → 목록 표시
2. 수정 여부 확인
3. Docs 레포 없으면 자동 클론
4. asyncapi.yaml 수정 → 변경 내용 표시
5. `@asyncapi/cli validate` 검증
6. AsyncAPI Studio 로컬 미리보기 (http://localhost:3210)
7. commit → push → PR 생성

---

## 커맨드 옵션 레퍼런스

### /workflow

| 서브 | 예시 | 설명 |
|------|------|------|
| `create` | `/workflow create 잔액 부족 에러 처리 --type feat` | 이슈 + 브랜치 생성 |
| `start` | `/workflow start 42` | 기존 이슈로 작업 시작 |
| `status` | `/workflow status` | 현재 작업 상태 |
| `commit` | `/workflow commit [메시지]` | 메시지 없으면 diff 분석 후 제안 |
| `pr` | `/workflow pr [--draft]` | PR 생성 (이슈 자동 연결) |

### /qa

| 옵션 | 설명 |
|------|------|
| (없음) | 변경된 핸들러만 자동 감지 후 테스트 |
| `--all` | 전체 핸들러 회귀 테스트 |
| `--skip-build` | 빌드 생략 |
| `--base <branch>` | 기준 브랜치 직접 지정 |
| `--keep-alive` | 테스트 후 서비스 유지 |

### /impact

```
/impact                                    → 등록된 레포 목록 표시
/impact adapter feature/new-payment-field  → 영향 분석
/impact adapter feature/new-field --base main
```

심각도:
- **CRITICAL** — 배포 시 즉시 에러 (필드명 변경, 필수 필드 누락 등)
- **WARNING** — 데이터 유실 가능 (새 필드 무시 등)
- **INFO** — 문서 업데이트 필요

### /review

```
/review                    → 현재 브랜치 PR 리뷰
/review 42                 → PR #42 리뷰
/review --approve          → 리뷰 후 APPROVE
/review --request-changes  → 변경 요청
```

버그/보안/성능/타입/스타일을 CRITICAL / WARNING / INFO로 분류해 리뷰 결과를 먼저 보여주고 확인 후 GitHub에 등록한다.

### /release-note

```
/release-note                  → 최근 태그부터 HEAD
/release-note v1.0.0           → v1.0.0부터 HEAD
/release-note v1.0.0..v1.1.0   → 태그 간
/release-note commits          → 커밋 목록 테이블
/release-note tags             → 태그 목록
```

### /refactor

```
/refactor                  → 현재 브랜치 변경 코드 분석
/refactor --base main      → 기준 브랜치 지정
```

중복 코드, 책임 분리, 네이밍, 복잡도, 패턴 불일치를 분석하고 승인하면 직접 수정.

---

## 업데이트 / 트러블슈팅

### 새 버전 반영

```bash
npm install git+https://github.com/KP10834/StableCoinBC_MCP.git --save-dev
npx mcp-setup
```

`setup`은 기존 `.mcp.json`을 덮어쓰지 않고, 슬래시 커맨드는 변경된 파일만 갱신한다 (`. 이미 최신` / `~ 갱신` / `+ 추가`로 표시).

### MCP 서버가 호출되지 않을 때

1. Claude Code 재시작 (`.mcp.json`은 부팅 시점에만 로드)
2. `.mcp.json`의 `args` 경로가 실제 파일을 가리키는지 확인
   - `node_modules/@stablecointf/mcp-servers/mcp/<server>/index.js`
3. 필수 환경변수 누락 확인 (`.env.example` 참고)
4. `node node_modules/@stablecointf/mcp-servers/mcp/<server>/index.js`로 직접 실행해 stderr 확인

### gh CLI 인증 실패

```bash
gh auth status
gh auth login
```

`workflow-mcp`, `cross-impact-mcp`, `/review` 계열은 gh CLI 인증이 필수.

### 새 도구 / 커맨드 추가

1. MCP 서버: `mcp/<server>/index.js`에 도구 추가 → `mcp/<server>/README.md`에 명세 작성
2. 슬래시 커맨드: `commands/<name>.md` 생성 (네임스페이스는 `commands/<ns>/<name>.md`)
3. 사용자 프로젝트에서 `npx mcp-setup` 재실행으로 반영

---

## 참고 링크

- 각 MCP 서버 상세: [`mcp/<server>/README.md`](mcp/<server>/README.md)
- 슬래시 커맨드 상세: [`docs/commands/`](docs/commands/)
- 환경변수 전체 목록: [`.env.example`](.env.example)
- 초기 설정 템플릿: [`.mcp.json.example`](.mcp.json.example)
