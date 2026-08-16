import { NextResponse } from "next/server";
import { advanceClip, isLive } from "@/features/settlement/desk-live";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  if (!isLive()) {
    return NextResponse.json({ live: false, error: "tape" }, { status: 503 });
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
