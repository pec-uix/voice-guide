import type { LanguageCode } from './types';

export const UI = {
  audioGuide:    { 'zh-TW': '語音導覽', en: 'Audio Guide' },
  chineseAudio:  { 'zh-TW': '（中文原音）', en: ' (Chinese audio)' },
  transcript:    { 'zh-TW': '逐字稿', en: 'Transcript' },
  noAudio:       { 'zh-TW': '音檔尚未上傳', en: 'Audio not available' },
  audioError:    { 'zh-TW': '音檔載入失敗，請重新整理', en: 'Audio failed to load, please refresh' },
  buy:           { 'zh-TW': '購買作品 ↗', en: 'Buy Artwork ↗' },
  review:        { 'zh-TW': '留下評價 ↗', en: 'Leave a Review ↗' },
  pause:         { 'zh-TW': '暫停', en: 'Pause' },
  play:          { 'zh-TW': '播放', en: 'Play' },
  works:            { 'zh-TW': '展覽作品', en: 'Works' },
  feedbackTitle:    { 'zh-TW': '參觀心得', en: 'Your Experience' },
  feedbackPrompt:   { 'zh-TW': '這次展覽體驗如何？', en: 'How was your visit?' },
  feedbackComment:  { 'zh-TW': '留下文字回饋（選填）', en: 'Leave a comment (optional)' },
  feedbackSubmit:   { 'zh-TW': '送出', en: 'Submit' },
  feedbackSkip:     { 'zh-TW': '略過', en: 'Skip' },
  feedbackThanks:   { 'zh-TW': '謝謝你的回饋！', en: 'Thank you for your feedback!' },
} as const;

export function t(key: keyof typeof UI, lang: LanguageCode): string {
  return UI[key][lang] ?? UI[key]['zh-TW'];
}
