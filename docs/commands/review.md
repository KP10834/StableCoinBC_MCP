# /review

> PR 코드 리뷰 후 GitHub에 인라인 코멘트 등록

---

## 사용법

```
/review                    → 현재 브랜치 PR 리뷰
/review 42                 → PR #42 리뷰
/review --approve          → 리뷰 후 승인 (APPROVE)
/review --request-changes  → 리뷰 후 변경 요청 (REQUEST_CHANGES)
```

---

## 동작 흐름

```
1. PR 정보 조회
   gh pr view → 번호, 브랜치, commit SHA

2. 기존 코멘트 조회 (중복 방지)
   gh api .../pulls/{n}/comments  → 인라인 코멘트 전체
   gh api .../pulls/{n}/reviews   → 리뷰 목록 전체

3. diff 가져오기
   gh pr diff → base 브랜치와 head 브랜치 전체 변경 내용

4. Claude가 분석
   버그 / 보안 / 성능 / 타입 / 스타일

5. 중복 제거
   이미 같은 파일+라인에 같은 주제 코멘트 있으면 제외

6. 결과 표시 + 이벤트 선택

7. GitHub PR에 등록
   코드 라인에 인라인 코멘트 + 전체 리뷰 요약
```

---

## 리뷰 이벤트 종류

리뷰를 등록할 때 최종 판정을 선택한다.

| 이벤트 | GitHub에 표시 | 의미 |
|--------|-------------|------|
| `COMMENT` | 💬 Commented | 코멘트만 달기. 승인/거절 없음 |
| `APPROVE` | ✅ Approved | PR 승인. 머지 가능 상태로 변경 |
| `REQUEST_CHANGES` | 🔴 Changes requested | 수정 요청. 브랜치 보호 규칙에 따라 머지 블로킹 |

**선택 방법:**

- `/review` → 분석 결과 보고 직접 선택
- `/review --approve` → 결과 확인 후 APPROVE로 등록
- `/review --request-changes` → 결과 확인 후 REQUEST_CHANGES로 등록

> 플래그가 있어도 분석 결과를 먼저 보여주고 확인 후 등록한다.

---

## 리뷰 결과 예시

```
## 코드 리뷰 결과 — PR #42: 출금 요청 잔액 부족 에러 처리

### 🔴 CRITICAL (1건)
- `src/service/withdraw.service.ts:38` — null 체크 누락: balance가 null이면 TypeError 발생

### 🟡 WARNING (2건)
- `src/handler/withdraw.handler.ts:12` — any 타입 사용
- `src/handler/payment.handler.ts:55` — ~~성능 이슈~~ (기존 코멘트 있음 — 생략)

### 🔵 INFO (1건)
- `src/domain/withdraw.port.ts:8` — 인터페이스 분리 고려

---
신규 등록 예정: 3건 / 중복 생략: 1건

PR에 리뷰를 등록할까요?
1) COMMENT
2) REQUEST_CHANGES
3) APPROVE
4) 취소
```

---

## GitHub에서 보이는 모습

- **인라인 코멘트** — 코드 diff 라인 옆에 직접 표시
- **전체 리뷰** — PR 상단에 Commented / Approved / Changes requested 뱃지
- **작성자** — `gh auth login`으로 인증한 계정 이름

---

## 중복 제거

다른 리뷰어가 이미 지적한 내용은 다시 달지 않는다.

**중복 판단 기준:**
- 같은 파일 + 같은 라인에 이미 코멘트가 있고 같은 주제일 때
- 전체 리뷰 본문에서 이미 같은 문제를 언급했을 때

중복 항목은 결과에 취소선으로 표시되고 등록에서 제외된다.

---

## 사전 요구사항

- `gh` CLI 설치 및 인증
  ```bash
  gh auth login
  ```
- PR이 이미 생성되어 있어야 함 (`/workflow pr`로 생성 가능)
