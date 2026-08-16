import { homedir } from "node:os";
import { join } from "node:path";
import { getAddress } from "../apps/web/node_modules/viem/_esm/index.js";

/**
 * Fresh T-bill + desk for a live walk. Same receipts, empty usedTransfer, books 1 / 0.
 *
 * Reusing the previous sTBILL would leave shares on 0x2222… from the last settle,
 * so idle books would already show Paul holding. Prints the vercel env commands;
 * does not write Vercel itself.
 */
const ROOT = join(import.meta.dir, "..");
const CONTRACTS = join(ROOT, "contracts");
const BROADCAST = join(CONTRACTS, "broadcast/Rearm.s.sol/84532/run-latest.json");
const CHAIN_JSON = join(ROOT, "artifacts/demo/chain.json");
const RPC = process.env.SIETCH_RPC_URL ?? "https://sepolia.base.org";

const PROGRAM_VKEY = "0x00035e8be65b2881b5409b3238047ddd679c9cce04cb4140973e04e9ed3330cd";
const POLICY_HASH_V1 = "0x3e9abaca0aad9ede81f4474766c846d8539f70688e1c8f521bbe1597874e3dc4";

const recordOnly = process.argv.includes("--record");

await loadDotenv(join(CONTRACTS, ".env"));

if (!recordOnly) {
  if (!process.env.PRIVATE_KEY) {
    console.error("Set PRIVATE_KEY in contracts/.env");
    process.exit(1);
  }
  const foundry = join(homedir(), ".foundry/bin");
  const proc = Bun.spawn(
    [
      "forge",
      "script",
      "script/Rearm.s.sol:RearmScript",
      "--rpc-url",
      RPC,
      "--broadcast",
      "--slow",
    ],
    {
      cwd: CONTRACTS,
      env: {
        ...process.env,
        PATH: `${foundry}:${process.env.PATH ?? ""}`,
        PROGRAM_VKEY,
        CHANI_POLICY_HASH: POLICY_HASH_V1,
        PAUL_POLICY_HASH: POLICY_HASH_V1,
      },
      stdout: "inherit",
      stderr: "inherit",
    },
  );
  const code = await proc.exited;
  if (code !== 0) {
    process.exit(code);
  }
}

const broadcast = await Bun.file(BROADCAST).json();
const record = recordsFromBroadcast(broadcast);
await Bun.write(CHAIN_JSON, `${JSON.stringify(record, null, 2)}\n`);

console.log("");
console.log(`tbill ${record.tbill}`);
console.log(`desk  ${record.desk}`);
console.log(`block ${record.deployBlock}`);
console.log("");
console.log(
  "Wrote artifacts/demo/chain.json. Set these on Vercel, then redeploy. Do not walk the desk.",
);
console.log("");
for (const target of ["production", "preview", "development"]) {
  console.log(`vercel env rm SIETCH_DESK_ADDRESS ${target} --yes`);
  console.log(`printf '%s' '${record.desk}' | vercel env add SIETCH_DESK_ADDRESS ${target}`);
  console.log(`vercel env rm SIETCH_FROM_BLOCK ${target} --yes`);
  console.log(`printf '%s' '${record.deployBlock}' | vercel env add SIETCH_FROM_BLOCK ${target}`);
}

function recordsFromBroadcast(broadcast) {
  const tbillTx = broadcast.transactions.find(
    (tx) => tx.contractName === "TBill" && tx.transactionType === "CREATE",
  );
  const deskTx = broadcast.transactions.find(
    (tx) => tx.contractName === "Desk" && tx.transactionType === "CREATE",
  );
  const mintTx = broadcast.transactions.find((tx) => tx.function?.startsWith("mint("));
  if (!tbillTx || !deskTx || !mintTx) {
    throw new Error("Rearm broadcast missing TBill, Desk, or mint");
  }
  const deskReceipt = broadcast.receipts.find((r) => r.transactionHash === deskTx.hash);
  if (!deskReceipt?.blockNumber) {
    throw new Error("Rearm broadcast missing desk block number");
  }
  return {
    network: "base-sepolia",
    chainId: 84532,
    gateway: "0x397A5f7f3dBd538f23DE225B51f532c34448dA9B",
    tbill: getAddress(tbillTx.contractAddress),
    desk: getAddress(deskTx.contractAddress),
    publisher: getAddress(deskTx.transaction.from),
    beneficiaryInstitution: "0x2222222222222222222222222222222222222222",
    paulShares: 0,
    deployBlock: Number.parseInt(deskReceipt.blockNumber, 16),
    deploy: {
      tbill: tbillTx.hash,
      desk: deskTx.hash,
      mint: mintTx.hash,
    },
    clip: {},
  };
}

async function loadDotenv(path) {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    return;
  }
  for (const line of (await file.text()).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq < 1) {
      continue;
    }
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
