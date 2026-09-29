# 語音導覽小工具｜完整專案定義

> 這份文件是整個專案的單一事實來源。開工前先讀過一遍，每個開發階段開始前都跟 Claude Code 說「讀一下 CLAUDE.md」。

## 1. 專案目標

參觀者掃展場作品旁的 QR Code，用手機瀏覽器（不需下載 App）開啟作品介紹頁；**也支援掃展覽入口的 QR Code，開啟該展覽的作品清單頁，再點進去看個別作品**。兩種 QR Code 各自獨立，一個對應單一作品，一個對應整個展覽。支援：
- 語音播放（播放／暫停／進度條），**僅提供中文原音**，不做其他語言的語音轉換或配音（避免使用 AI 轉換配音員聲音涉及的版權／語音權疑慮）
- 多語言切換（中文／英文／日文...），**切換的是畫面文字**（標題、介紹、逐字稿），音檔不會跟著切換。中文內容存檔後，英文／日文版本**用翻譯 API 自動產生草稿**，後台會標記「待校對」，展覽方或你確認過文字沒問題才算完稿
- 逐字稿呈現（多語言文字），**播放進度同步反白**：播到哪一段，畫面就反白對應的文字段落
- 外部導流：**購買商品頁面**（每件作品各自一個，放在作品頁）與**評價頁面**（如 Google 評價，整個展覽共用一個，只放在展覽總覽頁，不放在每個作品頁）
- 後台管理作品內容、記錄掃描與播放事件，可看每件作品的使用成效

服務對象：展覽方（非開發者），**後台必須是展覽方能自己上網操作的網頁介面**，不需要碰資料庫、不需要寫程式，就能編輯作品內容、上傳音檔、看數據。開發完成後展覽方要能獨立維運，不用每次改內容都找你。

## 2. 技術棧（已定案）

| 角色 | 服務 | 為什麼選它 |
|---|---|---|
| 前端＋後端 | Next.js（App Router）+ TypeScript，部署在 **Cloudflare Pages** | Pages Functions 免費層明文允許商業使用，自訂網域免費，不用像 Vercel Hobby 打擦邊球 |
| 資料庫 | **Neon**（Serverless Postgres） | 免費層閒置後自動休眠，下次查詢幾百毫秒內自動喚醒，不需要手動去後台恢復（跟 Supabase 免費層行為不同） |
| 檔案儲存 | **Cloudflare R2** | 免費 10GB，沒有流量費，串流音檔比 Google Drive 穩定，不會跳病毒掃描確認頁 |
| QR Code | `qrcode` npm 套件，前端或後台產生 | 網址結構固定即可，不需要額外服務 |
| 翻譯 | **Gemini API**（Google AI Studio） | 完全免費，不需要信用卡；免費額度依模型而定（例如 Flash-Lite 每天 1,000 次請求），這批內容量遠低於這個上限。用語言模型理解上下文翻譯，對文學性文字（如作品標題）通常比純詞庫比對的服務翻得自然。**注意**：免費層的資料預設可能被用於改善 Google 模型，可在設定裡手動關閉；後台仍有「待校對」機制把關，草稿品質不是問題 |
| 後台登入 | **NextAuth.js（Auth.js）+ Google Provider** | 免費，不用自己存密碼雜湊；展覽方用既有 Google 帳號登入，開發者只需維護一份 email 白名單 |
| 樣式 | Tailwind CSS | 開發速度快，Claude Code 熟悉 |

**目前這套完全免費（$0/月）**，且都允許商業使用。如果之後流量大幅成長，各服務都有對應付費方案可以無痛升級，不需要換架構。

### 如果想要「全部同一家廠商」

Cloudflare 自己也有免費資料庫 D1，可以取代 Neon，好處是帳號更集中，代價是 D1 是 SQLite 語法，跟下面的 schema（Postgres 語法）需要改寫。目前先用 Neon，之後有需要再評估要不要遷移。

### 暫緩事項：Firebase Hosting（公司網域）

公司內部有些系統掛在 Firebase Hosting（`xxx.web.app`），曾評估過把前台網址改掛過去，但**先不做**，原因：

