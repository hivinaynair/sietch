import { type NextRequest, NextResponse } from "next/server";
import { advanceClip, isLive } from "@/features/settlement/desk-live";
import { advanceLimit } from "@/features/settlement/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!isLive()) {
    return NextResponse.json({ live: false, error: "not live" }, { status: 503 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limited = advanceLimit.check(ip);
  if (!limited.ok) {
    return NextResponse.json({ live: true, error: limited.error }, { status: 429 });
  }

  try {
    const state = await advanceClip();
    if (state.error === "already settled") {
      return NextResponse.json(state, { status: 409 });
    }
    return NextResponse.json(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "settle failed";
    return NextResponse.json({ live: true, error: message }, { status: 502 });
  }
}
