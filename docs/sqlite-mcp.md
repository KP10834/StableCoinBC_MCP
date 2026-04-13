# sqlite-mcp

> SQLite 데이터베이스 읽기 전용 조회

---

## 설정

```json
"sqlite-mcp": {
  "env": { "DATA_DIR": "./data" }
}
```

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `DATA_DIR` | `./data` | 데이터 디렉토리 |
| `SQLITE_DATABASES` | | DB 매핑 (`name1:file1.db,name2:file2.db`) |

> 기본 DB: `account.db`, `config.db`, `outbox.db`, `keys.db`

---

## 도구 (4개)

### `sqlite_tables`

테이블/컬럼 구조 조회. 이름, 타입, PK, NOT NULL 자동 추출.

```
"account DB 테이블 구조 보여줘"
```

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|:----:|------|
| `db` | string | | DB명. 생략 시 전체 |

---

### `sqlite_query`

SQL SELECT 쿼리 실행. `SELECT` / `WITH` / `PRAGMA` 만 허용.

```
"account DB에서 최근 생성된 계정 10개 보여줘"
```

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|:----:|--------|------|
| `db` | string | O | | DB명 |
| `sql` | string | O | | SQL 쿼리 |
| `limit` | number | | `50` | 결과 제한 |

---

### `sqlite_recent`

테이블의 최근 N건 조회.

```
"outbox 테이블 최근 5건 보여줘"
```

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|:----:|--------|------|
| `db` | string | O | | DB명 |
| `table` | string | O | | 테이블명 |
| `count` | number | | `10` | 조회 건수 |
| `order_by` | string | | | 정렬 컬럼 |

---

### `sqlite_count`

테이블별 행 수 조회.

```
"DB별 데이터 몇 건씩 있어?"
```

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|:----:|------|
| `db` | string | | DB명. 생략 시 전체 |
