/* @ts-nocheck */
// Use runtime requires to avoid type resolution issues in function bundle
// eslint-disable-next-line @typescript-eslint/no-var-requires
declare const require: any;
declare const process: any;
const { Client, Storage } = require("node-appwrite");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { jwtVerify } = require("jose");

type Env = {
  APPWRITE_ENDPOINT: string;
  APPWRITE_PROJECT_ID: string;
  APPWRITE_API_KEY: string;
  FUNCTION_JWT_SECRET: string;
};

const getEnv = (name: keyof Env): string => {
  const v = process.env[name as string];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
};

// Appwrite Function handler for GET /bundle/:bucketId/:fileId
export default async ({ req, res, log }: any) => {
  try {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const method = req.method?.toUpperCase?.() ?? "GET";
    if (!(method === "GET" && pathname.includes("/bundle/"))) {
      return res.json({ error: "Not Found" }, 404);
    }

    const token = url.searchParams.get("token");
    if (!token) return res.json({ error: "Missing token" }, 401);
    const secret = new TextEncoder().encode(getEnv("FUNCTION_JWT_SECRET"));
    const { payload } = await jwtVerify(token, secret);

    const parts = pathname.split("/").filter(Boolean);
    const bundleIdx = parts.indexOf("bundle");
    const bucketId = decodeURIComponent(parts[bundleIdx + 1] ?? "");
    const fileId = decodeURIComponent(parts.slice(bundleIdx + 2).join("/"));
    if (!bucketId || !fileId) {
      return res.json({ error: "Invalid path" }, 400);
    }
    if (payload.bucketId !== bucketId || payload.fileId !== fileId) {
      return res.json({ error: "Invalid token scope" }, 403);
    }

    const client = new Client()
      .setEndpoint(getEnv("APPWRITE_ENDPOINT"))
      .setProject(getEnv("APPWRITE_PROJECT_ID"))
      .setKey(getEnv("APPWRITE_API_KEY"));
    const storage = new Storage(client);
    const blob = (await storage.getFileDownload(bucketId, fileId)) as any;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Cache-Control", "no-store");
    return res.send(blob);
  } catch (e: any) {
    log?.(e?.message ?? e);
    return res.json({ error: "Internal Server Error" }, 500);
  }
};


