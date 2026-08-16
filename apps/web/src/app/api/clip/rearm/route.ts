import { type NextRequest, NextResponse } from "next/server";
import { isLive, rearmClip } from "@/features/settlement/desk-live";
import { rearmLimit, refuseRearm } from "@/features/settlement/rearm";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const factory = Boolean(process.env.SIETCH_FACTORY_ADDRESS);
  const refusal = refuseRearm({ live: isLive(), factory });
  if (refusal) {
    return NextResponse.json({ live: isLive(), error: refusal.error }, { status: refusal.status });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limited = rearmLimit.check(ip);
  if (!limited.ok) {
    return NextResponse.json({ live: true, error: limited.error }, { status: 429 });
  }

  try {
    const state = await rearmClip();
    if (state.error) {
      return NextResponse.json(state, { status: 502 });
    }
    return NextResponse.json(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "rearm failed";
    return NextResponse.json({ live: true, error: message }, { status: 502 });
  }
}
