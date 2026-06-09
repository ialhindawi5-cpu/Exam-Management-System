import type { QuestionType, Difficulty } from "@prisma/client";

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MCQ: "Multiple Choice",
  CHECKBOX: "Checkboxes",
  DROPDOWN: "Dropdown",
  TRUE_FALSE: "True / False",
  SHORT_ANSWER: "Short Answer",
  ESSAY: "Long Answer",
  TEXT: "Text / Instructions",
  IMAGE: "Picture / Image",
};

// Whether a question type can be graded automatically with certainty.
export const IS_AUTO_GRADABLE: Record<QuestionType, boolean> = {
  MCQ: true,
  CHECKBOX: true,
  DROPDOWN: true,
  TRUE_FALSE: true,
  SHORT_ANSWER: false, // AI-assisted suggestion only
  ESSAY: false, // AI-assisted suggestion only
  TEXT: false, // not a question — informational text only
  IMAGE: false, // not a question — a picture only
};

// "Content" items that carry no answer and no points (informational only).
export const CONTENT_TYPES: QuestionType[] = ["TEXT", "IMAGE"];
export const isContentType = (t: QuestionType) => CONTENT_TYPES.includes(t);

// Choice-based types whose answer is one or more of a fixed list of options.
export const CHOICE_TYPES: QuestionType[] = ["MCQ", "CHECKBOX", "DROPDOWN"];
// Choice types that allow more than one correct answer.
export const MULTI_ANSWER_TYPES: QuestionType[] = ["CHECKBOX"];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
};

export const DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD"];

// All question types, in the order shown in the question-form dropdown.
export const QUESTION_TYPES: QuestionType[] = [
  "MCQ",
  "CHECKBOX",
  "DROPDOWN",
  "TRUE_FALSE",
  "SHORT_ANSWER",
  "ESSAY",
  "TEXT",
  "IMAGE",
];

// Types the AI generator can produce. Checkboxes/dropdown are created manually
// (the generator's prompt + parsing only cover these four).
export const AI_QUESTION_TYPES: QuestionType[] = [
  "MCQ",
  "TRUE_FALSE",
  "SHORT_ANSWER",
  "ESSAY",
];

// Lebanese (MEHE) grade levels, basic education (EB) through secondary.
export const GRADE_LEVELS = [
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9 (Brevet)",
  "Grade 10 (Secondary 1)",
  "Grade 11 (Secondary 2)",
  "Grade 12 (Baccalaureate)",
] as const;

export const LANGUAGES = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "fr", label: "Français", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export function dirFor(lang: string): "ltr" | "rtl" {
  return lang === "ar" ? "rtl" : "ltr";
}

// Default difficulty mix used by the auto-generator (percentages sum to 100).
export const DEFAULT_DIFFICULTY_MIX = { easy: 40, medium: 40, hard: 20 };

export const aiEnabledHint =
  "Set ANTHROPIC_API_KEY in .env to enable AI grading.";

// Lebanese (MEHE) default grading scale.
export const DEFAULT_TOTAL_MARKS = 20;
export const PASS_MARK_RATIO = 0.5; // 10/20

// MEHE-style verdict from a score out of `total`.
export function verdict(score: number, total: number): string {
  if (total <= 0) return "—";
  const ratio = score / total;
  if (ratio >= 0.9) return "Excellent";
  if (ratio >= 0.8) return "Very Good";
  if (ratio >= 0.7) return "Good";
  if (ratio >= 0.6) return "Fair";
  if (ratio >= PASS_MARK_RATIO) return "Pass";
  return "Fail";
}
