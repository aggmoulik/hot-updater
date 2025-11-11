import type {
  Bundle,
  DatabasePluginHooks,
  Platform,
} from "@hot-updater/plugin-core";
import {
  calculatePagination,
  createDatabasePlugin,
} from "@hot-updater/plugin-core";
import { Client, Databases, ID, Query } from "node-appwrite";

export interface AppwriteDatabaseConfig {
  endpoint: string;
  projectId: string;
  apiKey: string;
  databaseId: string;
  bundlesCollectionId: string;
  targetVersionsCollectionId: string;
}

type ChangedSet =
  | { operation: "insert"; data: Bundle }
  | { operation: "update"; data: Bundle }
  | { operation: "delete"; data: Bundle };

export const appwriteDatabase = (
  config: AppwriteDatabaseConfig,
  hooks?: DatabasePluginHooks,
) =>
  createDatabasePlugin(
    "appwriteDatabase",
    {
      getContext: () => {
        const client = new Client()
          .setEndpoint(config.endpoint)
          .setProject(config.projectId)
          .setKey(config.apiKey);
        const db = new Databases(client);
        return { db };
      },

      async getBundleById(context, bundleId) {
        try {
          const doc = await context.db.getDocument(
            config.databaseId,
            config.bundlesCollectionId,
            bundleId,
          );
          return {
            id: doc.$id,
            platform: doc.platform as Platform,
            shouldForceUpdate: Boolean(doc.should_force_update),
            enabled: Boolean(doc.enabled),
            fileHash: doc.file_hash ?? null,
            gitCommitHash: doc.git_commit_hash ?? null,
            message: doc.message ?? null,
            channel: doc.channel,
            storageUri: doc.storage_uri ?? null,
            targetAppVersion: doc.target_app_version ?? null,
            fingerprintHash: doc.fingerprint_hash ?? null,
            metadata: doc.metadata ?? {},
          } satisfies Bundle;
        } catch {
          return null;
        }
      },

      async getBundles(context, options) {
        const { where, limit, offset } = options ?? {};
        const queries: string[] = [];
        if (where?.channel) {
          queries.push(Query.equal("channel", where.channel));
        }
        if (where?.platform) {
          queries.push(Query.equal("platform", where.platform));
        }
        queries.push(Query.orderDesc("$id"));
        queries.push(Query.limit(limit ?? 20));
        queries.push(Query.offset(offset ?? 0));

        const list = await context.db.listDocuments(
          config.databaseId,
          config.bundlesCollectionId,
          queries,
        );

        const data: Bundle[] = list.documents.map((doc) => ({
          id: doc.$id,
          platform: doc.platform as Platform,
          shouldForceUpdate: Boolean(doc.should_force_update),
          enabled: Boolean(doc.enabled),
          fileHash: doc.file_hash ?? null,
          gitCommitHash: doc.git_commit_hash ?? null,
          message: doc.message ?? null,
          channel: doc.channel,
          storageUri: doc.storage_uri ?? null,
          targetAppVersion: doc.target_app_version ?? null,
          fingerprintHash: doc.fingerprint_hash ?? null,
          metadata: doc.metadata ?? {},
        }));

        const pagination = calculatePagination(list.total, { limit, offset });
        return { data, pagination };
      },

      async getChannels(context) {
        // Appwrite does not support DISTINCT; fetch a reasonable page and deduplicate
        const list = await context.db.listDocuments(
          config.databaseId,
          config.bundlesCollectionId,
          [Query.limit(200)],
        );
        const set = new Set<string>();
        for (const d of list.documents) {
          if (typeof d.channel === "string") {
            set.add(d.channel);
          }
        }
        return Array.from(set);
      },

      async commitBundle(context, { changedSets }) {
        if (changedSets.length === 0) return;

        for (const op of changedSets as ChangedSet[]) {
          if (op.operation === "delete") {
            await context.db.deleteDocument(
              config.databaseId,
              config.bundlesCollectionId,
              op.data.id,
            );
            continue;
          }

          const bundle = op.data;
          const payload = {
            id: bundle.id,
            platform: bundle.platform,
            should_force_update: bundle.shouldForceUpdate,
            enabled: bundle.enabled,
            file_hash: bundle.fileHash,
            git_commit_hash: bundle.gitCommitHash,
            message: bundle.message,
            channel: bundle.channel,
            storage_uri: bundle.storageUri,
            target_app_version: bundle.targetAppVersion,
            fingerprint_hash: bundle.fingerprintHash,
            metadata: bundle.metadata ?? {},
          };

          if (op.operation === "insert") {
            await context.db.createDocument(
              config.databaseId,
              config.bundlesCollectionId,
              bundle.id,
              payload,
            );
          } else {
            await context.db.updateDocument(
              config.databaseId,
              config.bundlesCollectionId,
              bundle.id,
              payload,
            );
          }

          // Maintain target_app_versions collection when present
          if (bundle.targetAppVersion) {
            const tavId = `${bundle.platform}:${bundle.channel}:${bundle.targetAppVersion}`;
            try {
              await context.db.getDocument(
                config.databaseId,
                config.targetVersionsCollectionId,
                tavId,
              );
            } catch {
              await context.db.createDocument(
                config.databaseId,
                config.targetVersionsCollectionId,
                tavId,
                {
                  platform: bundle.platform,
                  channel: bundle.channel,
                  target_app_version: bundle.targetAppVersion,
                },
              );
            }
          }
        }

        hooks?.onDatabaseUpdated?.();
      },
    },
    hooks,
  );
