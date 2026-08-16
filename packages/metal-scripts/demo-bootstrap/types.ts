import type { MandatePayload } from "@repo/metal-shared/mandate";
import type { DemoAgentName } from "@repo/metal-shared/types";
import type { Address, Hex } from "viem";

export type AgentFromServer = {
  agentName: DemoAgentName;
  address: Address;
};

export type SignedMandateForBootstrap = {
  payload: MandatePayload;
  signature: Hex;
};
