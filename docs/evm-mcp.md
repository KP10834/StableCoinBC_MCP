# evm-mcp

> EVM 블록체인 RPC 호출 (잔액, 트랜잭션, nonce, 블록)

---

## 설정

```json
"evm-mcp": {
  "env": {
    "EVM_RPC_URL": "http://10.6.2.100:8545",
    "RPC_TIMEOUT_MS": "10000"
  }
}
```

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `EVM_RPC_URL` | `http://localhost:8545` | RPC 엔드포인트 |
| `RPC_TIMEOUT_MS` | `10000` | 타임아웃 (ms) |

> 각 도구에서 `rpc_url` 파라미터로 오버라이드 가능

---

## 도구 (6개)

### `evm_balance`

네이티브 토큰 잔액 조회. wei → ETH 자동 변환.

```
"이 주소 잔액 확인해줘: 0x1234..."
```

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|:----:|------|
| `address` | string | O | 지갑 주소 |
| `rpc_url` | string | | RPC URL 오버라이드 |

---

### `evm_token_balance`

ERC20 토큰 잔액 조회. `decimals`, `symbol`, `name` 자동 표시.

```
"이 주소의 USDT 잔액 확인해줘"
```

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|:----:|------|
| `address` | string | O | 지갑 주소 |
| `token` | string | O | 토큰 컨트랙트 주소 |
| `rpc_url` | string | | RPC URL 오버라이드 |

---

### `evm_tx`

트랜잭션 정보 + 영수증 조회. `success` / `failed` 자동 판정.

```
"이 트랜잭션 상태 확인해줘: 0xabcd..."
```

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|:----:|------|
| `tx_hash` | string | O | 트랜잭션 해시 |
| `rpc_url` | string | | RPC URL 오버라이드 |

---

### `evm_nonce`

현재 nonce 조회. confirmed / pending 모두 표시, pending 개수 자동 계산.

```
"이 주소 nonce 확인해줘"
```

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|:----:|------|
| `address` | string | O | 주소 |
| `rpc_url` | string | | RPC URL 오버라이드 |

---

### `evm_block`

블록 정보 조회.

```
"최신 블록 정보 보여줘"
```

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|:----:|--------|------|
| `block` | string | | `latest` | 블록 번호 또는 `latest` |
| `rpc_url` | string | | | RPC URL 오버라이드 |

---

### `evm_chain_info`

체인 정보 (chainId, name) + 최신 블록 번호 조회.

```
"연결된 체인 정보 보여줘"
```

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|:----:|------|
| `rpc_url` | string | | RPC URL 오버라이드 |
