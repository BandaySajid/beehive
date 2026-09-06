import { z } from "zod";
export const PUBLIC_ID = /^BH-2026-[A-Z0-9]{6,12}$/;
export const roleSchema = z.enum(["producer", "authority", "admin"]);
export type Role = z.infer<typeof roleSchema>;
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  producerId: string | null;
}
export const readingSchema = z
  .object({
    temperature: z.number().finite().min(-20).max(80),
    humidity: z.number().finite().min(0).max(100),
    weight: z.number().finite().min(0).max(500),
    activity: z.number().min(0).max(100).nullable().optional(),
    timestamp: z.iso.datetime().optional(),
  })
  .strict();
export const hiveSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    apiaryId: z.string().min(1).max(80),
    species: z.enum(["Apis mellifera", "Apis cerana indica"]),
    queenAge: z.number().int().min(0).max(60),
    installationDate: z.iso.date(),
  })
  .strict();
export const batchSchema = z
  .object({
    apiaryId: z.string().min(1).max(80),
    hiveIds: z
      .array(z.string().min(1).max(80))
      .min(1)
      .max(20)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Source hives must be unique",
      ),
    harvestDate: z.iso.date(),
    honeyType: z.enum([
      "Acacia",
      "Multiflora",
      "Mustard",
      "Eucalyptus",
      "Wildflower",
      "Litchi",
    ]),
    quantity: z.number().finite().positive().max(10000),
    moisture: z.number().finite().min(0).max(100),
    labValues: z
      .object({
        hmf: z.number().min(0).max(1000).nullable(),
        diastase: z.number().min(0).max(1000).nullable(),
      })
      .optional(),
    lotInformation: z.string().trim().min(1).max(120),
    extractionMethod: z.enum([
      "Cold extraction",
      "Centrifugal extraction",
      "Gravity filtration",
    ]),
    documentId: z.string().max(80).nullable().optional(),
    notes: z.string().trim().max(2000).default(""),
  })
  .strict();
export type BatchInput = z.infer<typeof batchSchema>;
export interface CertifiedRecord {
  schemaVersion: "beehive.record.v1";
  publicId: string;
  producerId: string;
  producerName: string;
  hiveIds: string[];
  apiary: string;
  origin: { region: string; latitude: number; longitude: number };
  honeyType: string;
  harvestDate: string;
  quantity: number;
  qualityMeasurements: {
    moisture: number;
    hmf: number | null;
    diastase: number | null;
  };
  lotInformation: string;
  extractionMethod: string;
  certificateDigest: string | null;
  aiAssessmentDigest: string | null;
  createdAt: string;
}
export interface RiskFeature {
  name: string;
  value: number | string | boolean;
  points: number;
  explanation: string;
}
export interface Assessment {
  score: number;
  classification: "LOW" | "MEDIUM" | "HIGH";
  confidence: number;
  reasons: string[];
  recommendations: string[];
  features: RiskFeature[];
  version: string;
  timestamp: string;
  scope: string;
}
export interface Reading {
  id: string;
  hive_id: string;
  temperature: number;
  humidity: number;
  weight: number;
  activity: number | null;
  timestamp: string;
}
export interface Hive {
  id: string;
  public_id: string;
  name: string;
  apiary_id: string;
  apiary: string;
  location: string;
  latitude: number;
  longitude: number;
  species: string;
  queen_age: number;
  installation_date: string;
  status: "Healthy" | "Watch" | "Alert";
  temperature: number | null;
  humidity: number | null;
  weight: number | null;
  activity: number | null;
  timestamp: string | null;
  healthScore: number;
}
export interface Proof {
  record_hash: string;
  canonical_payload_version: string;
  blockchain_tx_hash: string | null;
  blockchain_network: string;
  blockchain_timestamp: string | null;
  block_number: string | null;
  chain_id: number;
  contract_address: string;
  status: string;
  explorerUrl?: string | null;
}
export interface Batch {
  id: string;
  publicId: string;
  record: CertifiedRecord;
  status: string;
  assessment: Assessment | null;
  proof: Proof | null;
  isDemo: boolean;
  notes?: string;
}
export interface BatchDocument {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  digest: string;
  kind: string;
  created_at: string;
}
export interface Alert {
  id: string;
  hive_id: string | null;
  batch_id: string | null;
  type: string;
  severity: string;
  title: string;
  detail: string;
  status: string;
  created_at: string;
  producer_name: string;
  public_id: string | null;
  score: number | null;
}
export interface Verification {
  verdict: "AUTHENTIC" | "TAMPERED" | "PENDING" | "REVOKED" | "NOT_FOUND";
  publicId: string;
  record?: CertifiedRecord;
  assessment?: Assessment | null;
  proof?: Proof | null;
  currentHash?: string;
  anchoredHash?: string | null;
  checkedAt: string;
  chainAvailable?: boolean;
  message: string;
  timeline?: { action: string; created_at: string }[];
}
export type ApiResult<T> =
  | { success: true; data: T; requestId: string }
  | {
      success: false;
      error: { code: string; message: string };
      requestId: string;
    };
export const GOLDEN_ID = "BH-2026-000042";
export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
export function hiveHealth(t: number | null, h: number | null) {
  if (t === null || h === null) return 0;
  return Math.max(
    12,
    Math.min(
      98,
      Math.round(
        98 -
          Math.abs(t - 34) * 5 -
          Math.max(0, h - 65) * 1.3 -
          Math.max(0, 40 - h),
      ),
    ),
  );
}
