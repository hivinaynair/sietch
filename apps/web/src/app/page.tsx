import { readClipState } from "@/features/settlement/desk-live";
import { SettlementRoom } from "@/features/settlement/settlement-room";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Server-read so the control is armed before hydrate — waiting on /api/clip/state left it disabled until Refresh.
  const initial = await readClipState();
  return <SettlementRoom initial={initial} />;
}
