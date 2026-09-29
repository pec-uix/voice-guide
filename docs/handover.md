# 語音導覽系統｜展覽方交接手冊

> 本文件是交接給展覽方的完整操作說明。開發者完成交接後，展覽方應能獨立完成所有日常操作，不需聯繫開發者。

---

## 一、系統架構一覽

```
參觀者手機掃 QR Code
     │
     ▼
語音導覽網站（Cloudflare Pages）
  ├─ 作品介紹頁：播放中文語音、顯示多語言逐字稿
  └─ 展覽清單頁：該展覽所有作品清單

     │ 資料儲存
     ├─ Neon（資料庫：作品文字、翻譯、數據）
     └─ Cloudflare R2（音檔儲存）
```

所有操作都在後台網站進行，不需要碰資料庫或程式碼。

---

## 二、帳號清單

> 請將以下欄位填寫完整後，列印並以實體方式或密碼管理軟體（如 1Password、Bitwarden）妥善保管。切勿以電子郵件或通訊軟體傳送明文密碼。

### Cloudflare（網站部署 + 音檔儲存）

| 項目 | 值 |
|---|---|
| 登入網址 | https://dash.cloudflare.com |
| 帳號 Email | |
| 密碼 | |
| 備用電話（2FA） | |
| Pages 專案名稱 | voice-guide |
| R2 Bucket 名稱 | voice-guide-audio |

### Neon（資料庫）

| 項目 | 值 |
|---|---|
| 登入網址 | https://console.neon.tech |
| 帳號 Email | |
| 密碼 | |
| 專案名稱 | |
| 連線字串（DATABASE_URL） | （另存，含機密，勿外流） |

### Google Cloud（OAuth 登入）

| 項目 | 值 |
|---|---|
| 登入網址 | https://console.cloud.google.com |
| 帳號 Email | |
| 密碼 | |
| 專案名稱 | |

### GitHub（原始碼）

| 項目 | 值 |
|---|---|
| 登入網址 | https://github.com |
| 帳號 | pec-uix（組織）|
| Repo 網址 | https://github.com/pec-uix/voice-guide |

### 後台管理網址

| 項目 | 值 |
|---|---|
| 正式網址 | |
| 後台登入網址 | （正式網址）/admin |

---

## 三、後台操作手冊

### 3-1. 登入

1. 用瀏覽器開啟後台登入網址（例：`https://voice-guide.pages.dev/admin`）
2. 點「以 Google 帳號登入」
3. 若出現「這個應用程式未經驗證」的警告，這是正常的：點「進階」→「前往〔應用程式名稱〕（不安全）」即可繼續。**同一個帳號之後再登入就不會再出現這個警告。**
4. 選擇已加入白名單的 Google 帳號，登入成功後會進入展覽管理頁面

> 如果無法登入，請確認你的 Google 帳號 email 是否已加入後台白名單（見 3-7 節）。

---

### 3-2. 管理展覽

進入後台 → 上方導覽列點「展覽」

**新增展覽**
1. 點右上角「新增展覽」
2. 填寫展覽名稱、展覽代碼（英文、數字，用於 QR Code 網址）、評論連結（如 Google 評論頁面）
3. 點「建立」

**編輯展覽**
1. 在展覽清單中點要編輯的展覽
2. 修改欄位後點「儲存」

**展覽入口 QR Code**
1. 在展覽清單中，每個展覽旁有「展覽 QR Code」按鈕
2. 點擊展開 QR Code 圖片
3. 點「下載 PNG」儲存到電腦，可直接印出或放進簡報

---

### 3-3. 管理作品

進入後台 → 上方導覽列點「作品」

**新增作品**
1. 點右上角「新增作品」
2. 填寫：
   - **作品代碼**：英文、數字（例：`artwork-001`），用於 QR Code 網址，建立後不建議更改
   - **所屬展覽**：選擇要放入哪個展覽（可不指定）
   - **中文標題**：作品名稱
   - **中文介紹**：作品說明文字
   - **購買連結**：此作品的購買頁面（選填）
3. 點「建立」→ 系統會自動產生英文和日文的翻譯草稿

