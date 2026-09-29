import type { LanguageCode } from './types';

export const UI = {
  audioGuide:    { 'zh-TW': '語音導覽', en: 'Audio Guide',    ja: '音声ガイド' },
  chineseAudio:  { 'zh-TW': '（中文原音）', en: ' (Chinese audio)', ja: '（中国語音声）' },
  transcript:    { 'zh-TW': '逐字稿', en: 'Transcript',       ja: 'スクリプト' },
  noAudio:       { 'zh-TW': '音檔尚未上傳', en: 'Audio not available', ja: '音声未登録' },
  audioError:    { 'zh-TW': '音檔載入失敗，請重新整理', en: 'Audio failed to load, please refresh', ja: '音声の読み込みに失敗しました' },
  buy:           { 'zh-TW': '購買作品 ↗', en: 'Buy Artwork ↗', ja: '作品を購入 ↗' },
  review:        { 'zh-TW': '留下評價 ↗', en: 'Leave a Review ↗', ja: 'レビューを書く ↗' },
  pause:         { 'zh-TW': '暫停', en: 'Pause', ja: '一時停止' },
  play:          { 'zh-TW': '播放', en: 'Play',  ja: '再生' },
  works:         { 'zh-TW': '展覽作品', en: 'Works', ja: '展示作品' },
} as const;

export function t(key: keyof typeof UI, lang: LanguageCode): string {
  return UI[key][lang] ?? UI[key]['zh-TW'];
}