- 申請 Firebase 專案要走公司內部流程，等待時間不可控，不該卡住開發進度
- 前後端分離（前台在 Firebase、API 在 Cloudflare）需要多處理 CORS，且 Next.js 要改成靜態輸出（`output: 'export'`），這些複雜度在專案還沒驗證可行前不需要先扛
- **晚一點再拆，成本可控**：等有一個能跑的版本後，如果公司真的要求要用 `xxx.web.app` 網域，再把前台部分抽出來部署到 Firebase Hosting，這時候已經有現成程式碼，改動範圍就是「加一層 CORS + 把輸出模式改成 export」，不是從零開始。反過來，如果一開始就為了配合公司網域把架構拆成兩個服務，結果公司流程卡住或最後決定不需要，就白白多背了這層複雜度

> 若之後真的要做這個拆分，可以參考本文件先前版本記錄的「前台／API 分離架構」（Firebase Hosting 放靜態頁面 + Cloudflare Pages Functions 提供 API，兩者用跨網域 fetch 串接）。

## 3. 系統架構

```
使用者手機掃 QR Code
        │
        ▼
Cloudflare Pages（Next.js 專案）
  ├─ 前台導覽頁（/artwork/[code]?lang=zh-TW）
  └─ 後台管理（作品 CRUD、音檔上傳、QR Code 產生）
        │        （共用 API Routes / Pages Functions）
        ▼
   ┌────┴────┐
   ▼         ▼
Neon        Cloudflare R2
(Postgres)  (音檔、圖片)
作品資料
事件記錄
```

## 4. 資料模型

完整 schema 見 `schema.sql`（Postgres 語法，Neon 可直接使用）。摘要：

- `admin_users`：後台登入白名單，只存允許登入的 email（用 Google 登入，不存密碼），要跟 Google Cloud Console 的「測試使用者」清單保持同步
- `exhibitions`：展覽，`code` 欄位對應展覽入口 QR Code 網址，`review_url` 是整個展覽共用的評價連結
- `artworks`：作品基本資料，`code` 欄位對應單一作品 QR Code 網址
- `artwork_translations`：各語言內容（標題、介紹、購買連結）。`audio_url` 只有中文（`zh-TW`）那筆會填值，其他語言留空——畫面切換語言只換文字，播放器固定播放中文音檔
- `transcript_segments`：逐字稿分段，記錄每段的開始／結束秒數，**時間軸以中文音檔為準**
- `transcript_segment_texts`：每個分段的多語言文字，播放同步反白時，用目前播放秒數對照 `transcript_segments` 找出當前段落，再用選定的語言從這張表取出對應文字
- `events`：掃描／播放／暫停／完成事件，用來做後台數據追蹤

路線總覽：

| 路線 | 誰會用到 | 說明 |
|---|---|---|
| `/exhibition/[code]?lang=zh-TW` | 參觀者（掃展場入口 QR Code） | 該展覽的作品清單，標題＋縮圖，點進去到個別作品頁；頁面上有整個展覽共用的評價連結 |
| `/artwork/[code]?lang=zh-TW` | 參觀者（掃作品旁 QR Code） | 單一作品介紹頁，播放中文語音、逐字稿同步反白；頁面上有這件作品各自的購買連結 |
| `/admin`（含子頁面） | 展覽方 | 登入後管理展覽／作品內容、上傳音檔、產生兩種 QR Code、看待校對狀態、看數據儀表板 |
| `/api/exhibitions`、`/api/exhibitions/[id]` | 前台／後台呼叫 | 展覽的讀取、新增、編輯 |
| `/api/artworks`、`/api/artworks/[id]` | 前台／後台呼叫 | 作品的讀取、新增、編輯 |
| `/api/events` | 前台呼叫 | 寫入掃描／播放／點擊事件 |

## 5. 專案結構（建議）

```
app/
  artwork/[code]/page.tsx      # 前台導覽頁（單一作品）
  exhibition/[code]/page.tsx   # 展覽入口頁（作品清單，點進去才是單一作品頁）
  admin/                       # 後台管理
    page.tsx                    # 登入（Google 登入，比對 admin_users 白名單）
    exhibitions/page.tsx        # 展覽清單／新增編輯，含展覽入口 QR Code 產生
    artworks/page.tsx           # 作品清單／新增編輯，含單一作品 QR Code 產生
    dashboard/page.tsx          # 數據儀表板（掃描／播放／點擊轉換率）
  api/
    exhibitions/route.ts        # 取得/新增展覽
    exhibitions/[id]/route.ts   # 編輯展覽、取得該展覽的作品清單
    artworks/route.ts          # 取得/新增作品
    artworks/[id]/route.ts     # 編輯/刪除單一作品
    events/route.ts            # 記錄掃描/播放事件
lib/
  db.ts                        # Neon client
  storage.ts                   # R2 client
  types.ts                     # 共用型別
components/
  AudioPlayer.tsx
  LanguageSwitcher.tsx
  TranscriptView.tsx              # 依 audio.currentTime 比對 transcript_segments，反白目前段落
schema.sql                     # 資料庫 schema，改動時同步更新這份
```