**編輯作品**
1. 在作品清單中點作品名稱，進入編輯頁
2. 頁面分幾個區塊：

   **基本資料**：代碼、所屬展覽、藝術家、年代、封面圖片網址，改完點「儲存基本資料」

   **音檔**：上傳中文語音檔（MP3 / M4A），一件作品對應一個音檔

   **多語言內容**：中文、英文、日文三個語言各有獨立的標題、介紹、購買連結欄位。英文和日文由系統自動翻譯生成草稿，標記「待校對」；人工確認過後點「標記為已校對」

   **逐字稿**：每行格式為 `開始秒數,結束秒數,文字`（例：`0,9,這件作品名為…`），儲存後系統自動產生英文和日文翻譯草稿

**作品 QR Code**
1. 進入作品編輯頁，點右上角「📱 QR Code」
2. 展開後可下載該作品的專屬 QR Code PNG

---

### 3-4. 校對翻譯

新增作品或儲存中文內容後，英文、日文版本由 AI 自動翻譯，標記「待校對」。

**校對流程**：
1. 到「作品」清單，帶有橘色「待校對」數量標示的作品代表有未確認的翻譯
2. 點進作品編輯頁
3. 在「多語言內容」區塊，找到標記「待校對」的語言
4. 核對或修改翻譯文字
5. 確認無誤後點「標記為已校對」

> 標記已校對只影響後台的顯示狀態，前台一律會顯示最新的文字內容，不論是否已校對。

---

### 3-5. 上傳音檔

1. 進入作品編輯頁 → 找到「音檔」區塊
2. 點「選擇音檔」上傳 MP3 或 M4A 檔案
3. 上傳成功後可在頁面上直接播放確認

**注意事項**：
- 僅提供中文原音，不需上傳英文或日文版本
- 建議音檔格式：MP3 128kbps 以上，或 M4A/AAC
- 逐字稿的時間戳記要對應到這個音檔，上傳後如有調整過時間戳記需重新核對

---

### 3-6. 查看數據

進入後台 → 上方導覽列點「數據」

**總覽指標**：掃描次數（QR Code 被掃幾次）、播放次數、完整收聽次數、購買連結點擊數、評論連結點擊數

**每日趨勢**：近 30 天的掃描／播放／完聽趨勢折線圖

**語言分佈**：選擇不同語言的參觀者比例

**作品排行**：前 20 名作品的掃描、播放、完聽、購買點擊數

**展覽概況**：每個展覽的入場掃描數與評論點擊數

---

### 3-7. 新增後台管理員

新增一位可以登入後台的人，需要做**兩個步驟**（缺一不可）：

**步驟一：加入 Google Cloud Console 測試使用者**
1. 登入 Google Cloud Console → 選擇 voice-guide 專案
2. APIs & Services → OAuth consent screen
3. 往下找到「Test users」→ Add users
4. 輸入對方的 Gmail 信箱，儲存

**步驟二：加入後台白名單**  
執行以下 SQL（在 Neon 資料庫管理介面的 SQL Editor 執行）：
```sql
INSERT INTO admin_users (email) VALUES ('對方的gmail@example.com');
```
在 Neon 後台操作路徑：https://console.neon.tech → 選專案 → SQL Editor

**移除管理員**：
```sql
DELETE FROM admin_users WHERE email = '要移除的email@example.com';
```
（Neon SQL Editor 執行，只需從白名單移除即可，不用動 Google Console）

---

## 四、帳號擁有權轉移（開發者移交給展覽方）

> 這份清單是給開發者對照完成的，展覽方收到後請確認每個帳號都已實際轉移到自己掌管的信箱。

### Cloudflare
- [ ] 邀請展覽方 email 加入帳號（Members → Invite）並設為 Super Administrator
- [ ] 展覽方確認收到邀請並接受
- [ ] 開發者帳號從 Members 移除，或降為低權限

### Neon
- [ ] 在 Neon 專案 Settings → Members → Invite member，邀請展覽方 email 並設 Owner
- [ ] 展覽方接受邀請
- [ ] 開發者帳號移出，或移交整個組織帳號

### Google Cloud（OAuth）
- [ ] 在 Google Cloud Console → IAM → Add principal，加入展覽方 email，角色選 Owner
- [ ] 展覽方確認
- [ ] 開發者帳號從 IAM 移除

