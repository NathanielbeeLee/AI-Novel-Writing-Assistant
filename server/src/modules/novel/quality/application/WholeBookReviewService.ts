import { randomUUID } from "node:crypto";
import type { WholeBookReviewReport } from "@ai-novel/shared/types/wholeBookReview";
import { prisma } from "../../../../db/prisma";
import { runStructuredPrompt } from "../../../../prompting/core/promptRunner";
import { wholeBookRangeReviewPrompt, wholeBookReviewPrompt } from "../../../../prompting/prompts/novel/wholeBookReview.prompts";

const REPORT_MARKER = "whole_book_review_v1";

interface StoredPayload extends Omit<WholeBookReviewReport, "id" | "novelId" | "createdAt"> { kind: typeof REPORT_MARKER }

function parseReport(row: { id: string; novelId: string; issues: string | null; createdAt: Date }): WholeBookReviewReport | null {
  try {
    const payload = JSON.parse(row.issues ?? "") as StoredPayload;
    if (payload.kind !== REPORT_MARKER) return null;
    return { ...payload, id: row.id, novelId: row.novelId, createdAt: row.createdAt.toISOString() };
  } catch { return null; }
}

export class WholeBookReviewService {
  async list(novelId: string): Promise<WholeBookReviewReport[]> {
    const rows = await prisma.qualityReport.findMany({ where: { novelId, chapterId: null }, orderBy: { createdAt: "desc" }, take: 20 });
    return rows.map(parseReport).filter((item): item is WholeBookReviewReport => Boolean(item));
  }

  async run(novelId: string, input: { startOrder?: number; endOrder?: number }): Promise<WholeBookReviewReport> {
    const novel = await prisma.novel.findUnique({
      where: { id: novelId },
      select: {
        title: true, description: true, outline: true, structuredOutline: true,
        characters: { select: { name: true, role: true, castRole: true, importanceTier: true, currentState: true, currentGoal: true } },
        chapters: { orderBy: { order: "asc" }, select: { id: true, order: true, title: true, content: true, expectation: true, chapterStatus: true } },
        chapterSummaries: { select: { chapterId: true, summary: true, keyEvents: true, characterStates: true, hook: true } },
      },
    });
    if (!novel || novel.chapters.length === 0) throw new Error("当前小说还没有可审校的章节。");
    const startOrder = Math.max(1, input.startOrder ?? novel.chapters[0].order);
    const endOrder = Math.max(startOrder, input.endOrder ?? novel.chapters.at(-1)!.order);
    const chapters = novel.chapters.filter((chapter) => chapter.order >= startOrder && chapter.order <= endOrder);
    if (chapters.length === 0) throw new Error("指定范围内没有可审校的章节。");
    const summaryByChapterId = new Map(novel.chapterSummaries.map((item) => [item.chapterId, item]));
    const bookContract = { description: novel.description, outline: novel.outline, structuredOutline: novel.structuredOutline };
    const ranges = Array.from({ length: Math.ceil(chapters.length / 12) }, (_, index) => chapters.slice(index * 12, index * 12 + 12));
    const rangeReports = [];
    for (const rangeChapters of ranges) {
      const rangeStart = rangeChapters[0].order;
      const rangeEnd = rangeChapters.at(-1)!.order;
      const rangeEvidence = {
        bookContract,
        characters: novel.characters,
        chapters: rangeChapters.map((chapter) => {
          const summary = summaryByChapterId.get(chapter.id);
          return { order: chapter.order, title: chapter.title, expectation: chapter.expectation, status: chapter.chapterStatus, summary, opening: (chapter.content ?? "").slice(0, 700), ending: (chapter.content ?? "").slice(-700) };
        }),
      };
      const rangeResult = await runStructuredPrompt({
        asset: wholeBookRangeReviewPrompt,
        promptInput: { title: novel.title, startOrder: rangeStart, endOrder: rangeEnd, evidenceJson: JSON.stringify(rangeEvidence) },
        options: { temperature: 0.1, maxTokens: 3000, entrypoint: "whole_book_range_review", scope: novelId, triggerReason: "whole_book_review_range" },
      });
      rangeReports.push({ startOrder: rangeStart, endOrder: rangeEnd, report: rangeResult.output });
    }
    const result = await runStructuredPrompt({
      asset: wholeBookReviewPrompt,
      promptInput: { title: novel.title, startOrder, endOrder, evidenceJson: JSON.stringify({ bookContract, characters: novel.characters, rangeReports }) },
      options: { temperature: 0.15, maxTokens: 4200, entrypoint: "whole_book_review", scope: novelId, triggerReason: "user_requested_whole_book_review" },
    });
    const output = result.output;
    const payload: StoredPayload = {
      kind: REPORT_MARKER, startOrder, endOrder, summary: output.summary, strengths: output.strengths, scores: output.scores,
      issues: output.issues.map((issue) => ({ ...issue, id: randomUUID(), applied: false })),
    };
    const row = await prisma.qualityReport.create({
      data: {
        novelId, chapterId: null,
        coherence: output.scores.continuity,
        repetition: output.scores.payoff,
        pacing: output.scores.pacing,
        voice: output.scores.voice,
        engagement: output.scores.plot,
        overall: output.scores.overall,
        issues: JSON.stringify(payload),
      },
    });
    return { ...payload, id: row.id, novelId, createdAt: row.createdAt.toISOString() };
  }

  async applyFeedback(novelId: string, reportId: string, issueIds?: string[]): Promise<{ applied: number }> {
    const row = await prisma.qualityReport.findFirst({ where: { id: reportId, novelId, chapterId: null } });
    const report = row ? parseReport(row) : null;
    if (!row || !report) throw new Error("全书审校报告不存在。");
    const selected = report.issues.filter((issue) => !issueIds?.length || issueIds.includes(issue.id));
    let applied = 0;
    for (const issue of selected) {
      const exists = await prisma.creativeDecision.findFirst({ where: { novelId, sourceType: "whole_book_review", sourceRefId: issue.id } });
      if (exists) continue;
      await prisma.creativeDecision.create({ data: { novelId, category: `全书审校/${issue.category}`, content: issue.feedback, importance: issue.severity === "high" ? "high" : "normal", sourceType: "whole_book_review", sourceRefId: issue.id } });
      issue.applied = true; applied += 1;
    }
    const payload: StoredPayload = { kind: REPORT_MARKER, startOrder: report.startOrder, endOrder: report.endOrder, summary: report.summary, strengths: report.strengths, scores: report.scores, issues: report.issues };
    await prisma.qualityReport.update({ where: { id: row.id }, data: { issues: JSON.stringify(payload) } });
    return { applied };
  }
}
