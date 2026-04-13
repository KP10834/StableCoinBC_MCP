# release-note-mcp

> 커밋 히스토리 기반 릴리즈 노트 자동 생성

---

## 설정

```json
"release-note-mcp": {}
```

> 환경변수 없음. 프로젝트의 git 히스토리를 직접 읽음.

---

## 도구 (3개)

### `release_note`

커밋 히스토리를 파싱하여 릴리즈 노트 생성. Conventional Commits 형식 자동 분류 + 기능 영역 태깅.

```
"릴리즈 노트 생성해줘"
"v1.0.0부터 변경사항 정리해줘"
"v1.0.0..v1.1.0 릴리즈 노트 만들어줘"
```

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|:----:|------|
| `range` | string | | git ref 범위. 생략 시 최근 태그부터 HEAD |

**출력 예시:**

```markdown
# Release Note — v1.0.0..HEAD

**기간**: 2026-03-01 ~ 2026-04-01
**커밋 수**: 23

## 새로운 기능
- **[결제]** 수수료 계산 로직 추가 (`a1b2c3d`)
- **[계정]** 계정 삭제 기능 구현 (`d4e5f6g`)

## 버그 수정
- **[출금, 동시성 제어]** nonce 버그 수정 (`h7i8j9k`)

## Breaking Changes
- payment 메시지에 feeRate 필드 추가 (`m1n2o3p`)

## 영향받는 Kafka 토픽
- adapter.payment
- adapter.withdraw
```

---

### `release_commits`

릴리즈 범위의 커밋 목록을 테이블로 표시. 타입, 설명, 영향 영역 포함.

```
"최근 릴리즈 커밋 목록 보여줘"
```

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|:----:|------|
| `range` | string | | git ref 범위. 생략 시 최근 태그부터 HEAD |

---

### `release_tags`

태그 목록 조회. 최근 20개, 날짜순.

```
"태그 목록 보여줘"
```

---

## 자동 분류

### 커밋 타입

| 타입 | 분류 |
|------|------|
| `feat` | 새로운 기능 |
| `fix` | 버그 수정 |
| `refactor` | 리팩토링 |
| `perf` | 성능 개선 |
| `docs` `test` `chore` `ci` | 기타 |

### 기능 영역 (변경 파일 경로 기반)

| 키워드 | 영역 |
|--------|------|
| `account` | 계정 |
| `payment` | 결제 |
| `withdraw` | 출금 |
| `settlement` | 정산 |
| `collection` | 집금 |
| `deposit` | 입금 |
| `reconciliation` | 대사 |
| `confirm` | 트랜잭션 확인 |
| `balance` | 잔액 |
| `config` | 설정 |
| `nonce` `lock` `serial` | 동시성 제어 |
| `kafka` | 메시징 |
| `blockchain` `bundler` | 블록체인 |
| `persistence` `database` | DB |
