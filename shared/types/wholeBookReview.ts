export interface WholeBookReviewIssue {
  id: string;
  category: "continuity" | "character" | "plot" | "pacing" | "voice" | "payoff";
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
  evidence: string[];
  chapterOrders: number[];
  recommendation: string;
  feedback: string;
  applied?: boolean;
}

export interface WholeBookReviewReport {
  id: string;
  novelId: string;
  startOrder: number;
  endOrder: number;
  summary: string;
  strengths: string[];
  scores: { continuity: number; character: number; plot: number; pacing: number; voice: number; payoff: number; overall: number };
  issues: WholeBookReviewIssue[];
  createdAt: string;
}
