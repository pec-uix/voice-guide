# 開工包｜語音導覽小工具

四份文件，帶去給 Claude Code CLI 就能開始。

## 這個資料夾裡有什麼

| 檔案 | 用途 |
|---|---|
| `CLAUDE.md` | 專案完整定義：目標、技術棧、架構、資料模型、路線、開發階段、帳號費用規劃。Claude Code 每次開工前都要先讀這份 |
| `schema.sql` | 資料庫結構（Postgres，給 Neon 用），照 `CLAUDE.md` 階段 1 執行 |
| `whisper-transcript-guide.md` | 音檔轉逐字稿＋時間戳記的操作流程，跟開發平行進行，不擋路 |
| `account-setup-guide.md` | Cloudflare、Neon、Google Cloud 三個服務的申請步驟（Gemini API 金鑰申請步驟包含在 Google Cloud 那節） |
| `README.md` | 這份文件，總覽和開工檢查清單 |

## Repo

https://github.com/pec-uix/voice-guide.git ，本機工作目錄 `/Users/minashih/voice-guide`

## 目前的關鍵決定（如果之後想法變了，回頭改 `CLAUDE.md`）

- 技術棧：Cloudflare Pages + Neon + Cloudflare R2 + Gemini API，$0/月，合法商用，且都不需要信用卡
- 支援**兩種 QR Code**：展覽入口（看作品清單）跟單一作品（直接進介紹頁），各自獨立路線
- 音檔僅保留中文原音，其他語言只做文字翻譯，不做語音轉換配音
- 逐字稿分段＋時間戳記，播放時同步反白目前讀到哪一段
- 英文／日文文字用 Gemini API 自動產生翻譯草稿（不需要信用卡，金鑰在 Google AI Studio 免費申請），後台標記「待校對」，人工確認過才算定稿
- 購買連結每件作品各自一個（放作品頁），評價連結整個展覽共用一個（只放展覽總覽頁）
- 購買／評價連結都用開新分頁方式開啟，不導離原本頁面
- **後台用 Google 登入＋email 白名單**，不用自己存密碼；後台一定要是展覽方能自己上網操作的介面
- 帳號（Cloudflare、Neon、Google Cloud OAuth 專案）都要開在展覽方名下，開發者以協作者身分加入
- 有基本的無障礙設計要求、資料驗證、外部服務容錯機制（見 `CLAUDE.md` 第 10、11 節）
- Firebase Hosting（公司網域）先不做，之後真的需要再拆分（做法已記錄在 `CLAUDE.md` 第 2 節）

## 開工檢查清單

- [ ] 把這五份文件放進 repo 根目錄
- [ ] 照 `account-setup-guide.md` 申請 Cloudflare、Neon、Google Cloud 帳號（先用開發者自己的帳號即可，交接前再轉移；Gemini API 金鑰在 Google AI Studio 免費申請，同樣不用綁卡）
- [ ] 在專案目錄跑 `claude`，貼下面那句開工指令
- [ ] 音檔逐字稿製作（`whisper-transcript-guide.md`）可以跟開發同時進行，不互相卡進度
- [ ] 每完成一個開發階段，回 `CLAUDE.md` 第 9 節把進度勾起來

## 給 Claude Code 的第一句話

> 讀一下 CLAUDE.md 和 schema.sql，跟我確認你理解的專案範圍和技術棧，然後我們從階段 0（開帳號、建 repo）開始，一步一步做，每個階段做完要跟我確認過我再往下一步。
