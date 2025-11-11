import { type BuildType, p, transformTemplate } from "@hot-updater/cli-tools";
import fs from "fs";
import path from "path";

const ENV_TEMPLATE = `# Appwrite
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your-project-id
APPWRITE_API_KEY=your-api-key
APPWRITE_DATABASE_ID=hot-updater
APPWRITE_BUNDLES_COLLECTION_ID=bundles
APPWRITE_TARGET_VERSIONS_COLLECTION_ID=target_app_versions
APPWRITE_BUCKET_ID=hot-updater-bundles
APPWRITE_FUNCTION_BASE_URL=https://your-appwrite-function-url
APPWRITE_FUNCTION_JWT_SECRET=replace-with-long-random-secret
`;

const CONFIG_TEMPLATE = `import { defineConfig } from "hot-updater";
import { appwriteStorage, appwriteDatabase } from "@hot-updater/appwrite";

export default defineConfig({
  storage: appwriteStorage({
    endpoint: process.env.APPWRITE_ENDPOINT!,
    projectId: process.env.APPWRITE_PROJECT_ID!,
    apiKey: process.env.APPWRITE_API_KEY!,
    bucketId: process.env.APPWRITE_BUCKET_ID!,
    functionBaseUrl: process.env.APPWRITE_FUNCTION_BASE_URL!,
    functionJwtSecret: process.env.APPWRITE_FUNCTION_JWT_SECRET!,
  }),
  database: appwriteDatabase({
    endpoint: process.env.APPWRITE_ENDPOINT!,
    projectId: process.env.APPWRITE_PROJECT_ID!,
    apiKey: process.env.APPWRITE_API_KEY!,
    databaseId: process.env.APPWRITE_DATABASE_ID!,
    bundlesCollectionId: process.env.APPWRITE_BUNDLES_COLLECTION_ID!,
    targetVersionsCollectionId: process.env.APPWRITE_TARGET_VERSIONS_COLLECTION_ID!,
  }),
});`;

export const runInit = async ({ build }: { build: BuildType }) => {
  p.log.step(`Selected build plugin: ${build}`);
  const cwd = process.cwd();
  const envPath = path.join(cwd, ".env.hotupdater");
  try {
    if (!fs.existsSync(envPath)) {
      await fs.promises.writeFile(envPath, ENV_TEMPLATE);
      p.log.success("Created .env.hotupdater with Appwrite placeholders");
    } else {
      p.log.info(".env.hotupdater already exists, skipping");
    }
  } catch (e) {
    p.log.error(
      e instanceof Error ? e.message : "Failed to write .env.hotupdater",
    );
  }

  const configPath = path.join(cwd, "hot-updater.config.ts");
  try {
    if (!fs.existsSync(configPath)) {
      await fs.promises.writeFile(configPath, CONFIG_TEMPLATE);
      p.log.success("Created hot-updater.config.ts for Appwrite");
    } else {
      p.log.info("hot-updater.config.ts already exists, skipping");
    }
  } catch (e) {
    p.log.error(
      e instanceof Error ? e.message : "Failed to write hot-updater.config.ts",
    );
  }

  p.note(
    [
      "Next steps:",
      "- Create Appwrite Database and Collections:",
      "  - Database ID: APPWRITE_DATABASE_ID",
      "  - Collections:",
      "    - bundles (documentId = bundle id)",
      "    - target_app_versions (documentId = <platform>:<channel>:<target_app_version>)",
      "- Create private Storage bucket: APPWRITE_BUCKET_ID",
      "- Deploy an HTTP Appwrite Function and expose it via Sites or Function URL",
      `  - Function entry: @hot-updater/appwrite/functions`,
      "  - Set environment variables in the Function runtime:",
      "    APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY,",
      "    APPWRITE_DATABASE_ID, APPWRITE_BUNDLES_COLLECTION_ID,",
      "    APPWRITE_TARGET_VERSIONS_COLLECTION_ID, FUNCTION_JWT_SECRET",
      "- Use the Function's base URL as APPWRITE_FUNCTION_BASE_URL",
    ].join("\n"),
  );
  p.log.success("Appwrite initialization completed");
};
