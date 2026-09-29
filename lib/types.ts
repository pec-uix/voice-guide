export type LanguageCode = 'zh-TW' | 'en' | 'ja';
export const LANGUAGE_CODES: LanguageCode[] = ['zh-TW', 'en', 'ja'];

export interface Exhibition {
  id: string;
  code: string;
  name: string;
  description: string | null;
  review_url: string | null;
  created_at: string;
}

export interface Artwork {
  id: string;
  exhibition_id: string | null;
  code: string;
  cover_image_url: string | null;
  artist: string | null;
  year: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArtworkTranslation {
  id: string;
  artwork_id: string;
  language_code: LanguageCode;
  title: string;
  description: string | null;
  audio_url: string | null;
  purchase_url: string | null;
  is_reviewed: boolean;
  created_at: string;
  updated_at: string;
}

export interface TranscriptSegment {
  id: string;
  artwork_id: string;
  segment_index: number;
  start_time: string;
  end_time: string;
  texts?: TranscriptSegmentText[];
}

export interface TranscriptSegmentText {
  id: string;
  segment_id: string;
  language_code: LanguageCode;
  text: string;
  is_reviewed: boolean;
}

export type EventType =
  | 'scan'
  | 'play'
  | 'pause'
  | 'complete'
  | 'click_purchase'
  | 'click_review';

export interface Event {
  id: string;
  artwork_id: string | null;
  exhibition_id: string | null;
  language_code: string | null;
  event_type: EventType;
  source: string | null;
  created_at: string;
}
