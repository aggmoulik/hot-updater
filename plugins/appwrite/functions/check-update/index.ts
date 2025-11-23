/* @ts-nocheck */
// Use runtime requires to avoid type resolution issues in function bundle
// eslint-disable-next-line @typescript-eslint/no-var-requires
declare const require: any;
declare const process: any;
const { Client, Databases, Storage, Query } = require("node-appwrite");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SignJWT } = require("jose");

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

type Env = {
  APPWRITE_ENDPOINT: string;
  APPWRITE_PROJECT_ID: string;
  APPWRITE_API_KEY: string;
  APPWRITE_DATABASE_ID: string;
  APPWRITE_BUNDLES_COLLECTION_ID: string;
  APPWRITE_TARGET_VERSIONS_COLLECTION_ID: string;
  FUNCTION_JWT_SECRET: string;
  BUNDLE_FUNCTION_BASE_URL: string;
};

const getEnv = (name: keyof Env): string => {
  const v = process.env[name as string];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
};

const semverSatisfies = (range: string, current: string) => {
  if (!range) return false;
  if (range.endsWith(".x")) {
    const prefix = range.slice(0, -2);
    return current.startsWith(`${prefix}.`);
  }
  return current === range;
};

const filterCompatibleAppVersions = (
  targetAppVersionList: string[],
  currentVersion: string,
) => {
  const compatible = targetAppVersionList.filter((v) =>
    semverSatisfies(v, currentVersion),
  );
  return compatible.sort((a, b) => b.localeCompare(a));
};

const makeResponse = (row: any, status: any): any => ({
  id: row.id,
  shouldForceUpdate:
    status === "ROLLBACK" ? true : Boolean(row.should_force_update),
  message: row.message ?? null,
  status,
  storageUri: row.storage_uri ?? null,
  fileHash: row.file_hash ?? null,
});

async function appVersionStrategy(
  db: any,
  args: any,
  config: { dbId: string; bundlesCol: string; targetCol: string },
): Promise<any | null> {
  const versionsList = await db.listDocuments(config.dbId, config.targetCol, [
    Query.equal("platform", args.platform),
    Query.equal("channel", args.channel ?? "production"),
    Query.limit(500),
  ]);
  const all: string[] = Array.from(
    new Set<string>(
      (versionsList.documents as any[])
        .map((d: any) => d.target_app_version as string)
        .filter(Boolean),
    ),
  );
  const compatible = filterCompatibleAppVersions(all, args.appVersion!);

  if (compatible.length === 0) {
    return args.bundleId === (args.minBundleId ?? NIL_UUID)
      ? null
      : {
          id: NIL_UUID,
          shouldForceUpdate: true,
          message: null,
          status: "ROLLBACK",
          storageUri: null,
          fileHash: null,
        };
  }

  const base = await db.listDocuments(config.dbId, config.bundlesCol, [
    Query.equal("platform", args.platform),
    Query.equal("channel", args.channel ?? "production"),
    Query.equal("enabled", true),
    Query.greaterThanEqual("id", args.minBundleId ?? NIL_UUID),
    Query.orderDesc("id"),
    Query.limit(500),
  ]);
  const candidates = base.documents.filter((d: any) =>
    d.target_app_version ? compatible.includes(d.target_app_version) : false,
  );

  const latest = candidates[0] ?? null;
  const current = candidates.find((b: any) => b.id === args.bundleId);
  const updateCandidate =
    candidates.find((b: any) => b.id.localeCompare(args.bundleId) > 0) ?? null;
  const rollbackCandidate =
    candidates.find((b: any) => b.id.localeCompare(args.bundleId) < 0) ?? null;

  if (args.bundleId === NIL_UUID) {
    return latest ? makeResponse(latest, "UPDATE") : null;
  }
  if (current) {
    if (latest && latest.id.localeCompare(current.id) > 0) {
      return makeResponse(latest, "UPDATE");
    }
    return null;
  }
  if (updateCandidate) return makeResponse(updateCandidate, "UPDATE");
  if (rollbackCandidate) return makeResponse(rollbackCandidate, "ROLLBACK");
  if (args.minBundleId && args.bundleId.localeCompare(args.minBundleId) <= 0) {
    return null;
  }
  return {
    id: NIL_UUID,
    shouldForceUpdate: true,
    message: null,
    status: "ROLLBACK",
    storageUri: null,
    fileHash: null,
  };
}

