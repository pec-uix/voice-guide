# 逐字稿＋時間戳記製作流程（本機 Whisper，免費）

目標：把「女視力語音導覽」14 支中文音檔，自動轉出逐句文字＋開始／結束秒數，之後校對文字即可直接對應到 `transcript_segments` / `transcript_segment_texts`。

全程在你自己的電腦上跑，不上傳到任何服務，音檔內容不會外流。

## 步驟

1. **安裝 ffmpeg**（Whisper 讀取 m4a 需要它）
   - macOS：`brew install ffmpeg`
   - Windows：`choco install ffmpeg`，或到 ffmpeg.org 下載安裝

2. **安裝 Whisper**
   ```
   pip install -U openai-whisper
   ```

3. **建立輸出資料夾**
   ```
   mkdir transcripts
   ```

4. **執行轉錄**（對資料夾內所有 m4a 執行，輸出含時間戳記的 json）
   ```
   for f in "女視力語音導覽"/*.m4a; do
     whisper "$f" --language Chinese --model medium --output_format json --output_dir transcripts
   done
   ```
   - `--model` 可依電腦效能調整：`tiny` / `base` / `small` / `medium` / `large`，數字越大越準但越慢。這批音檔都很短（14 支、平均 36 秒），電腦普通的話用 `medium` 就好，跑不動再降到 `small`。
   - 第一次執行會自動下載模型檔案，需要網路，之後就不用了。

5. **校對文字**
   打開 `transcripts/` 底下每個 `.json`，檢查 `segments` 陣列裡每段的 `text` 是否正確。作品標題、人名這類專有名詞 Whisper 容易聽錯（例如「玫瑰噪音」可能被聽成別的字），這步不能省。

6. **對應到資料庫欄位**
   每個 segment 已經有 `start`、`end`、`text` 三個欄位，直接對應：
   - `start` → `transcript_segments.start_time`
   - `end` → `transcript_segments.end_time`
   - `text` → `transcript_segment_texts.text`（這筆是 `language_code = 'zh-TW'`）

## 直接貼給 Claude Code 的指令

進到專案資料夾、確認音檔也在裡面之後，貼這段：

> 幫我在這台電腦安裝 openai-whisper 套件，然後對「女視力語音導覽」資料夾底下的所有 .m4a 檔案執行語音轉文字，語言設定中文，模型用 medium，輸出 json 格式（含逐句時間戳記）到 transcripts 資料夾，每個音檔一個 json。

## 之後兩步（校對完中文再做）

1. **翻譯**：英文、日文版本要照著中文 json 同樣的段落數量去翻，每段對應同一組 `start`／`end`，這樣切換語言時反白的時間點才會一致。文字準備好後貼給我，我可以幫你翻譯校對。
2. **匯入格式**：等資料庫真的要匯入這些資料時，可以把 json 轉成 SQL insert 或 CSV，這部分等開發到後台階段我再幫你寫轉換腳本，現在規劃階段不用先做。
