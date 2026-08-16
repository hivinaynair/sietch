import { homedir } from "node:os";
import { join } from "node:path";
import { baseSepolia } from "../apps/web/node_modules/viem/_esm/chains/index.js";
import { createPublicClient, getAddress, http } from "../apps/web/node_modules/viem/_esm/index.js";

/**
 * Fresh T-bill + desk for a live walk. Same receipts, empty usedTransfer, books 1 / 0.
 *
 * First run deploys ClipFactory (constructor arms a desk). Later runs call factory.rearm()
 * so SIETCH_FACTORY_ADDRESS stays put — the live room reads the new desk without a redeploy.
 */
const ROOT = join(import.meta.dir, "..");
const CONTRACTS = join(ROOT, "contracts");
const BROADCAST = join(CONTRACTS, "broadcast/Rearm.s.sol/84532/run-latest.json");
const CHAIN_JSON = join(ROOT, "artifacts/demo/chain.json");
const RPC = process.env.SIETCH_RPC_URL ?? "https://sepolia.base.org";

const PROGRAM_VKEY = "0x00035e8be65b2881b5409b3238047ddd679c9cce04cb4140973e04e9ed3330cd";
const POLICY_HASH_V1 = "0x3e9abaca0aad9ede81f4474766c846d8539f70688e1c8f521bbe1597874e3dc4";

const FACTORY_ABI = [
  {
    type: "function",
    name: "desk",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "tbill",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "fromBlock",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
];

const recordOnly = process.argv.includes("--record");

await loadDotenv(join(CONTRACTS, ".env"));
await loadDotenv(join(ROOT, "apps/web/.env.local"));

const existingFactory = await resolveFactoryAddress();

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
      // Foundry's default fee estimate overshoots this clerk; 0.007 gwei still clears Base Sepolia.
      "--with-gas-price",
      "7000000",
    ],
    {
      cwd: CONTRACTS,
      env: {
        ...process.env,
        PATH: `${foundry}:${process.env.PATH ?? ""}`,
        PROGRAM_VKEY,
        CHANI_POLICY_HASH: POLICY_HASH_V1,
        PAUL_POLICY_HASH: POLICY_HASH_V1,
        ...(existingFactory ? { SIETCH_FACTORY_ADDRESS: existingFactory } : {}),
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
const factory = factoryFromBroadcast(broadcast) ?? existingFactory;
if (!factory) {
  throw new Error("Rearm broadcast missing ClipFactory and no SIETCH_FACTORY_ADDRESS");
}

const onChain = await readFactory(factory);
const record = recordFrom(broadcast, factory, onChain);
await Bun.write(CHAIN_JSON, `${JSON.stringify(record, null, 2)}\n`);

console.log("");
console.log(`factory ${record.factory}`);
console.log(`tbill   ${record.tbill}`);
console.log(`desk    ${record.desk}`);
console.log(`block   ${record.deployBlock}`);
console.log("");
console.log(
  "Wrote artifacts/demo/chain.json. Set SIETCH_FACTORY_ADDRESS once; later re-arms need no env bump. Do not walk the desk.",
);
console.log("");
for (const target of ["production", "preview", "development"]) {
  console.log(`vercel env rm SIETCH_FACTORY_ADDRESS ${target} --yes`);
  console.log(`printf '%s' '${record.factory}' | vercel env add SIETCH_FACTORY_ADDRESS ${target}`);
}

async function resolveFactoryAddress() {
  const fromEnv = process.env.SIETCH_FACTORY_ADDRESS;
  if (fromEnv?.startsWith("0x") && fromEnv.length === 42) {
    return getAddress(fromEnv);
  }
  const chainFile = Bun.file(CHAIN_JSON);
  if (!(await chainFile.exists())) {
    return null;
  }
  const chain = await chainFile.json();
  if (typeof chain.factory === "string" && chain.factory.startsWith("0x")) {
    return getAddress(chain.factory);
  }
  return null;
}

function factoryFromBroadcast(broadcast) {
  const created = broadcast.transactions.find(
    (tx) => tx.contractName === "ClipFactory" && tx.transactionType === "CREATE",
  );
  return created?.contractAddress ? getAddress(created.contractAddress) : null;
}

async function readFactory(factory) {
  const client = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
  let lastError;
  for (let i = 0; i < 8; i += 1) {
    try {
      const [desk, tbill, fromBlock] = await Promise.all([
        client.readContract({ address: factory, abi: FACTORY_ABI, functionName: "desk" }),
        client.readContract({ address: factory, abi: FACTORY_ABI, functionName: "tbill" }),
        client.readContract({
          address: factory,
          abi: FACTORY_ABI,
          functionName: "fromBlock",
        }),
      ]);
      return { desk, tbill, fromBlock };
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  throw lastError;
}

function recordFrom(broadcast, factory, onChain) {
  const writeTx =
    broadcast.transactions.find(
      (tx) => tx.contractName === "ClipFactory" && tx.transactionType === "CREATE",
    ) ??
    broadcast.transactions.find((tx) => tx.function?.startsWith("rearm(")) ??
    broadcast.transactions[0];
  if (!writeTx?.hash) {
    throw new Error("Rearm broadcast missing factory create or rearm()");
  }
  const from =
    writeTx.transaction?.from ??
    broadcast.receipts.find((r) => r.transactionHash === writeTx.hash)?.from;
  return {
    network: "base-sepolia",
    chainId: 84532,
    gateway: "0x397A5f7f3dBd538f23DE225B51f532c34448dA9B",
    factory,
    tbill: getAddress(onChain.tbill),
    desk: getAddress(onChain.desk),
    publisher: from ? getAddress(from) : undefined,
    beneficiaryInstitution: "0x2222222222222222222222222222222222222222",
    paulShares: 0,
    deployBlock: Number(onChain.fromBlock),
    deploy: {
      factory: writeTx.hash,
      tbill: writeTx.hash,
      desk: writeTx.hash,
      mint: writeTx.hash,
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
