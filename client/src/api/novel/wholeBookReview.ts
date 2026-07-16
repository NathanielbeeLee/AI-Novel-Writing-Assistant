import type { ApiResponse } from "@ai-novel/shared/types/api";
import type { WholeBookReviewReport } from "@ai-novel/shared/types/wholeBookReview";
import { apiClient } from "../client";

export async function listWholeBookReviews(novelId: string) {
  const { data } = await apiClient.get<ApiResponse<WholeBookReviewReport[]>>(`/novels/${novelId}/whole-book-reviews`);
  return data;
}
export async function runWholeBookReview(novelId: string, range: { startOrder: number; endOrder: number }) {
  const { data } = await apiClient.post<ApiResponse<WholeBookReviewReport>>(`/novels/${novelId}/whole-book-reviews`, range, {
    timeout: 15 * 60 * 1000,
  });
  return data;
}
export async function applyWholeBookReviewFeedback(novelId: string, reportId: string, issueIds?: string[]) {
  const { data } = await apiClient.post<ApiResponse<{ applied: number }>>(`/novels/${novelId}/whole-book-reviews/${reportId}/feedback`, { issueIds });
  return data;
}