### 展覽入口 QR Code 怎麼運作

跟單一作品 QR Code是兩條獨立路線：
- 掃作品旁的 QR Code → `/artwork/[code]` → 直接看到該作品的介紹頁
- 掃展場入口／簡介牌的 QR Code → `/exhibition/[code]` → 看到這檔展覽底下所有作品的清單（標題＋縮圖），點進去才是個別作品頁

兩種掃描都要記事件：作品頁記 `artwork_id`，展覽清單頁記 `exhibition_id`（`events` 表的 `artwork_id` 和 `exhibition_id` 都可以是空的，但至少要有一個有值）。後台的 QR Code 產生功能要能分別產生這兩種——作品清單一個個產生，展覽入口另外單獨產生一個。

### 購買／評價連結的開啟方式

`purchase_url`（作品頁，每件作品各自一個）、`review_url`（展覽總覽頁，整個展覽共用一個，不重複放在每件作品頁）這兩種按鈕**都要用開新分頁的方式開啟**（`target="_blank"`），不要直接導離目前頁面。原因：使用者逛完商品頁或評價頁後，用手機瀏覽器的分頁切換就能直接回到導覽頁／展覽清單頁，逐字稿滾動位置或清單捲動位置還在，不用重新掃 QR Code。按鈕上加一個外部連結圖示（↗）提示會跳出去，作品頁的購買按鈕放在作品介紹、逐字稿內容之後，不要放最上面。

這兩種點擊都要記錄進 `events` 表：`click_purchase` 綁 `artwork_id`（哪件作品被點了購買），`click_review` 綁 `exhibition_id`（因為評價是展覽層級的）。後台數據除了掃描率、播放率，也能看到轉換率。

### 後台登入怎麼運作（Google 登入＋白名單）

不自己存密碼，改用 Google 登入驗證身分，登入後再比對白名單決定放不放行：

1. 在 Google Cloud Console 開一個新專案，設定 OAuth 同意畫面，User Type 選「外部」（因為展覽方用的可能是一般 Gmail，不是企業 Google Workspace 帳號），拿到 `Client ID` 和 `Client Secret`
2. 專案維持在「測試中」狀態即可，不用走 Google 的正式審核（審核流程通常要好幾週，對這種內部小工具沒必要）；「測試中」狀態上限 100 個測試使用者，對這個專案完全夠用
3. 每新增一個能登入後台的人，**兩個地方都要加**：Google Cloud Console 的「測試使用者」清單，以及資料庫的 `admin_users` 表——前者是 Google 那關能不能過，後者才是你自己在管理的真正權限清單
4. 前端用 NextAuth.js 串 Google Provider，登入成功拿到使用者的 email 後，在 `signIn` callback 裡查 `admin_users` 表，不在清單裡就拒絕登入，不給任何後台頁面的存取權
5. 因為專案沒走正式審核，使用者第一次登入會看到 Google「這個應用程式未經驗證」的警告畫面，這是正常現象，點「進階」→「前往〔應用程式名稱〕」即可繼續，之後同帳號登入不會再跳出來——先讓展覽方知道這件事，避免誤以為是詐騙網站

### 播放同步反白的實作方式

前端監聽 `<audio>` 的 `timeupdate` 事件，拿到目前播放秒數後，去比對 `transcript_segments` 裡哪一段的 `start_time`／`end_time` 包含這個時間點，找到對應的 `segment_id`，再用目前選的語言從 `transcript_segment_texts` 撈出文字並反白顯示。這是純前端邏輯，不需要額外的後端服務。

### 逐字稿時間戳記怎麼做（時間戳記僅需中文）

