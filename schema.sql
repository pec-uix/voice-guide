-- 語音導覽小工具｜資料庫 Schema (Neon / Postgres)
-- 設計原則：
-- 1. 一個作品（artwork）可以有多種語言內容，內容放在 artwork_translations
-- 2. 掃描與播放事件統一記在 events 表，用 event_type 區分，方便後台做數據追蹤
-- 3. 先求 MVP 能跑，權限管理、多角色之後再加（但後台至少要有 admin_users 這組單一登入帳號）
-- 4. language_code 用 check constraint 鎖定固定清單，避免後台打錯字造成資料對不起來

create extension if not exists "uuid-ossp";

-- 後台登入白名單：用 Google 登入，這張表只存允許登入的 email，
-- 不存密碼（驗證身分交給 Google，這裡只做授權判斷）
create table admin_users (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,             -- 要跟 Google Cloud Console 的「測試使用者」清單保持同步
  created_at timestamptz not null default now()
);

-- 展覽：每檔展覽對應一組入口 QR Code，掃了之後看到該展覽的作品清單
create table exhibitions (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,              -- 用在展覽入口 QR Code 網址，例如 EXPO01
  name text not null,
  description text,
  review_url text,                        -- 評價連結（如 Google 評價），整個展覽共用一個，
                                           -- 只在展覽總覽頁顯示，不放在個別作品頁
  created_at timestamptz not null default now()
);

-- 作品（語言無關的基本資料）
create table artworks (
  id uuid primary key default uuid_generate_v4(),
  exhibition_id uuid references exhibitions(id) on delete set null,
  code text not null unique,              -- 用在 QR Code 網址，例如 A01、B12
  cover_image_url text,                   -- 作品主圖
  artist text,                            -- 作者（若各語言譯名不同，可搬進 translations）
  year text,                              -- 年代
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 各語言內容（一個作品對多個語言）
create table artwork_translations (
  id uuid primary key default uuid_generate_v4(),
  artwork_id uuid not null references artworks(id) on delete cascade,
  language_code text not null,            -- 固定清單，見下方 check constraint
  title text not null,
  description text,                       -- 簡短介紹文字
  audio_url text,                         -- 語音檔案網址（Cloudflare R2）。僅中文（zh-TW）填值，
                                           -- 其他語言留空：語言切換只換文字，播放器固定播中文原音，
                                           -- 不做語音轉換／配音，避免涉及配音員聲音的版權疑慮
  purchase_url text,                      -- 導流連結：購買商品頁面網址（純連結，不經過自動翻譯，
                                           -- 如果不同語言有各自的商品頁，後台手動填不同網址即可）
  is_reviewed boolean not null default false, -- false = 翻譯 API 自動產生的草稿，尚未人工校對
                                               -- 中文版直接視為已校對；建立時可設 true
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (artwork_id, language_code),
  constraint artwork_translations_language_code check (language_code in ('zh-TW', 'en', 'ja'))
);

-- 逐字稿分段：時間戳記以中文原音為準，播放同步反白用
create table transcript_segments (
  id uuid primary key default uuid_generate_v4(),
  artwork_id uuid not null references artworks(id) on delete cascade,
  segment_index integer not null,         -- 播放順序，從 0 開始
  start_time numeric(6,2) not null,       -- 段落開始秒數，對應中文音檔
  end_time numeric(6,2) not null,         -- 段落結束秒數
  unique (artwork_id, segment_index),
  constraint transcript_segments_time_order check (end_time > start_time)
);

-- 每個分段的多語言文字（同一組時間軸，各語言各自的文字內容）
create table transcript_segment_texts (
  id uuid primary key default uuid_generate_v4(),
  segment_id uuid not null references transcript_segments(id) on delete cascade,
  language_code text not null,            -- 固定清單，見下方 check constraint
  text text not null,
  is_reviewed boolean not null default false, -- false = 翻譯 API 自動產生的草稿，尚未人工校對
  unique (segment_id, language_code),
  constraint transcript_segment_texts_language_code check (language_code in ('zh-TW', 'en', 'ja'))
);

-- 事件記錄：掃描、播放、暫停、完成播放...都記在這裡
-- artwork_id 和 exhibition_id 至少要有一個：
--   單一作品 QR Code 掃描 → artwork_id 有值
--   展覽入口 QR Code 掃描 → exhibition_id 有值，artwork_id 留空
create table events (
  id uuid primary key default uuid_generate_v4(),
  artwork_id uuid references artworks(id) on delete cascade,
  exhibition_id uuid references exhibitions(id) on delete cascade,
  language_code text,                     -- 使用者當下選的語言
  event_type text not null,               -- 'scan' | 'play' | 'pause' | 'complete' | 'click_purchase' | 'click_review'
  source text,                            -- QR Code 來源位置，例如展場入口、A01牌卡
  created_at timestamptz not null default now(),
  constraint events_has_target check (artwork_id is not null or exhibition_id is not null)
);

create index idx_artwork_translations_artwork_id on artwork_translations(artwork_id);
create index idx_transcript_segments_artwork_id on transcript_segments(artwork_id);
create index idx_transcript_segment_texts_segment_id on transcript_segment_texts(segment_id);
create index idx_events_artwork_id on events(artwork_id);
create index idx_events_exhibition_id on events(exhibition_id);
create index idx_events_type_created_at on events(event_type, created_at);

-- 常用查詢範例：
-- 每件作品的掃描次數
-- select artwork_id, count(*) from events where event_type = 'scan' group by artwork_id;

-- 各語言使用比例
-- select language_code, count(*) from events where event_type = 'scan' group by language_code;
