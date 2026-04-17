GitHub 이슈 기반 작업 워크플로우를 실행해줘.

## 동작

`workflow-mcp`의 도구들을 사용하여 이슈 → 브랜치 → 커밋 → PR 워크플로우를 자동화한다.

## 서브커맨드

$ARGUMENTS 의 첫 번째 단어로 서브커맨드를 결정해:

### `create` — 이슈 생성 + 브랜치 생성 + 체크아웃

예: `/workflow create 계정 생성 시 중복 체크 추가 --type feat`

`wf_create` 도구를 호출해:
- 나머지 텍스트 → `title`
- `--type <type>` → `type` (feat, fix, refactor, docs, chore, test. 기본: feat)
- `--body <text>` → `body`
- `--labels <labels>` → `labels` (콤마 구분)
- `--base <branch>` → `base` (분기 기준 브랜치)

### `start` — 기존 이슈로 작업 시작

예: `/workflow start 42` 또는 `/workflow start #42`

`wf_start` 도구를 호출해:
- 숫자 → `issue`
- `--type <type>` → `type` (생략 시 이슈 라벨에서 자동 판단)
- `--base <branch>` → `base`

### `commit` — 변경사항 커밋

예: `/workflow commit 중복 체크 로직 추가` 또는 `/workflow commit` (메시지 자동 생성)

`wf_commit` 도구를 호출해:
- 텍스트 → `message` (생략 시 diff 기반 정보 제공)
- `--type <type>` → `type` (생략 시 브랜치명에서 추출)

### `pr` — PR 생성

예: `/workflow pr` 또는 `/workflow pr --draft`

`wf_pr` 도구를 호출해:
- `--title <text>` → `title` (생략 시 이슈 제목 기반 자동 생성)
- `--draft` → `draft: true`
- `--base <branch>` → `base` (생략 시 부모 브랜치 자동 감지)

### `status` — 현재 작업 상태 확인

예: `/workflow status`

`wf_status` 도구를 호출해. 브랜치, 이슈, 변경사항, 커밋 이력, PR 상태를 보여준다.

### 인자 없음 — 상태 확인

`/workflow` 만 입력하면 `wf_status`를 호출해 현재 상태를 보여준다.

## 주의사항

- base 브랜치 자동 감지 시 확인을 요청할 수 있다. 사용자에게 전달해서 확인받아줘.
- 작업 중인 변경사항이 있으면 커밋/stash 후 진행하라고 안내한다.
