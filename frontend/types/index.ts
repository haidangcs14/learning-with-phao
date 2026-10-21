export interface User { id: string; email: string; username: string; full_name: string; avatar_url: string; role: "user" | "admin"; is_active: boolean }
export interface Meaning { part_of_speech: string; definition: string; translation_vi: string; examples: string[] }
export interface Word { id: string; word: string; slug: string; phonetic: string; level: string; topics: string[]; meanings: Meaning[]; synonyms: string[]; antonyms: string[]; collocations: string[] }
export interface Favorite { id: string; target_id: string; target_type: string; item?: Word | null }
export interface Card { id: string; word_id: string; status: string; word: Word }
export interface Question { id: string; question: string; options: string[]; level: string; topic: string }
export interface QuizResult { total: number; correct: number; accuracy: number; xp_awarded: number; results: { question_id: string; correct: boolean; your_answer: string; correct_answer: string; explanation: string }[] }
export interface Pair { pair_id: string; en: string; vi: string }
export interface LbRow { rank: number; user_id: string; username: string; xp: number }
export interface Brief { id: string; username: string; avatar_url: string }
export interface Friend extends Brief { total_xp: number }
export interface FriendRequest { id: string; user: Brief | null }
export interface SearchUser extends Brief { relation: "none" | "friends" | "pending_sent" | "pending_received" }
export interface Topic { id: string; title: string; prompt: string; level: string; hints?: string[] }
export interface SpeakingSession {
  id: string; topic_title: string; prompt: string; status: string; ai_status: string; transcript: string;
  metrics: { word_count: number; unique_words: number; words_per_minute: number | null; duration: number } | null;
  evaluation: Evaluation | null; created_at: string; xp_awarded?: number;
}
export interface ChatSession { id: string; title: string }
export interface ChatMessage { id: string; role: "user" | "assistant"; content: string; sources?: { type: string; id: string; title: string }[] }
export interface AdminStats {
  users: number; new_users_7d: number; active_users_today: number; words: number; questions: number;
  quiz_attempts: number; games_played: number; speaking_sessions: number; daily_active_users: { date: string; users: number }[];
}

export interface Evaluation {
  overall: number; fluency: number; pronunciation: number | null; grammar: number; vocabulary: number;
  feedback: { code: string; params: Record<string, string | number> }[];
  corrections: { original: string; better: string; why: string }[];
  comments: string[];
  stats?: { words?: number; unique?: number; wpm?: number | null; pauses?: number; pause_time?: number; fillers?: number };
  method?: Record<string, string | null>;
}
