-- 事件記錄清理函式
-- 展覽結束後，定期執行此函式清理過期事件，避免資料庫無限成長
--
-- 使用方式（在 Neon console 執行）：
--   SELECT cleanup_old_events(365);   -- 刪除 365 天前的事件（預設）
--   SELECT cleanup_old_events(180);   -- 刪除 180 天前的事件
--
-- 建議：展覽結束後 3 個月執行一次，或每年定期清理一次

create or replace function cleanup_old_events(days_to_keep integer default 365)
returns integer
language plpgsql
as $$
declare
  deleted_count integer;
begin
  delete from events
  where created_at < now() - (days_to_keep || ' days')::interval;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
