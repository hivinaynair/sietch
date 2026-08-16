import { httpBasic, localDev, vercelOidc } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

const sharedSecret = process.env.METAL_AGENT_SHARED_SECRET?.trim();

export default eveChannel({
  auth: [
    vercelOidc(),
    ...(sharedSecret
      ? [httpBasic({ username: "metal-web", password: sharedSecret }, { realm: "metal-agent" })]
      : []),
    localDev(),
  ],
});
