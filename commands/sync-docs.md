코드와 AsyncAPI 문서의 Kafka 메시지 스펙 동기화 상태를 점검해줘.

## 대상 파일

- **코드**: 현재 프로젝트의 Kafka 핸들러 및 스키마
  - `src/adapter/in/kafka/handlers/*.handler.ts` — 각 핸들러의 Zod 스키마 (요청 메시지 필드)
  - `src/adapter/in/kafka/handlers/index.ts` — 핸들러 등록 및 토픽 매핑
  - `src/adapter/in/kafka/publish-result.ts` — 응답 메시지 필드
  - `src/infra/config/env.ts` — 토픽명 정의
- **문서**: `C:\Users\yrbyun\IdeaProjects\StableCoinBC_Adapter_Docs\asyncapi.yaml`

## 점검 항목

### 1. 토픽 누락 확인
- 코드에 있는 토픽이 asyncapi.yaml의 channels에 없으면 보고
- asyncapi.yaml에 있는 토픽이 코드에 없으면 보고

### 2. 필드 불일치 확인
각 채널(토픽)별로:
- 코드의 Zod 스키마 필드 vs asyncapi.yaml의 payload.properties 비교
- 누락된 필드, 추가된 필드, 타입 불일치 확인
- required 필드 불일치 확인

### 3. 타입 매핑 참조
| Zod 타입 | AsyncAPI 타입 |
|----------|-------------|
| z.string() | type: string |
| z.number() | type: number / type: integer |
| z.boolean() | type: boolean |
| z.enum([...]) | type: string, enum: [...] |
| z.array() | type: array |
| z.object() | type: object |
| .optional() | required 목록에서 제외 |
| .nullable() | nullable: true |

## 출력 형식

```markdown
# AsyncAPI 동기화 점검 결과

## 요약
- 점검 토픽 수: N
- 불일치 항목: N건
- 문서에만 있는 토픽: [목록]
- 코드에만 있는 토픽: [목록]

## 불일치 상세

### adapter.xxx.request
| 항목 | 코드 (Zod) | 문서 (AsyncAPI) | 상태 |
|------|-----------|----------------|------|
| fieldName | z.string() | type: string | 일치 |
| newField | z.number() | (없음) | 문서 누락 |

### adapter.xxx.result
...

## 권장 조치
- [ ] asyncapi.yaml에 `newField` 필드 추가 (adapter.xxx.request)
- [ ] ...
```

## 주의사항

- asyncapi.yaml을 직접 수정하지 마. 불일치 리포트만 생성해
- 응답 메시지의 공통 필드(message, requestId 등)도 빠짐없이 비교해
- 코드의 실제 Zod 스키마를 기준으로 판단해 (주석이나 타입이 아닌 런타임 스키마)