async function fingerprintStrategy(
  db: any,
  args: any,
  config: { dbId: string; bundlesCol: string },
): Promise<any | null> {
  const base = await db.listDocuments(config.dbId, config.bundlesCol, [
    Query.equal("platform", args.platform),
    Query.equal("channel", args.channel ?? "production"),
    Query.equal("enabled", true),
    Query.greaterThanEqual("id", args.minBundleId ?? NIL_UUID),
    Query.equal("fingerprint_hash", args.fingerprintHash),
    Query.orderDesc("id"),
    Query.limit(500),
  ]);

  const docs = base.documents;
  const latest = docs[0] ?? null;
  const current = docs.find((b: any) => b.id === args.bundleId);
  const updateCandidate =
    docs.find((b: any) => b.id.localeCompare(args.bundleId) > 0) ?? null;
  const rollbackCandidate =
    docs.find((b: any) => b.id.localeCompare(args.bundleId) < 0) ?? null;

  if (args.bundleId === NIL_UUID) {
    return latest ? makeResponse(latest, "UPDATE") : null;
  }
  if (current) {
    if (latest && latest.id.localeCompare(current.id) > 0) {
      return makeResponse(latest, "UPDATE");
    }
    return null;
  }
  if (updateCandidate) return makeResponse(updateCandidate, "UPDATE");
  if (rollbackCandidate) return makeResponse(rollbackCandidate, "ROLLBACK");
  if (args.minBundleId && args.bundleId.localeCompare(args.minBundleId) <= 0) {
    return null;
  }
  return {
    id: NIL_UUID,
    shouldForceUpdate: true,
    message: null,
    status: "ROLLBACK",
    storageUri: null,
    fileHash: null,
  };
}

async function toAppUpdateInfo(
  _storage: any,
  info: any | null,
  jwtSecret: string,
  bundleBaseUrl: string,
): Promise<any | null> {
  if (!info) return null;
  if (info.id === NIL_UUID) {
    return {
      id: info.id,
      status: info.status,
      shouldForceUpdate: true,
      message: null,
      fileUrl: null,
      fileHash: null,
    };
  }
  let fileUrl: string | null = null;
  if (info.storageUri) {
    const url = new URL(info.storageUri);
    const bucketId = url.host;
    const fileId = url.pathname.replace(/^\//, "");
    const token = await new SignJWT({ bucketId, fileId })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("60s")
      .sign(new TextEncoder().encode(jwtSecret));
    const base = bundleBaseUrl.replace(/\/$/, "");
    fileUrl = `${base}/bundle/${encodeURIComponent(bucketId)}/${encodeURIComponent(fileId)}?token=${encodeURIComponent(token)}`;
  }
  return {
    id: info.id,
    status: info.status,
    shouldForceUpdate: info.shouldForceUpdate,
    message: info.message,
    fileHash: info.fileHash,
    fileUrl,
  };
}

// Appwrite Function handler for GET /api/check-update
export default async ({ req, res, log }: any) => {
  try {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const method = req.method?.toUpperCase?.() ?? "GET";
    if (!(method === "GET" && pathname.endsWith("/api/check-update"))) {
      return res.json({ error: "Not Found" }, 404);
    }

    const bundleId = req.headers["x-bundle-id"] as string;
    const appPlatform = req.headers["x-app-platform"] as "ios" | "android";
    const appVersion = req.headers["x-app-version"] as string | undefined;
    const fingerprintHash = req.headers["x-fingerprint-hash"] as
      | string
      | undefined;
    const minBundleId = (req.headers["x-min-bundle-id"] as string) ?? NIL_UUID;
    const channel = (req.headers["x-channel"] as string) ?? "production";

    if (!bundleId || !appPlatform || (!appVersion && !fingerprintHash)) {
      return res.json(
        {
          error:
            "Missing headers (bundleId/appPlatform/appVersion|fingerprintHash)",
        },
        400,
      );
    }

    const client = new Client()
      .setEndpoint(getEnv("APPWRITE_ENDPOINT"))
      .setProject(getEnv("APPWRITE_PROJECT_ID"))
      .setKey(getEnv("APPWRITE_API_KEY"));
    const db = new Databases(client);
    const storage = new Storage(client);
    const dbId = getEnv("APPWRITE_DATABASE_ID");
    const bundlesCol = getEnv("APPWRITE_BUNDLES_COLLECTION_ID");
    const targetCol = getEnv("APPWRITE_TARGET_VERSIONS_COLLECTION_ID");

    const args = fingerprintHash
      ? {
          _updateStrategy: "fingerprint",
          platform: appPlatform,
          fingerprintHash,
          bundleId,
          minBundleId,
          channel,
        }
      : {
          _updateStrategy: "appVersion",
          platform: appPlatform,
          appVersion: appVersion!,
          bundleId,
          minBundleId,
          channel,
        };

    const info =
      args._updateStrategy === "fingerprint"
        ? await fingerprintStrategy(db, args, { dbId, bundlesCol })
        : await appVersionStrategy(db, args, {
            dbId,
            bundlesCol,
            targetCol,
          });

    const response = await toAppUpdateInfo(
      storage,
      info,
      getEnv("FUNCTION_JWT_SECRET"),
      getEnv("BUNDLE_FUNCTION_BASE_URL"),
    );
    return res.json(response, 200);
  } catch (e: any) {
    log?.(e?.message ?? e);
    return res.json({ error: "Internal Server Error" }, 500);
  }
};


