# 帳號申請步驟｜Cloudflare、Neon、Google Cloud（含 Gemini API）

先用開發者自己的帳號申請即可，不用等展覽方一起弄。交接前再邀請展覽方加入或轉移擁有權（見 `CLAUDE.md` 第 7 節）。

## 1. Cloudflare（Pages 部署）

1. 到 https://dash.cloudflare.com/sign-up 用 email 註冊
2. 完成 email 驗證
3. 不需要信用卡就能建立帳號
4. **Pages 專案的建立先不用急**——這步驟等開發到階段 6（部署）、程式碼寫得差不多時再做（Workers & Pages → Create → Pages → Connect to Git，連結 `pec-uix/voice-guide` 這個 repo）

## 2. Neon（Postgres 資料庫）

1. 到 https://neon.tech，用 GitHub 或 Google 帳號登入（比較快，不用另外設密碼）
2. 建立新專案，取名 `voice-guide`
3. Region 選離台灣近的（如果有亞洲節點如新加坡、東京，選那個，延遲比較低）
4. 建立完成後，到專案的 Dashboard 找 **Connection String**，複製起來——這串就是之後要放進 `.env.local` 的 `DATABASE_URL`
5. 不需要信用卡

## 3. Google Cloud（僅用於 Google 登入，不需要開通付費方案）

1. 到 https://console.cloud.google.com，用 Google 帳號登入
2. 建立新專案，取名 `voice-guide-auth`
3. 左側選單找「API 和服務」→「OAuth 同意畫面」（新版介面可能顯示為「Google Auth Platform」）
4. User Type 選 **External**（因為展覽方用的是一般 Gmail，不是企業 Google Workspace 帳號）
5. 填基本資料：應用程式名稱（例如「語音導覽後台」）、使用者支援 email、開發人員聯絡資訊
6. Scopes 保持預設（`openid`、`email`、`profile`）就好，不用加任何額外權限
7. 到「測試使用者」加入你自己和展覽方的 email（之後每加一個新的後台使用者，都要回來這裡加一次，同時也要加進資料庫的 `admin_users` 表）
8. 到「憑證」→「建立憑證」→「OAuth 用戶端 ID」，應用程式類型選「網頁應用程式」
9. 已授權的重新導向 URI 先加本機開發用的：`http://localhost:3000/api/auth/callback/google`（正式上線網域確定後再回來加一組正式的）
10. 建立後會拿到 **Client ID** 和 **Client Secret**，複製起來，之後放進 `.env.local` 的 `GOOGLE_CLIENT_ID` 和 `GOOGLE_CLIENT_SECRET`
11. 全程不需要信用卡（OAuth 登入本身不用開通 Blaze 付費方案）

## 4. Gemini API（自動翻譯，不需要信用卡）

1. 到 https://aistudio.google.com，用 Google 帳號登入（跟前面申請 OAuth 用的同一個 Google 帳號即可）
2. 點「Get API key」→「Create API key in new project」
3. 複製產生的金鑰（格式開頭是 `AIza...`），之後放進 `.env.local` 的 `GEMINI_API_KEY`
4. 全程不需要信用卡
5. （選填）如果想確認免費層的資料不會被用於訓練模型，到帳號設定裡找資料使用選項手動關閉

## 申請完之後會拿到的東西

| 服務 | 要拿到的東西 | 放進哪個環境變數 |
|---|---|---|
| Neon | Connection String | `DATABASE_URL` |
| Google Cloud | Client ID、Client Secret | `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET` |
| Gemini | API Key | `GEMINI_API_KEY` |
| Cloudflare | （階段 6 才需要，R2 的 Access Key 屆時另外申請） | `R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_BUCKET` |

全部放進專案根目錄的 `.env.local`，這個檔案不要 commit 進 git（`CLAUDE.md` 第 10 節有列完整的環境變數清單可以對照）。
