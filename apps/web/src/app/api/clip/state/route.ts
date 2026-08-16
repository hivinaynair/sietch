import { NextResponse } from "next/server";
import { isLive, readClipState } from "@/features/settlement/desk-live";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await readClipState());
  } catch (error) {
    const message = error instanceof Error ? error.message : "desk unread";
    return NextResponse.json({ live: isLive(), phase: "idle", error: message }, { status: 503 });
  }
}
