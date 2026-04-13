# cross-impact-mcp

> 멀티 레포 간 코드 변경 영향 분석 (GitHub API 기반, 실시간)

---

## 설정

```json
"cross-impact-mcp": {
  "env": {
    "GITHUB_TOKEN": "<token>",
    "REPOS": "{\"adapter\":\"StableCoinTF/StableCoinBC_Adapter\",\"backend\":{\"repo\":\"StableCoinTF/StableCoinBE_Wallet\",\"base\":\"wallet_master\"},\"listener\":\"StableCoinTF/StableCoinBC_Adapter_Listener\",\"docs\":\"StableCoinTF/StableCoinBC_Adapter_Docs\"}"
  }
}
```

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `GITHUB_TOKEN` | (필수) | GitHub API 토큰 |
| `GITHUB_API_URL` | `https://api.github.com` | Enterprise 지원 |
| `REPOS` | (필수) | 레포 설정 JSON |

### REPOS 형식

```json
{
  "adapter": "StableCoinTF/StableCoinBC_Adapter",
  "backend": { "repo": "StableCoinTF/StableCoinBE_Wallet", "base": "wallet_master" },
  "listener": "StableCoinTF/StableCoinBC_Adapter_Listener",
  "docs": "StableCoinTF/StableCoinBC_Adapter_Docs"
}
```

> 단축형 `"org/repo"` → base branch `main`
> 상세형 `{"repo": "...", "base": "..."}` → base branch 지정

---

## 도구 (3개)

### `cross_impact_changes`

원격 레포의 변경 파일 + 영향받는 Kafka 연결 지점 조회.

```
"adapter feature/add-fee 브랜치 변경 영향 확인해줘"
```

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|:----:|------|
| `repo` | string | O | 레포 이름 (adapter, backend, listener) |
| `head` | string | O | 비교할 브랜치/태그 |
| `base` | string | | 기준 브랜치 (생략 시 레포별 기본) |

---

### `cross_impact_compare`

특정 Kafka 토픽 기준으로 양쪽 레포 코드 비교. diff + 관련 코드 자동 수집.

```
"adapter.payment.request 토픽 기준으로 adapter랑 backend 코드 비교해줘"
```

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|:----:|------|
| `topic` | string | O | Kafka 토픽명 |
| `sourceRepo` | string | O | 변경 발생 레포 |
| `head` | string | O | 변경 브랜치 |
| `base` | string | | 기준 브랜치 |

---

### `cross_impact_repos`

등록된 레포 목록 + 연결 관계 + Kafka 토픽 매핑 조회.

```
"cross-impact에 등록된 레포랑 토픽 보여줘"
```

---

## 프롬프트: `cross-impact-analyze`

3단계 자동 분석. `changes` → `compare` → 심각도별 리포트.

```
"adapter feature/add-fee 브랜치의 cross-repo 영향 전체 분석해줘"
```

### 심각도 기준

| 등급 | 기준 | 예시 |
|------|------|------|
| **CRITICAL** | 배포 시 즉시 에러 | 필드명 변경, 필수 필드 누락, 타입 불일치 |
| **WARNING** | 동작하지만 데이터 유실 가능 | 새 필드 무시됨, 선택 필드 변경 |
| **INFO** | 문서 업데이트 필요 | AsyncAPI 스키마 불일치 |

---

## Kafka 토픽 매핑 (17개)

| 토픽 | 방향 |
|------|------|
| `adapter.account.create` / `created` | BE → Adapter → BE |
| `adapter.account.deploy` / `deployed` | BE → Adapter → BE |
| `adapter.withdraw.request` / `result` | BE → Adapter → BE |
| `adapter.payment.request` / `result` | BE → Adapter → BE |
| `adapter.settlement.request` / `result` | BE → Adapter → BE |
| `adapter.balance.inquiry` / `result` | BE → Adapter → BE |
| `adapter.reconciliation.inquiry` / `result` | BE → Adapter → BE |
| `adapter.common.confirm` / `confirmed` | BE → Adapter → BE |
| `adapter.deposit.detected` | Adapter → BE |
