코드와 AsyncAPI 문서의 불일치를 감지하고, 확인 후 수정·검증·PR까지 진행해줘.

## 전체 프로세스

### 1단계: 불일치 확인

다음 명령어로 dry-run 실행해:

```bash
npm run sync-docs
```

출력 결과를 파싱해서 불일치 항목을 보여줘:

```
## AsyncAPI 동기화 점검 결과

| 토픽 | 필드 | 변경 내용 |
|------|------|---------|
| adapter.payment.request | feeRate | 추가 (type: string) |
| adapter.withdraw.request | nonce | 타입 변경 (number → string) |
```

불일치가 없으면 "동기화 상태입니다" 보고하고 종료.

### 2단계: 수정 여부 확인

불일치가 있으면 사용자에게 물어봐:

```
위 N건을 수정할까요? (y/n)
```

`n`이면 종료.

### 3단계: Docs 레포 확인 및 클론

`package.json`의 `syncDocs.asyncapiPath`에서 Docs 레포 디렉토리 경로를 추출해.

해당 디렉토리가 없으면:
- `syncDocs.docsRepo`에서 GitHub 레포 이름 읽기
- 현재 프로젝트와 동일한 상위 디렉토리에 클론:

```bash
git clone https://github.com/<docsRepo>.git <docsDir>
```

### 4단계: asyncapi.yaml 수정

```bash
npm run sync-docs -- --fix
```

수정 후 Docs 레포에서 git diff로 실제 변경 내용을 보여줘:

```bash
git -C <docsDir> diff
```

### 5단계: 유효성 검증

asyncapi.yaml이 올바른지 확인:

```bash
npx --yes @asyncapi/cli validate <asyncapiPath>
```

실패하면 에러 내용을 보여주고 중단.

### 6단계: 로컬 미리보기 확인

AsyncAPI Studio를 로컬에서 실행해:

```bash
npx --yes @asyncapi/cli start studio <asyncapiPath>
```

브라우저에서 확인할 수 있도록 URL을 알려주고 (기본: http://localhost:3210):

```
AsyncAPI Studio가 실행됐습니다: http://localhost:3210
브라우저에서 확인 후 계속하려면 엔터를 눌러주세요.
```

사용자가 확인 완료하면 Studio 프로세스를 종료하고 다음 단계로 진행.
확인 불가 또는 문제가 있으면 중단.

### 7단계: commit → push → PR

`wf_commit` 도구를 호출해:
- `message`: `"docs: sync asyncapi.yaml with code changes"`

완료되면 `wf_pr` 도구를 호출해.

PR URL을 보여주고 완료 보고.

## 오류 처리

| 상황 | 조치 |
|------|------|
| `syncDocs.docsRepo` 없음 | `package.json` 설정 안내 후 중단 |
| git clone 실패 | 에러 메시지 + 수동 클론 안내 |
| validate 실패 | diff 보여주고 수동 확인 요청 |
| Studio 실행 실패 | 에러 메시지 + validate 결과만으로 진행 여부 물어보기 |
| 미리보기 확인 불가 | 중단 |
| `/workflow` 실패 | 에러 메시지 그대로 전달 |

## package.json 설정 예시

```json
{
  "syncDocs": {
    "docsRepo": "StableCoinTF/StableCoinBC_Adapter_Docs",
    "asyncapiPath": "../StableCoinBC_Adapter_Docs/asyncapi.yaml"
  }
}
```

## 사용 예시

- `/sync-docs` — 전체 프로세스 실행
