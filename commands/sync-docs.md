코드와 AsyncAPI 문서의 Kafka 메시지 스펙을 비교하고, 불일치가 있으면 asyncapi.yaml을 코드 기준으로 자동 수정해줘.

## 대상 파일

- **코드** (기준, 정본):
  - `src/adapter/in/kafka/handlers/*.handler.ts` — 각 핸들러의 Zod 스키마 (요청 메시지 필드)
  - `src/adapter/in/kafka/handlers/index.ts` — 핸들러 등록 및 토픽 매핑
  - `src/adapter/in/kafka/publish-result.ts` — 응답 메시지 필드
  - `src/infra/config/env.ts` — 토픽명 정의
- **문서** (수정 대상): `C:\Users\yrbyun\IdeaProjects\StableCoinBC_Adapter_Docs\asyncapi.yaml`

## 동작 방식

**코드가 정본이다.** 코드와 문서가 다르면 문서를 코드에 맞춰 수정한다.

### 1단계: 비교

1. 코드에서 모든 토픽과 메시지 스키마를 추출한다
2. asyncapi.yaml의 channels/messages와 비교한다
3. 불일치 목록을 만든다

### 2단계: 자동 수정

불일치 유형별 처리:

| 불일치 유형 | 조치 |
|------------|------|
| 코드에만 있는 토픽 | asyncapi.yaml에 channel + message 추가 (기존 패턴 따름) |
| 문서에만 있는 토픽 | 삭제하지 않고 리포트만 (deprecated 가능성) |
| 필드 누락 (코드에 있고 문서에 없음) | asyncapi.yaml payload.properties에 필드 추가 |
| 필드 삭제 (코드에 없고 문서에 있음) | asyncapi.yaml에서 해당 필드 제거 |
| 타입 불일치 | asyncapi.yaml의 타입을 코드 기준으로 수정 |
| required 불일치 | asyncapi.yaml의 required 배열을 코드 기준으로 수정 |
| nullable 불일치 | asyncapi.yaml의 nullable을 코드 기준으로 수정 |

### 3단계: 결과 리포트

수정 완료 후 변경 사항 요약을 보여준다.

## 타입 매핑 참조

| Zod 타입 | AsyncAPI 타입 |
|----------|-------------|
| z.string() | type: string |
| z.number() | type: number |
| z.boolean() | type: boolean |
| z.enum([...]) | type: string, enum: [...] |
| z.array(z.xxx()) | type: array, items: { type: xxx } |
| z.object({}) | type: object, properties: {} |
| .optional() | required 목록에서 제외 |
| .nullable() | nullable: true |

## 새 채널 추가 시 템플릿

asyncapi.yaml에 새 채널을 추가할 때는 기존 채널의 패턴을 따라:

```yaml
  channelName:
    address: adapter.xxx.request
    title: 기능명 요청
    description: Core → Adapter
    messages:
      MessageName:
        name: MessageName
        title: 기능명 요청
        payload:
          type: object
          required:
            - requestId
          properties:
            requestId:
              type: string
              description: 요청 고유 ID
              examples:
                - "REQ123"
        examples:
          - name: 요청 예시
            payload:
              requestId: "REQ123"
```

## 출력 형식

```markdown
# AsyncAPI 동기화 결과

## 요약
- 점검 토픽 수: N
- 수정된 항목: N건
- 문서에만 있는 토픽 (미삭제): [목록]

## 수정 내역

### 추가된 채널
- `adapter.xxx.request` — 기능명 요청

### 필드 변경
| 토픽 | 필드 | 변경 내용 |
|------|------|---------|
| adapter.xxx.request | newField | 추가 (type: string) |
| adapter.xxx.result | oldField | 삭제 |
| adapter.xxx.result | amount | 타입 변경 (string → number) |

### required 변경
| 토픽 | 변경 내용 |
|------|---------|
| adapter.xxx.request | chainId 추가 |
```

## 주의사항

- 코드의 실제 Zod 스키마를 기준으로 판단해 (주석이나 타입이 아닌 런타임 스키마)
- asyncapi.yaml의 YAML 들여쓰기, 순서, 기존 스타일을 유지해
- 문서에만 있는 토픽은 삭제하지 말고 리포트만 해 (deprecated일 수 있음)
- examples는 기존 값 유지, 새 필드는 적절한 예시 추가
- $ref 참조(예: TransactionStatus)는 건드리지 마
