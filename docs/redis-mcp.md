# redis-mcp

> Redis 키 조회/삭제, 락 관리, 서버 모니터링

---

## 설정

```json
"redis-mcp": {
  "env": {
    "REDIS_HOST": "10.6.2.100",
    "REDIS_PORT": "6379",
    "REDIS_DB": "0",
    "REDIS_KEY_PREFIX": "bc-adapter:"
  }
}
```

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `REDIS_HOST` | `localhost` | 호스트 |
| `REDIS_PORT` | `6379` | 포트 |
| `REDIS_DB` | `0` | DB 인덱스 |
| `REDIS_PASSWORD` | | 비밀번호 |
| `REDIS_KEY_PREFIX` | `bc-adapter:` | 키 프리픽스 (자동 적용) |

---

## 도구 (6개)

### `redis_keys`

패턴으로 키 검색. prefix 자동 적용.

```
"redis에 account 관련 키 있어?"  →  pattern: "account:*"
```

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|:----:|--------|------|
| `pattern` | string | | `*` | 검색 패턴 |

---

### `redis_get`

키 값 조회. `string` / `hash` / `list` / `set` / `zset` 타입 자동 감지.

```
"redis에서 account:test-001 값 보여줘"
```

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|:----:|------|
| `key` | string | O | 키 (prefix 제외) |

---

### `redis_del`

키 삭제.

```
"redis에서 lock:payment:test-001 삭제해줘"
```

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|:----:|------|
| `key` | string | O | 키 (prefix 제외) |

---

### `redis_ttl`

키 TTL 조회.

```
"account:test-001 TTL 확인해줘"
```

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|:----:|------|
| `key` | string | O | 키 (prefix 제외) |

> 결과: `-1` (영구) / `-2` (만료/없음) / `N초`

---

### `redis_locks`

활성 락 목록 조회. `{prefix}lock:*` 패턴으로 자동 검색.

```
"redis에 락 걸린 키 있어?"
```

---

### `redis_info`

Redis 서버 정보 요약. memory, clients, keyspace, server 섹션만 표시.

```
"redis 서버 상태 보여줘"
```
