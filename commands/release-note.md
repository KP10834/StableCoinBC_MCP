커밋 히스토리 기반 릴리즈 노트를 생성해줘.

## 동작

git 명령어를 직접 실행하여 릴리즈 노트를 생성한다. MCP 없이 동작.

## 절차

### 1단계: 범위 결정

$ARGUMENTS 파싱:
- 첫 번째 인자가 있으면 git ref 범위로 사용
  - `..` 포함: 그대로 사용 (예: `v1.0.0..v1.1.0`)
  - `..` 미포함: `<인자>..HEAD`로 변환 (예: `v1.0.0` → `v1.0.0..HEAD`)
- 인자 없으면: `git describe --tags --abbrev=0` 로 최근 태그 조회
  - 태그 있으면: `<태그>..HEAD`
  - 태그 없으면: `HEAD~20..HEAD`

### 2단계: 커밋 수집

```bash
git log <range> --pretty=format:"%H %s" --no-merges
```

각 커밋을 Conventional Commits 형식으로 파싱:
- `feat(scope): description` → type=feat, scope, description
- Breaking: `BREAKING CHANGE` 또는 `!:` 포함 여부

### 3단계: 변경 파일 및 영역 감지

각 커밋에 대해:
```bash
git diff-tree --no-commit-id --name-only -r <hash>
```

파일 경로 기반 기능 영역 태깅:

| 경로 키워드 | 영역 |
|------------|------|
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
| `nonce`, `lock`, `serial` | 동시성 제어 |
| `kafka` | 메시징 |
| `blockchain`, `bundler` | 블록체인 |
| `persistence`, `database` | DB |

### 4단계: 기간 조회

```bash
git log <range> --pretty=format:"%ci" --no-merges --reverse   # 시작일
git log <range> --pretty=format:"%ci" --no-merges -1           # 종료일
```

### 5단계: Kafka 토픽 감지

변경 파일 중 `kafka/handlers/` 경로에 `*.handler.ts` 파일이 있으면:
- `adapter.<handler-name>` 형태로 토픽 목록 구성

### 6단계: 릴리즈 노트 출력

커밋 타입별 분류:

| 타입 | 분류 |
|------|------|
| `feat` | 새로운 기능 |
| `fix` | 버그 수정 |
| `refactor` | 리팩토링 |
| `perf` | 성능 개선 |
| `docs` | 문서 |
| `test` | 테스트 |
| `chore`, `ci`, `build`, `style` | 기타 |

출력 형식:

```markdown
# Release Note — <range>

**기간**: <from> ~ <to>
**커밋 수**: N

## 새로운 기능

- **[영역]** description (`hash`)

## 버그 수정

- **[영역]** description (`hash`)

## Breaking Changes

- description (`hash`)

## 영향받는 Kafka 토픽

- adapter.payment
```

## 서브커맨드

$ARGUMENTS 첫 단어가 다음이면 다른 동작:

### `commits` — 커밋 목록 테이블

나머지 인자를 범위로 파싱하여 테이블 출력:

| 해시 | 타입 | 설명 | 영역 |
|------|------|------|------|

### `tags` — 태그 목록

```bash
git tag --sort=-creatordate --format='%(refname:short) %(creatordate:short)'
```

최근 20개를 테이블로 출력.

## 사용 예시

- `/release-note` — 최근 태그부터 HEAD까지 릴리즈 노트
- `/release-note v1.0.0` — v1.0.0부터 HEAD까지
- `/release-note v1.0.0..v1.1.0` — 특정 범위
- `/release-note commits` — 커밋 목록 테이블
- `/release-note commits v1.0.0` — 특정 범위 커밋 목록
- `/release-note tags` — 태그 목록