分段時間戳記不需要花錢的服務，這批音檔平均一支 36 秒、共 14 支，量不大，兩種免費做法都可行：

1. **手動標記**：整理逐字稿的同時，聽音檔記下每個句子／段落的開始秒數，用瀏覽器內建的播放器就能對照時間，14 支短音檔手動做並不會太耗時。
2. **本機跑 Whisper 自動產生時間戳記**：OpenAI 開源的 Whisper 模型可以在你自己的電腦上跑（免費、不用上傳到任何服務），輸出結果自帶逐句時間戳記（SRT/VTT 格式），你再校對文字是否正確即可，equivalent 於「逐字稿＋時間戳記」一次做完。可以直接請 Claude Code 幫你在本機安裝 `openai-whisper` 並跑這批音檔。

不管哪種做法，產出的中文逐字稿分段之後，英文／日文版本要照著同樣的段落數量去翻譯，才能共用同一組時間軸。

### 英文／日文自動翻譯怎麼運作

後台儲存中文內容（作品標題／介紹、逐字稿分段文字）時，**自動呼叫 Gemini API** 產生英文、日文的草稿版本，存進對應的 `artwork_translations` / `transcript_segment_texts`，並把 `is_reviewed` 設為 `false`。後台介面上，任何 `is_reviewed = false` 的內容要顯示「待校對」標記，展覽方或你看過、改過、確認沒問題後，把它標記為已校對（`is_reviewed = true`），前台才算是正式定稿——不代表沒校對就不會顯示，只是後台要清楚標出哪些是機器翻譯還沒人看過的。

流程：
1. 後台儲存／更新一筆中文內容
2. API 呼叫 Gemini，用固定的提示詞（例如「把以下中文翻成英文／日文，保留原本的文學語氣，只回傳翻譯結果，不要加任何說明」）把中文文字帶進去，拿回英文、日文譯文
3. 寫入資料庫，該筆英文／日文記錄 `is_reviewed = false`
4. 後台列表用篩選／標籤讓管理者一眼看出還有哪些待校對
5. 管理者手動修改文字後儲存，該筆記錄的 `is_reviewed` 改為 `true`

這個功能屬於階段 2（API 層）要串接的外部服務，階段 4（後台管理）要把「待校對」狀態做進介面。

## 6. 開發階段（依序進行，不要跳步）

| 階段 | 內容 | 完成標準 |
|---|---|---|
| 0 | 開帳號、建 repo | Cloudflare、Neon 帳號建立在展覽方名下，repo 初始化 |
| 1 | 資料模型 | 用 `schema.sql` 在 Neon 建表，關聯正確 |
| 2 | API 層 | 展覽 CRUD、作品 CRUD、逐字稿分段 CRUD、事件記錄、音檔上傳、串接 Gemini 自動翻譯，每組功能 curl 測過 |
| 3 | 前台頁面 | `/artwork/[code]` 單一作品頁（含逐字稿同步反白，見第 5 節）、`/exhibition/[code]` 展覽清單頁，參考簡報第 3、4 頁配置，實機測試可播放 |
| 4 | 後台管理（Google 登入＋白名單，不做多角色權限） | 展覽／作品內容 CRUD、音檔上傳、**兩種 QR Code 產生**（單一作品＋展覽入口）、待校對標記與篩選（見第 5 節「英文／日文自動翻譯怎麼運作」），展覽方自己登入就能操作，介面不能有需要看程式碼或資料庫才懂的東西 |
| 5 | 數據追蹤儀表板 | `events` 表做成圖表頁面 |
| 6 | 部署與測試 | 掛自訂網域，實機掃碼測試（注意 iOS Safari 自動播放限制）；**到展場現場實地測試**：Wi-Fi／訊號品質、QR Code 實際貼的高度和大小是否好掃、光線反光問題 |
| 7 | 交接 | 操作手冊、帳密清單交給展覽方 |

## 7. 帳號歸屬與費用規劃

