export interface ExamOption { key: string; text: string }
export interface ExamQuestion { no: number; type: "mc" | "fill"; prompt: string; options: ExamOption[]; inline: boolean; correct?: string[]; explanation?: string }
export interface ExamGroup { id: string; section: string; kind: "normal" | "listening"; instruction: string; passage: string[]; questions: ExamQuestion[] }
export interface PublicExam { id: string; title: string; duration_minutes: number; total_score: number; question_count: number; has_audio: boolean; groups: ExamGroup[]; transcript?: string }
export interface Detail { no: number; type: string; user: string; correct: string[]; is_correct: boolean; scored: boolean }
export interface ExamResult { score: number; max_score: number; correct_count: number; scored_count: number; answered_count: number; total_questions: number; details: Detail[] }
export interface Attempt { id: string; exam_id: string; status: string; answers: Record<string, string>; started_at: number; deadline: number; server_now: number; exam: PublicExam }
export interface ResultView { id: string; result: ExamResult; answers: Record<string, string>; submitted_at: number; exam: PublicExam }
export interface ExamSummary { id: string; title: string; duration_minutes: number; total_score: number; question_count: number; has_audio: boolean; has_listening: boolean; status?: string; attempts?: number; source_filename?: string; my?: { best: number; max: number; count: number } | null }
