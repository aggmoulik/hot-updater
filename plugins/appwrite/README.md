# @hot-updater/appwrite

Appwrite provider for Hot Updater. Provides:

- `appwriteStorage` for private Appwrite Storage buckets
- `appwriteDatabase` for Appwrite Databases
- Two Appwrite Functions:
  - `check-update` serves the update API
  - `bundle` serves short‑lived bundle downloads

## Quick start

1. Install

```bash
pnpm add -D @hot-updater/appwrite
```

2. Add configuration

```ts
// hot-updater.config.ts
import { defineConfig } from "hot-updater";
import { appwriteStorage, appwriteDatabase } from "@hot-updater/appwrite";

export default defineConfig({
  storage: appwriteStorage({
    endpoint: process.env.APPWRITE_ENDPOINT!,
    projectId: process.env.APPWRITE_PROJECT_ID!,
    apiKey: process.env.APPWRITE_API_KEY!,
    bucketId: process.env.APPWRITE_BUCKET_ID!,
    bundleFunctionBaseUrl: process.env.APPWRITE_BUNDLE_FUNCTION_BASE_URL!,
    functionJwtSecret: process.env.APPWRITE_FUNCTION_JWT_SECRET!,
  }),
  database: appwriteDatabase({
    endpoint: process.env.APPWRITE_ENDPOINT!,
    projectId: process.env.APPWRITE_PROJECT_ID!,
    apiKey: process.env.APPWRITE_API_KEY!,
    databaseId: process.env.APPWRITE_DATABASE_ID!,
    bundlesCollectionId: process.env.APPWRITE_BUNDLES_COLLECTION_ID!,
    targetVersionsCollectionId:
      process.env.APPWRITE_TARGET_VERSIONS_COLLECTION_ID!,
  }),
});
```

3. Environment variables

```
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your-project-id
APPWRITE_API_KEY=your-api-key
APPWRITE_DATABASE_ID=hot-updater
APPWRITE_BUNDLES_COLLECTION_ID=bundles
APPWRITE_TARGET_VERSIONS_COLLECTION_ID=target_app_versions
APPWRITE_BUCKET_ID=hot-updater-bundles
APPWRITE_BUNDLE_FUNCTION_BASE_URL=https://your-appwrite-bundle-function-url
APPWRITE_FUNCTION_JWT_SECRET=replace-with-long-random-secret
```

4. Functions

- Deploy two HTTP Appwrite Functions:
  - Check API entry: `@hot-updater/appwrite/functions/check-update`
  - Bundle entry: `@hot-updater/appwrite/functions/bundle`
- The client app should call the Check API endpoint at `GET /api/check-update`
- The Check function returns a signed `fileUrl` pointing to the Bundle function