- Repo：https://github.com/pec-uix/voice-guide.git ，本機工作目錄 `/Users/minashih/voice-guide`
- **開發階段先用開發者自己的帳號**（Cloudflare、Neon、Google Cloud、GitHub 都一樣，Gemini API 金鑰在 Google AI Studio 免費申請，同樣不用綁卡），不用等展覽方一起弄，申請步驟見 `account-setup-guide.md`
- **正式交接前**，再把這些帳號的擁有權轉移給展覽方，或邀請展覽方帳號加入、把開發者降為協作者——這是交接階段（階段 7）要做的事，不是開發一開始就要卡住的條件
- **Google Cloud 專案（僅用於 OAuth 登入）**：不需要開通付費的 Blaze 方案（OAuth 登入本身完全免費），維持「測試中」狀態即可，不用送審
- 目前技術棧免費層足以運行，**費用規劃為 $0/月**（網域購買費用另計，約每年 $10–15，需展覽方自行負擔）
- 若未來流量成長需要升級付費方案，屆時再評估，不影響現有架構
- Firebase Hosting 是否要接手前台網域，見第 2 節「暫緩事項」，先不列入階段 0 待辦

## 8. 交接文件（第 7 階段要準備）

- 怎麼在後台新增／編輯作品
- 怎麼看數據儀表板
- 帳號密碼清單保管方式
- 遇到問題的聯絡窗口
- **帳號擁有權轉移**：Cloudflare、Neon、Google Cloud、GitHub 從開發者帳號轉移給展覽方，或邀請展覽方帳號加入後把開發者降為協作者
- **展覽結束後的資料保留期限**：訪客掃描／播放記錄要留多久，過期後是否刪除，誰決定
- **帳號續約責任歸屬**：Cloudflare、Neon、網域，展覽結束後誰負責續約或關閉，避免帳單無人管理或服務忽然中斷

## 9. 目前進度

- [ ] 階段 0：開帳號、建 repo
- [ ] 階段 1：資料模型
- [ ] 階段 2：API 層
- [ ] 階段 3：前台導覽頁
- [ ] 階段 4：後台管理
- [ ] 階段 5：數據追蹤
- [ ] 階段 6：部署測試
- [ ] 階段 7：交接

> 每完成一個階段就勾起來，並簡短記錄下一步要做什麼，方便中斷後接續。

## 10. 開發慣例

- API 回傳統一用 `{ data, error }` 格式
- 環境變數放 `.env.local`，不要 commit（確認 `.gitignore` 有列進去）。需要的環境變數：`DATABASE_URL`（Neon 連線字串）、`R2_ACCESS_KEY_ID`／`R2_SECRET_ACCESS_KEY`／`R2_BUCKET`（Cloudflare R2）、`GEMINI_API_KEY`（Google AI Studio 申請，免費、不用綁卡）、`GOOGLE_CLIENT_ID`／`GOOGLE_CLIENT_SECRET`（Google OAuth）、`NEXTAUTH_SECRET`（NextAuth 加密 session 用，隨機字串即可）。正式環境的金鑰設定在 Cloudflare Pages 後台的環境變數，不進版本控制
- 每個階段做完先跑過一輪手動測試，再 commit
- `language_code` 用固定清單（`zh-TW` / `en` / `ja`），後台用下拉選單而不是讓使用者自己打字，避免打成 `zh-tw`、`zh_TW` 這種變體造成資料對不起來
- `transcript_segments` 存檔前驗證：`end_time` 要大於 `start_time`，同一作品的分段之間不能時間重疊
- 外部服務失敗時要有明確的降級行為，不能讓畫面空白或卡住：
  - Gemini 呼叫失敗或超過額度 → 該筆內容顯示中文原文，標記「翻譯生成中，稍後查看」，不要擋住整個儲存動作
  - 音檔從 R2 載入失敗 → 播放器顯示明確錯誤訊息（例如「音檔載入失敗，請重新整理」），不要靜音卡住讓使用者以為在載入

## 11. 無障礙設計

這是語音導覽工具，服務對象天生包含視力、聽力不便的參觀者，前台開發時要一併考慮，不是上線後才補：

- 文字與背景對比度符合基本可讀性（不要淺灰配白底這種低對比配色）
- 字級可調整，不要用固定死的極小字
- 圖片（作品縮圖、封面圖）要有 `alt` 文字，讓螢幕閱讀器能唸出來
- 逐字稿本身對聽障者是重要的替代方案，不是聽障者才需要的附加功能，同步反白的視覺呈現要清楚（不只是變色，對比度不足時單靠變色不容易被看出來，建議額外加底線或加粗）
- 按鈕、連結的可點擊範圍不要太小，手機操作要方便
