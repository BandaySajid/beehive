import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  canonicalJson,
  canonicalizeRecord,
  sha256,
  hashRecord,
} from "../packages/shared/src/canonical";
import { assessRisk } from "../packages/risk-engine/src/index";
import type { CertifiedRecord } from "../packages/shared/src/index";
import { goldenRecord } from "../tests/fixtures";
import {
  broadcastRecord,
  confirmTransaction,
  readAnchoredRecord,
  chainClients,
} from "../packages/blockchain/src/index";
import { registryAbi } from "../packages/blockchain/src/abi";
import { passwordHash } from "../apps/worker/src/auth";
import type { Hex } from "viem";
if (process.argv.includes("--remote"))
  throw new Error(
    "Demo seeding is local-only. Use a separately isolated deployment and an explicit reviewed export for remote demo data.",
  );
const config = "apps/worker/wrangler.jsonc";
const wrangler = "node_modules/wrangler/bin/wrangler.js";
mkdirSync(".local", { recursive: true });
function sqlValue(value: unknown) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}
const sql: string[] = [];
function insert(table: string, values: Record<string, unknown>) {
  sql.push(
    `INSERT OR IGNORE INTO ${table} (${Object.keys(values).join(",")}) VALUES (${Object.values(values).map(sqlValue).join(",")});`,
  );
}
function execute(sql: string[], name: string) {
  writeFileSync(`.local/${name}.sql`, sql.join("\n"));
  execFileSync(
    process.execPath,
    [
      wrangler,
      "d1",
      "execute",
      "beehive-db",
      "--local",
      "--config",
      config,
      "--file",
      `.local/${name}.sql`,
    ],
    { stdio: "pipe", maxBuffer: 8 * 1024 * 1024 },
  );
}
function query<T>(command: string): T[] {
  const output = execFileSync(
    process.execPath,
    [
      wrangler,
      "d1",
      "execute",
      "beehive-db",
      "--local",
      "--config",
      config,
      "--command",
      command,
      "--json",
    ],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  );
  const parsed = JSON.parse(output);
  return parsed[0].results;
}
const producers = [
  {
    id: "producer-mountain",
    name: "Mountain Gold Apiary",
    region: "Jammu & Kashmir",
    apiary: "apiary-lidder",
    apiaryName: "Lidder Valley Apiary",
    lat: 33.999,
    lng: 75.315,
  },
  {
    id: "producer-doaba",
    name: "Doaba Honey Collective",
    region: "Punjab",
    apiary: "apiary-hoshiarpur",
    apiaryName: "Hoshiarpur Floral Fields",
    lat: 31.5143,
    lng: 75.9115,
  },
  {
    id: "producer-kumaon",
    name: "Kumaon Forest Honey",
    region: "Uttarakhand",
    apiary: "apiary-almora",
    apiaryName: "Almora Ridge Apiary",
    lat: 29.5971,
    lng: 79.6591,
  },
];
const baseDate = new Date("2026-09-06T07:30:00.000Z");
for (const p of producers) {
  insert("producers", {
    id: p.id,
    name: p.name,
    region: p.region,
    created_at: "2026-07-01T08:00:00.000Z",
  });
  insert("apiaries", {
    id: p.apiary,
    producer_id: p.id,
    name: p.apiaryName,
    location: p.region,
    latitude: p.lat,
    longitude: p.lng,
  });
}
const credentialPath = ".local/demo-credentials.json";
const credentials = existsSync(credentialPath)
  ? JSON.parse(readFileSync(credentialPath, "utf8"))
  : { email: "producer@beehive.demo", password: crypto.randomUUID() };
writeFileSync(credentialPath, JSON.stringify(credentials, null, 2), {
  mode: 0o600,
});
const password = await passwordHash(
  credentials.password,
  "beehive-local-seed-user-v1",
);
for (const u of [
  {
    id: "demo-producer",
    name: "Aarav Raina",
    email: "producer@beehive.demo",
    role: "producer",
    producer_id: producers[0].id,
  },
  {
    id: "demo-authority",
    name: "Meera Sharma",
    email: "authority@beehive.demo",
    role: "authority",
    producer_id: null,
  },
  {
    id: "demo-admin",
    name: "BeeHive Demo Admin",
    email: "admin@beehive.demo",
    role: "admin",
    producer_id: producers[0].id,
  },
  {
    id: "producer-doaba-user",
    name: "Gurpreet Singh",
    email: "gurpreet@beehive.demo",
    role: "producer",
    producer_id: producers[1].id,
  },
  {
    id: "producer-kumaon-user",
    name: "Nisha Bisht",
    email: "nisha@beehive.demo",
    role: "producer",
    producer_id: producers[2].id,
  },
])
  insert("users", {
    ...u,
    password_hash: password,
    created_at: "2026-07-01T09:00:00.000Z",
  });
