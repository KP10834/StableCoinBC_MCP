코드 변경의 영향 범위를 분석하여 backend 팀에 공유할 수 있는 문서를 생성해줘.

## 분석 대상

$ARGUMENTS 가 있으면 해당 git ref 범위를 사용하고, 없으면 현재 브랜치의 main 대비 변경사항을 분석해.
- 예: `/impact v1.2.0..v1.3.0` 또는 `/impact` (현재 브랜치 vs main)

## 분석 절차

1. `git diff --name-only <range>` 로 변경된 파일 목록을 가져와
2. 변경된 파일별로 아래 의존 그래프를 기반으로 영향받는 요소를 추적해:

### 의존 그래프 (파일 → 영향 요소)

**Kafka 핸들러 변경** (`src/adapter/in/kafka/handlers/`)
- 해당 핸들러의 구독/응답 토픽 식별
- 요청 스키마(Zod) 변경 여부 → 메시지 포맷 호환성 영향

**Application 서비스 변경** (`src/application/`)
- 해당 서비스를 호출하는 핸들러 → 관련 토픽 식별
- 응답 구조 변경 여부 확인

**Adapter 변경** (`src/adapter/out/`)
- 의존하는 서비스 목록:
  - `blockchain/` → AccountDeploy, Withdraw, Payment, Settlement
  - `bundler/` → AccountDeploy, Withdraw, Payment, Settlement, Collection
  - `persistence/` → 해당 Repository를 사용하는 모든 서비스
  - `redis/` → AccountDeploy, Withdraw, Payment, Settlement, Collection
  - `kafka/` → 모든 응답 발행에 영향

**Domain 변경** (`src/domain/`)
- 모델/포트 변경 → 구현체(adapter, application) 전체 영향 가능
- 에러 코드 변경 → 응답 메시지 변경

**Config 변경** (`src/infra/config/`)
- 환경변수/토픽명 변경 → 배포 시 환경변수 업데이트 필요

**Bootstrap 변경** (`src/bootstrap/`)
- 서비스 조립 변경 → 해당 서비스 기동에 영향

### 토픽 매핑 참조

| 기능 | 요청 토픽 | 응답 토픽 |
|------|---------|---------|
| 계정 생성 | adapter.account.create | adapter.account.created |
| 계정 배포 | adapter.account.deploy | adapter.account.deployed |
| 계정 삭제 | adapter.account.delete | (없음) |
| 출금 | adapter.withdraw.request | adapter.withdraw.result |
| 결제 | adapter.payment.request | adapter.payment.result |
| 정산 | adapter.settlement.request | adapter.settlement.result |
| 트랜잭션 확인 | adapter.common.confirm | adapter.common.confirmed |
| 잔액 조회 | adapter.balance.inquiry | adapter.balance.result |
| 설정 등록 | adapter.config.create | (없음) |
| 대사 | adapter.reconciliation.inquiry | adapter.reconciliation.result |
| DLQ | | adapter.dlq |

## 출력 형식

마크다운으로 아래 형식의 문서를 생성해:

```markdown
# 영향 범위 분석

## 변경 범위
- 브랜치/커밋 범위: ...
- 변경 파일 수: N개

## 영향받는 Kafka 토픽
| 토픽 | 영향 유형 | 변경 내용 |
|------|---------|---------|
| adapter.xxx.request | 스키마 변경 | ... |

## 영향받는 기능
| 기능 | 영향도 | 설명 |
|------|-------|------|
| 결제 | 높음 | ... |

## DB 스키마 변경
(해당 시)

## 환경변수 변경
(해당 시)

## Backend 확인 필요 사항
- [ ] ...
```
