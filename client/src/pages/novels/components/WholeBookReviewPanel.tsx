import { useEffect, useState } from "react";
import type { WholeBookReviewReport } from "@ai-novel/shared/types/wholeBookReview";
import { applyWholeBookReviewFeedback, listWholeBookReviews, runWholeBookReview } from "@/api/novel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

export default function WholeBookReviewPanel({ novelId, maxOrder }: { novelId: string; maxOrder: number }) {
  const [range, setRange] = useState({ startOrder: 1, endOrder: Math.max(1, maxOrder) });
  const [reports, setReports] = useState<WholeBookReviewReport[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void listWholeBookReviews(novelId).then((result) => setReports(result.data ?? [])).catch(() => undefined); }, [novelId]);
  const report = reports[0];
  async function run() { setBusy(true); try { const result = await runWholeBookReview(novelId, range); if (result.data) setReports((items) => [result.data!, ...items]); toast.success("全书审校完成。"); } catch { toast.error("全书审校失败，请检查模型配置后重试。"); } finally { setBusy(false); } }
  async function apply(issueIds?: string[]) { if (!report) return; setBusy(true); try { const result = await applyWholeBookReviewFeedback(novelId, report.id, issueIds); toast.success(`已回灌 ${result.data?.applied ?? 0} 条建议，后续章节会自动读取。`); setReports((items) => items.map((item, index) => index ? item : ({ ...item, issues: item.issues.map((issue) => !issueIds?.length || issueIds.includes(issue.id) ? { ...issue, applied: true } : issue) }))); } finally { setBusy(false); } }
  return <Card><CardHeader><CardTitle>全书级审校与跨章节回灌</CardTitle></CardHeader><CardContent className="space-y-4">
    <p className="text-sm text-muted-foreground">AI 会跨章节查找人设漂移、因果断裂、节奏和伏笔问题。建议只有在你确认后才会进入后续章节生成。</p>
    <div className="flex flex-wrap items-end gap-2"><label className="text-xs">起始章<Input type="number" min={1} value={range.startOrder} onChange={(event) => setRange({ ...range, startOrder: Number(event.target.value) })} /></label><label className="text-xs">结束章<Input type="number" min={1} max={maxOrder} value={range.endOrder} onChange={(event) => setRange({ ...range, endOrder: Number(event.target.value) })} /></label><Button disabled={busy || maxOrder < 1} onClick={() => void run()}>{busy ? "处理中…" : "开始全书审校"}</Button></div>
    {report ? <div className="space-y-3"><div className="flex flex-wrap gap-2"><Badge>综合 {report.scores.overall}</Badge><Badge variant="outline">连续性 {report.scores.continuity}</Badge><Badge variant="outline">角色 {report.scores.character}</Badge><Badge variant="outline">情节 {report.scores.plot}</Badge><Button size="sm" variant="outline" disabled={busy} onClick={() => void apply()}>采用全部建议</Button></div><p className="text-sm">{report.summary}</p>{report.issues.map((issue) => <div key={issue.id} className="rounded-lg border p-3 text-sm"><div className="flex items-center gap-2"><strong>{issue.title}</strong><Badge variant={issue.severity === "high" ? "destructive" : "outline"}>{issue.severity}</Badge>{issue.applied ? <Badge>已回灌</Badge> : null}</div><p className="mt-1 text-muted-foreground">{issue.detail}</p><p className="mt-2">建议：{issue.recommendation}</p><Button className="mt-2" size="sm" variant="secondary" disabled={busy || issue.applied} onClick={() => void apply([issue.id])}>采用并回灌</Button></div>)}</div> : <p className="text-sm text-muted-foreground">还没有全书审校报告。</p>}
  </CardContent></Card>;
}
