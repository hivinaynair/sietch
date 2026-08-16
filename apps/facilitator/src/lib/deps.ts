import { ERC8004_REGISTRY_ADDRESS } from "@repo/metal-shared/chains";
import { lookupIdentity } from "@repo/metal-shared/identity";
import { publicClient } from "./clients.js";
import { verifyMandateSignature } from "./mandate.js";
import type { VerifyDeps } from "./validate-mandate.js";

export const verifyDeps: VerifyDeps = {
  verifyMandateSignature,
  lookupIdentity,
  registryAddress: ERC8004_REGISTRY_ADDRESS,
  client: publicClient,
};
