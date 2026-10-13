# 資料庫遷移說明

每次修改資料庫 schema，都要新增一個遷移檔，不要直接修改舊的檔案。

## 命名規則

```
{序號}_{說明}.sql
```

例如：
- `001_initial_schema.sql`
- `002_add_cover_image_to_exhibitions.sql`
- `003_add_deleted_at_to_artworks.sql`

## 如何執行

把要執行的 `.sql` 檔案內容貼進 Neon console，或用 `psql` 執行：

```bash
psql $DATABASE_URL -f migrations/002_xxx.sql
```

## 注意事項

- 每個遷移只做一件事
- 只往前，不要修改已執行過的遷移檔
- 執行完後，把對應的變更同步回 `schema.sql`（保持 schema.sql 永遠是最新完整狀態）