### GitHub
- [ ] 在 `pec-uix` 組織邀請展覽方 GitHub 帳號，設為 Owner
- [ ] 開發者帳號移出組織，或降為 Member

### 環境變數（最後更新）
Cloudflare Pages → Settings → Environment variables，確認以下機密都是展覽方自己的帳號所產生的（舊的 API Key 需作廢並換新的）：
- `DATABASE_URL`（展覽方自己的 Neon 帳號連線字串）
- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`（展覽方自己的 R2 API Token）
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`（展覽方自己的 Google Cloud 專案）
- `AUTH_SECRET`（自行產生一組新的隨機字串）

---

## 五、展覽結束後

### 資料保留

| 類型 | 建議保留期限 | 說明 |
|---|---|---|
| 作品文字、翻譯、逐字稿 | 永久 | 低儲存量，留著不佔費用 |
| 訪客事件記錄（掃描/播放） | 1–2 年 | 可用於之後展覽參考 |
| R2 音檔 | 看展覽方需求 | 佔儲存空間，若確定不再展出可刪除 |

刪除舊的事件資料（Neon SQL Editor）：
```sql
-- 刪除 2 年前的事件
DELETE FROM events WHERE created_at < now() - INTERVAL '2 years';
```

### 關閉服務

若決定完全關閉系統，依序：
1. 刪除 Cloudflare Pages 專案（Deployments → Delete project）
2. 刪除 R2 Bucket（清空後再刪除）
3. 刪除 Neon 專案（Settings → Delete project）
4. 在 Google Cloud Console 停用或刪除 OAuth Client（APIs & Services → Credentials）
5. 封存或刪除 GitHub Repo

---

## 六、帳號費用與續約

| 服務 | 費用 | 計費週期 | 說明 |
|---|---|---|---|
| Cloudflare Pages + R2 | $0（免費層） | — | Pages 免費，R2 前 10 GB 免費，超過才收費 |
| Neon | $0（免費層） | — | 閒置自動休眠，使用量不高不會超出免費限制 |
| Google Cloud | $0 | — | OAuth 登入本身免費，專案維持「測試中」狀態即可 |
| GitHub | $0（公有或私有 Repo） | — | 個人帳號私有 Repo 免費 |
| 網域 | 約 NT$300–500 / 年 | 每年 | 視域名而定，到期前 Cloudflare 會寄提醒信 |

**注意**：
- Cloudflare Pages 不會自動停止服務，費用為 $0，不需要特別續約
- Neon 免費層如果連續 30 天沒有任何資料庫請求，專案可能進入「inactive」狀態，需到 Neon 後台手動恢復，或是任何一筆 API 請求就會自動喚醒
- 網域是唯一有費用的項目，每年由域名持有人負責續約，**Cloudflare 會提前寄提醒信到帳號 email**

---

## 七、常見問題

**Q：登入時一直跳回登入頁面**  
A：確認你的 Google 帳號 email 是否在白名單中（見 3-7 節步驟二）。也確認兩個步驟都做了（Google Console 測試使用者 + Neon 白名單）。

**Q：翻譯草稿一直沒出現**  
A：Gemini API 有每日免費額度，極少數情況下可能暫時超限。等隔天重新儲存中文內容即可重新觸發翻譯。

**Q：音檔上傳失敗**  
A：確認 R2 環境變數在 Cloudflare Pages 後台都已正確設定。檔案大小建議不超過 50 MB。

**Q：QR Code 掃了沒有反應**  
A：確認手機有網路連線。也確認作品代碼正確、網站部署成功（Cloudflare Pages Deployments 頁面狀態應為 Active）。

**Q：需要更改網址（換網域）**  
A：到 Cloudflare Pages → Custom domains 設定新網域，並更新 Google Cloud Console 的 Authorized redirect URIs，再更新 Cloudflare Pages 環境變數中的 `AUTH_URL`。

---

## 八、聯絡開發者

| 項目 | 值 |
|---|---|
| 開發者姓名 | |
| Email | |
| 聯絡方式 | |
| 可協助的時間範圍 | |

> 建議在正式交接後保留 1–2 週的支援窗口期，讓展覽方熟悉操作後若有問題能快速解決。

---

*文件最後更新：2026 年 9 月*