const hiveNames = [
  "North orchard",
  "Riverbank colony",
  "Cedar grove",
  "South meadow",
  "Acacia ridge",
  "Mustard field",
  "Kikar grove",
  "Canal meadow",
  "Oak forest",
  "Rhododendron ridge",
];
const hiveRecords = Array.from({ length: 10 }, (_, i) => ({
  id: `hive-${String(i + 1).padStart(3, "0")}`,
  publicId: i === 4 ? "HIVE-0042" : `HIVE-${String(i + 1).padStart(4, "0")}`,
  producer: producers[i < 5 ? 0 : i < 8 ? 1 : 2],
  status: i === 2 ? "Watch" : i === 3 ? "Alert" : "Healthy",
  name: hiveNames[i],
}));
for (const [i, h] of hiveRecords.entries()) {
  insert("hives", {
    id: h.id,
    public_id: h.publicId,
    producer_id: h.producer.id,
    apiary_id: h.producer.apiary,
    name: h.name,
    species: i < 8 ? "Apis mellifera" : "Apis cerana indica",
    queen_age: 6 + i,
    installation_date: "2026-03-10",
    status: h.status,
    created_at: "2026-07-01T08:00:00.000Z",
  });
  for (let day = 0; day < 21; day++) {
    for (let slot = 0; slot < 4; slot++) {
      const timestamp = new Date(
        baseDate.getTime() - (20 - day) * 86400000 + slot * 3600000,
      ).toISOString();
      const stress = day === 20 && slot === 3;
      const temperature =
        stress && h.status === "Alert"
          ? 42.6
          : stress && h.status === "Watch"
            ? 38.3
            : Math.round(
                (33.7 + Math.sin(day * 0.8 + slot * 0.9 + i) * 0.9) * 10,
              ) / 10;
      const humidity =
        stress && h.status === "Alert"
          ? 84
          : stress && h.status === "Watch"
            ? 70
            : Math.round(54 + Math.sin(day * 0.35 + slot + i) * 5);
      const weight =
        Math.round((30 + i * 2 + day * 0.28 + Math.sin(slot) * 0.2) * 10) / 10;
      insert("hive_readings", {
        id: `reading-${i}-${day}-${slot}`,
        hive_id: h.id,
        temperature,
        humidity,
        weight,
        activity:
          stress && h.status === "Alert"
            ? 24
            : stress && h.status === "Watch"
              ? 57
              : 85 + (slot % 3),
        timestamp,
      });
    }
  }
  insert("hive_inspections", {
    id: `inspection-${i}`,
    hive_id: h.id,
    inspector: i < 5 ? "Aarav Raina" : i < 8 ? "Gurpreet Singh" : "Nisha Bisht",
    notes:
      h.status === "Healthy"
        ? "Queen observed. Brood pattern consistent. Stores sufficient; entrance clear."
        : h.status === "Watch"
          ? "Elevated midday temperature. Added shade and scheduled a ventilation check."
          : "Temperature and humidity require inspection. Check airflow and water access before harvest.",
    created_at: "2026-09-05T09:00:00.000Z",
  });
  if (h.status !== "Healthy")
    insert("hive_alerts", {
      id: `seed-hive-alert-${i}`,
      hive_id: h.id,
      producer_id: h.producer.id,
      type: "HIVE_STRESS",
      severity: h.status,
      title: `${h.name}: ${h.status === "Alert" ? "high temperature and humidity" : "temperature watch"}`,
      detail:
        h.status === "Alert"
          ? "42.6°C and 84% humidity. Inspect ventilation and colony conditions."
          : "38.3°C and 70% humidity. Inspect shade and provide water.",
      status: "OPEN",
      created_at: new Date(baseDate.getTime() + 3 * 3600000).toISOString(),
    });
}
for (let i = 0; i < 36; i++) {
  const number =
    i === 0 ? 42 : i === 1 ? 221 : i === 2 ? 219 : i === 3 ? 188 : 100 + i;
  const publicId = `BH-2026-${String(number).padStart(6, "0")}`;
  const h = i === 0 ? hiveRecords[4] : hiveRecords[(i - 1) % 10];
  const createdAt =
    i === 0
      ? goldenRecord.createdAt
      : new Date(
          baseDate.getTime() - (Math.floor(i / 3) + 1) * 86400000 - i * 190000,
        ).toISOString();
  const harvestDate = new Date(Date.parse(createdAt) - 86400000)
    .toISOString()
    .slice(0, 10);
  const quantity =
    i === 0
      ? 25
      : i === 1
        ? 250
        : i === 2
          ? 185
          : i % 9 === 0
            ? 64
            : 12 + (i % 7) * 3;
  const record: CertifiedRecord =
    i === 0
      ? { ...goldenRecord }
      : {
          schemaVersion: "beehive.record.v1",
          publicId,
          producerId: h.producer.id,
          producerName: h.producer.name,
          hiveIds: [h.publicId],
          apiary: h.producer.apiaryName,
          origin: {
            region: h.producer.region,
            latitude: h.producer.lat,
            longitude: h.producer.lng,
          },
          honeyType:
            i < 5
              ? "Acacia"
              : ["Multiflora", "Mustard", "Wildflower", "Eucalyptus", "Acacia"][
                  i % 5
                ],
          harvestDate,
          quantity,
          qualityMeasurements: {
            moisture:
              i === 1 ? 24.8 : i % 9 === 0 ? 21.7 : 17.1 + (i % 5) * 0.2,
            hmf: i % 3 === 0 ? 12 + (i % 7) : null,
            diastase: i % 3 === 0 ? 9.5 + (i % 4) : null,
          },
          lotInformation: `${h.producer.id.split("-")[1].toUpperCase()}-${String(number)}`,
          extractionMethod: "Cold extraction",
          certificateDigest: null,
          aiAssessmentDigest: null,
          createdAt,
        };
  const assessment = assessRisk(record, {
    hiveTemperature: 34,
    hiveHumidity: 55,
    registeredOrigin: { latitude: h.producer.lat, longitude: h.producer.lng },
    historicalQuantities: i === 0 ? [] : [15, 18, 21, 24, 27, 30],
    now: createdAt,
  });
  record.aiAssessmentDigest = await sha256(canonicalJson(assessment));
  const draft = i >= 34;
  const batchId = `batch-${number}`;
  if (draft) record.aiAssessmentDigest = null;
  insert("batches", {
    id: batchId,
    public_id: publicId,
    producer_id: h.producer.id,
    apiary_id: h.producer.apiary,
    record_json: JSON.stringify(record),
    lot_information: record.lotInformation,
    extraction_method: record.extractionMethod,
    notes:
      i === 0
        ? "Golden SIH demonstration record. Producer-reported moisture; supporting laboratory certificate not supplied."
        : i === 1 || i === 2
          ? "Seeded anomalous submission for authority review. This quantity requires supporting evidence."
          : "Seasonal harvest. Source identity registered before batch creation.",
    status: draft ? "DRAFT" : "ANALYZED",
    is_demo: 1,
    created_at: record.createdAt,
  });
  insert("batch_hives", { batch_id: batchId, hive_id: h.id });
  if (!draft)
    insert("ai_assessments", {
      id: `assessment-${number}`,
      batch_id: batchId,
      score: assessment.score,
      classification: assessment.classification,
      assessment_json: JSON.stringify(assessment),
      digest: record.aiAssessmentDigest,
      created_at: assessment.timestamp,
    });
  insert("audit_logs", {
    id: `audit-create-${number}`,
    user_id:
      i === 0
        ? "demo-producer"
        : h.producer.id === "producer-doaba"
          ? "producer-doaba-user"
          : h.producer.id === "producer-kumaon"
            ? "producer-kumaon-user"
            : "demo-producer",
    producer_id: h.producer.id,
    action: "Honey batch created",
    entity_id: batchId,
    detail: `${publicId}: ${quantity} kg ${record.honeyType}`,
    created_at: record.createdAt,
  });
  if (!draft)
    insert("audit_logs", {
      id: `audit-analysis-${number}`,
      producer_id: h.producer.id,
      action: "AI analysis completed",
      entity_id: batchId,
      detail: `${assessment.score}/100 ${assessment.classification}`,
      created_at: assessment.timestamp,
    });
  if (assessment.score > 70 && !draft)
    insert("hive_alerts", {
      id: `seed-risk-${number}`,
      batch_id: batchId,
      producer_id: h.producer.id,
      type: "RISK",
      severity: "Alert",
      title: `Abnormal production quantity: ${publicId}`,
      detail: assessment.reasons.slice(0, 3).join(" "),
      status: "OPEN",
      created_at: createdAt,
    });
}
execute(sql, "demo-seed");
console.log(
  "Seeded 3 producers, 3 apiaries, 10 hives, 840 readings and 36 internally linked batches.",
);
const vars = readFileSync("apps/worker/.dev.vars", "utf8");
const address = vars.match(/^CONTRACT_ADDRESS="(.+)"$/m)?.[1];
const key = vars.match(/^BLOCKCHAIN_PRIVATE_KEY="(.+)"$/m)?.[1];
if (!address || !key)
  throw new Error("Deploy the local registry first: npm run chain:deploy");
