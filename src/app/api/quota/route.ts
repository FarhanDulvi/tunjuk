import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { DEMO_LIMIT, getDemoUsed, getUserId, isDemoEnabled } from "@/lib/quota";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isDemoEnabled()) {
    return NextResponse.json({ enabled: false, used: 0, limit: 0 });
  }

  const userId = getUserId(session);
  if (!userId) {
    return NextResponse.json({ enabled: false, used: 0, limit: 0 });
  }

  const used = await getDemoUsed(userId);
  return NextResponse.json({ enabled: true, used, limit: DEMO_LIMIT });
}
