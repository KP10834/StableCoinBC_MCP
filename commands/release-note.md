릴리즈 노트를 생성해줘.

## 범위

$ARGUMENTS 가 있으면 해당 git ref 범위를 사용해.
- 예: `/release-note v1.2.0..v1.3.0` → 태그 간 비교
- 예: `/release-note v1.2.0` → 해당 태그부터 HEAD까지
- 인자 없으면 → 가장 최근 태그부터 HEAD까지 (`git describe --tags --abbrev=0`으로 최근 태그 찾기)

## 절차

1. `git log <range> --pretty=format:"%H %s" --no-merges` 로 커밋 목록 가져오기
2. Conventional Commits 형식(`type: 설명` 또는 `type(scope): 설명`)으로 파싱
3. 타입별 분류:
   - `feat` → 새로운 기능
   - `fix` → 버그 수정
   - `refactor` → 리팩토링
   - `perf` → 성능 개선
   - `docs` → 문서
   - `test` → 테스트
   - `chore` → 기타
4. 각 커밋의 변경 파일도 확인하여 영향받는 기능 영역 태깅
5. BREAKING CHANGE가 있으면 별도 섹션으로 분리

## 기능 영역 매핑

커밋의 변경 파일 경로로 기능 영역을 판별해:
- `account` → 계정 관리
- `payment` → 결제
- `withdraw` → 출금
- `settlement` → 정산
- `collection` → 집금
- `reconciliation` → 대사
- `confirm` → 트랜잭션 확인
- `balance` → 잔액 조회
- `config` → 설정
- `nonce` / `lock` / `serial` → 동시성 제어
- `kafka` → 메시징
- `blockchain` / `bundler` → 블록체인 연동
- `persistence` / `database` → 데이터베이스

## 출력 형식

```markdown
# Release Note - [버전 또는 범위]

**기간**: YYYY-MM-DD ~ YYYY-MM-DD
**커밋 수**: N

## 새로운 기능
- **[영역]** 설명 (`커밋해시 앞 7자`)

## 버그 수정
- **[영역]** 설명 (`커밋해시 앞 7자`)

## 리팩토링
- **[영역]** 설명 (`커밋해시 앞 7자`)

## 기타
- 설명 (`커밋해시 앞 7자`)

## Breaking Changes
(해당 시)

## 영향받는 Kafka 토픽
- 변경된 토픽 목록 (있는 경우)
```

## 주의사항

- 커밋 메시지가 한국어이므로 그대로 사용해
- Conventional Commits prefix 다음의 한국어 설명을 그대로 릴리즈 노트에 포함해
- 같은 영역의 관련 커밋은 그룹핑하되, 커밋 해시는 개별로 표시해
