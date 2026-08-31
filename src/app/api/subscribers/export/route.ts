import { requireStaff } from "@/actions/helpers";
import { db } from "@/lib/db";

/**
 * Staff-only CSV export of captured newsletter subscribers (MKT-208), so the
 * owner can import the owned lead list into an ESP / WhatsApp broadcast.
 * Cells are formula-injection-safe (SEC-108) even though emails rarely trigger it.
 */
function csvCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(guarded)
    ? `"${guarded.replaceAll('"', '""')}"`
    : guarded;
}

export async function GET(): Promise<Response> {
  try {
    await requireStaff();
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const subscribers = await db.subscriber.findMany({
    orderBy: { createdAt: "desc" },
    select: { email: true, source: true, createdAt: true },
  });

  const header = ["email", "source", "subscribedAt"];
  const rows = subscribers.map((s) => [
    csvCell(s.email),
    csvCell(s.source ?? ""),
    csvCell(s.createdAt.toISOString()),
  ]);
  const csv = [header, ...rows].map((r) => r.join(",")).join("\r\n") + "\r\n";

  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="resinriva-subscribers-${stamp}.csv"`,
    },
  });
}
