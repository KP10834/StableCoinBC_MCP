# kafka-mcp

> Kafka 토픽 관리 및 메시지 발행/소비

---

## 설정

```json
"kafka-mcp": {
  "env": { "KAFKA_BROKERS": "10.6.2.100:9092" }
}
```

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `KAFKA_BROKERS` | `localhost:9092` | 브로커 주소 (쉼표 구분) |

---

## 도구 (4개)

### `kafka_list_topics`

토픽 목록 조회. `adapter.*` 토픽과 기타를 분류하여 표시.

```
"카프카 토픽 목록 보여줘"
```

---

### `kafka_publish`

토픽에 JSON 메시지 발행.

```
"adapter.payment.request에 이 메시지 보내줘: {\"requestId\": \"test-001\", \"amount\": 1000}"
```

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|:----:|------|
| `topic` | string | O | 토픽명 |
| `message` | string | O | JSON 메시지 |
| `key` | string | | 메시지 키 |

---

### `kafka_consume`

토픽에서 최근 메시지 읽기. 임시 consumer group 생성 후 자동 삭제.

```
"adapter.payment.result 토픽에서 메시지 3개 읽어줘"
```

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|:----:|--------|------|
| `topic` | string | O | | 토픽명 |
| `count` | number | | `1` | 읽을 메시지 수 |
| `timeout` | number | | `5000` | 대기 시간 (ms) |

---

### `kafka_offsets`

토픽의 파티션별 earliest/latest 오프셋 조회.

```
"adapter.payment.request 오프셋 확인해줘"
```

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|:----:|------|
| `topic` | string | O | 토픽명 |
