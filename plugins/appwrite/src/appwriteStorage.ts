import {
  type BasePluginArgs,
  createStorageKeyBuilder,
  parseStorageUri,
  type StoragePlugin,
  type StoragePluginHooks,
  getContentType,
} from "@hot-updater/plugin-core";
import fs from "fs/promises";
import { SignJWT } from "jose";
import { Client, InputFile, Storage } from "node-appwrite";
import path from "path";

export interface AppwriteStorageConfig {
  endpoint: string;
  projectId: string;
  apiKey: string;
  bucketId: string;
  basePath?: string;
  functionBaseUrl: string;
  functionJwtSecret: string;
}

async function signToken(secret: string, claims: Record<string, unknown>) {
  const key = new TextEncoder().encode(secret);
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ ...claims, iat: now })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("60s")
    .sign(key);
}

export const appwriteStorage =
  (config: AppwriteStorageConfig, hooks?: StoragePluginHooks) =>
  (_: BasePluginArgs): StoragePlugin => {
    const client = new Client()
      .setEndpoint(config.endpoint)
      .setProject(config.projectId)
      .setKey(config.apiKey);
    const storage = new Storage(client);
    const getStorageKey = createStorageKeyBuilder(config.basePath);

    return {
      name: "appwriteStorage",
      supportedProtocol: "appwrite-storage",

      async upload(key, filePath) {
        const Body = await fs.readFile(filePath);
        const ContentType = getContentType(filePath);
        const filename = path.basename(filePath);
        const fileId = getStorageKey(key, filename);
        await storage.createFile(
          config.bucketId,
          fileId,
          InputFile.fromBuffer(Body, filename, ContentType),
        );
        hooks?.onStorageUploaded?.();
        return {
          storageUri: `appwrite-storage://${config.bucketId}/${fileId}`,
        };
      },

      async delete(storageUri) {
        const { bucket, key } = parseStorageUri(storageUri, "appwrite-storage");
        if (bucket !== config.bucketId) {
          throw new Error(
            `Bucket name mismatch: expected "${config.bucketId}", but found "${bucket}".`,
          );
        }
        await storage.deleteFile(bucket, key);
      },

      async getDownloadUrl(storageUri: string) {
        const { bucket, key } = parseStorageUri(storageUri, "appwrite-storage");
        const token = await signToken(config.functionJwtSecret, {
          bucketId: bucket,
          fileId: key,
        });
        const fileUrl = `${config.functionBaseUrl.replace(/\/$/, "")}/bundle/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}?token=${encodeURIComponent(token)}`;
        return { fileUrl };
      },
    };
  };