const chainConfig = {
  EVM_RPC_URL: "http://127.0.0.1:8545",
  CHAIN_ID: "31337",
  CONTRACT_ADDRESS: address,
  NETWORK_NAME: "Local EVM (Hardhat)",
  BLOCKCHAIN_PRIVATE_KEY: key,
};
const toAnchor = query<{
  id: string;
  public_id: string;
  producer_id: string;
  record_json: string;
  canonical_payload: string | null;
  blockchain_tx_hash: Hex | null;
  record_hash: Hex | null;
}>(
  `SELECT b.id,b.public_id,b.producer_id,b.record_json,p.canonical_payload,p.blockchain_tx_hash,p.record_hash FROM batches b LEFT JOIN blockchain_proofs p ON p.batch_id=b.id WHERE b.is_demo=1 AND (b.status IN ('ANCHORED','ANCHORING') OR (b.id LIKE 'batch-%' AND b.status='ANALYZED' AND b.id NOT IN ('batch-132','batch-133')))`,
);
const proofSql: string[] = [];
for (const b of toAnchor) {
  const record: CertifiedRecord = JSON.parse(
    b.canonical_payload ?? b.record_json,
  );
  const hash = await hashRecord(record);
  const existing = await readAnchoredRecord(chainConfig, b.public_id);
  let tx: Hex;
  if (existing.exists) {
    if (existing.hash !== hash)
      throw new Error(`Registry mismatch for ${b.public_id}`);
    if (b.blockchain_tx_hash) {
      try {
        await confirmTransaction(chainConfig, b.blockchain_tx_hash);
        continue;
      } catch {}
    }
    const { client, address } = chainClients(chainConfig);
    const logs = await client.getContractEvents({
      address,
      abi: registryAbi,
      eventName: "RecordRegistered",
      args: { recordHash: hash },
      fromBlock: 0n,
      toBlock: "latest",
    });
    tx = logs.find((l) => l.args.publicId === b.public_id)!.transactionHash;
  } else tx = await broadcastRecord(chainConfig, b.public_id, hash);
  const receipt = await confirmTransaction(chainConfig, tx);
  const values = {
    id: `proof-${b.id}`,
    batch_id: b.id,
    canonical_payload_version: record.schemaVersion,
    canonical_payload: canonicalizeRecord(record),
    record_hash: hash,
    hash_algorithm: "SHA-256",
    blockchain_tx_hash: tx,
    blockchain_network: chainConfig.NETWORK_NAME,
    chain_id: 31337,
    contract_address: address,
    blockchain_timestamp: receipt.timestamp,
    block_number: receipt.blockNumber,
    status: "ANCHORED",
    created_at: receipt.timestamp,
  };
  proofSql.push(
    `INSERT INTO blockchain_proofs (${Object.keys(values).join(",")}) VALUES (${Object.values(values).map(sqlValue).join(",")}) ON CONFLICT(batch_id) DO UPDATE SET blockchain_tx_hash=excluded.blockchain_tx_hash,contract_address=excluded.contract_address,blockchain_timestamp=excluded.blockchain_timestamp,block_number=excluded.block_number,status='ANCHORED';`,
  );
  proofSql.push(
    `UPDATE batches SET status='ANCHORED' WHERE id=${sqlValue(b.id)};`,
  );
  proofSql.push(
    `INSERT INTO audit_logs (id,producer_id,action,entity_id,detail,created_at) VALUES (${sqlValue(crypto.randomUUID())},${sqlValue(b.producer_id)},'Blockchain anchoring confirmed',${sqlValue(b.id)},${sqlValue(tx)},${sqlValue(receipt.timestamp)});`,
  );
  const verdict =
    (await hashRecord(JSON.parse(b.record_json))) === hash
      ? "AUTHENTIC"
      : "TAMPERED";
  proofSql.push(
    `INSERT INTO verification_events (id,batch_id,verdict,current_hash,anchored_hash,created_at) VALUES (${sqlValue(crypto.randomUUID())},${sqlValue(b.id)},${sqlValue(verdict)},${sqlValue(await hashRecord(JSON.parse(b.record_json)))},${sqlValue(hash)},${sqlValue(receipt.timestamp)});`,
  );
  console.log(`${b.public_id}: confirmed in block ${receipt.blockNumber}`);
}
if (proofSql.length) execute(proofSql, "demo-proofs");
console.log(
  "Demo proof reconciliation complete. Every displayed transaction is from the local Solidity registry.",
);
