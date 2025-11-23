import {
  type BuildType,
  ConfigBuilder,
  makeEnv,
  type ProviderConfig,
  p,
} from "@hot-updater/cli-tools";
import { ExecaError, execa } from "execa";
import fs from "fs/promises";
import type { Project } from "./types";

const getConfigTemplate = (build: BuildType) => {
  const storageConfig: ProviderConfig = {
    imports: [{ pkg: "@hot-updater/appwrite", named: ["appwriteStorage"] }],
    configString: `appwriteStorage({
    endpoint: process.env.APPWRITE_ENDPOINT!,
    projectId: process.env.APPWRITE_PROJECT_ID!,
    apiKey: process.env.APPWRITE_API_KEY!,
    bucketId: process.env.APPWRITE_BUCKET_ID!,
    bundleFunctionBaseUrl: process.env.APPWRITE_BUNDLE_FUNCTION_BASE_URL!,
    functionJwtSecret: process.env.APPWRITE_FUNCTION_JWT_SECRET!,
  })`,
  };
  const databaseConfig: ProviderConfig = {
    imports: [{ pkg: "@hot-updater/appwrite", named: ["appwriteDatabase"] }],
    configString: `appwriteDatabase({
    endpoint: process.env.APPWRITE_ENDPOINT!,
    projectId: process.env.APPWRITE_PROJECT_ID!,
    apiKey: process.env.APPWRITE_API_KEY!,
    databaseId: process.env.APPWRITE_DATABASE_ID!,
    bundlesCollectionId: process.env.APPWRITE_BUNDLES_COLLECTION_ID!,
    targetVersionsCollectionId: process.env.APPWRITE_TARGET_VERSIONS_COLLECTION_ID!,
  })`,
  };

  return new ConfigBuilder()
    .setBuildType(build)
    .setStorage(storageConfig)
    .setDatabase(databaseConfig)
    .getResult();
};

const handleError = (err: unknown, isExit = true) => {
  if (err instanceof ExecaError) {
    p.log.error(err.stderr || err.stdout || err.message);
  } else if (err instanceof Error) {
    p.log.error(`Error occurred: ${err.message}`);
  }
  if (isExit) {
    process.exit(1);
  }
};

const listProjects = async (): Promise<Project[] | undefined> => {
  try {
    const { stdout } = await execa("appwrite", ["projects", "list", "--json"]);
    const data = JSON.parse(stdout);
    return data?.projects || [];
  } catch (err) {
    p.log.error(`Failed to fetch Appwrite projects: ${err}`);
    handleError(err);
  }
};

export const selectProject = async (): Promise<Project | undefined> => {
  p.log.step("Fetching Appwrite projects...");

  const projects = await listProjects();

  if (!projects) {
    p.log.error("No Appwrite projects found");
    process.exit(1);
  }

  // const _createProjectOption = `create/${Math.random()
  //   .toString(36)
  //   .substring(2, 15)}`;

  const selectedProjectId = await p.select({
    message: "Select a Appwrite project",
    options: [
      ...projects.map((project) => ({
        label: `${project.name} (${project.region})`,
        value: project.$id,
      })),
      // {
      //   label: "Create a new project",
      //   value: createProjectOption,
      // },
    ],
  });

  if (p.isCancel(selectedProjectId)) {
    process.exit(0);
  }

  return projects.find((project) => project.$id === selectedProjectId);

  // if (selectedProjectId === createProjectOption) {
  //   try {
  //     await execa("npx", ["-y", "supabase", "projects", "create"], {
  //       stdio: "inherit",
  //       shell: true,
  //     });
  //   } catch (err) {
  //     if (err instanceof ExecaError) {
  //       console.error(err.stderr);
  //     } else {
  //       console.error(err);
  //     }
  //     process.exit(1);
  //   }

  //   // Re-run the selection after creating a new project
  //   return selectProject();
  // }

  // const selectedProject = projectsProcess.find(
  //   (project) => project.id === selectedProjectId,
  // );
  // if (!selectedProject) {
  //   throw new Error("Project not found");
  // }

  // return selectedProject;
};

async function loginAppwriteUsingEmail(
  email: string,
  password: string,
  endpoint?: string,
) {
  try {
    const loginCommand = ["login", "--email", email, "--password", password];

    if (endpoint) {
      loginCommand.push("--endpoint", endpoint);
    }

    await execa("appwrite", loginCommand);
  } catch (err) {
    handleError(err);
  }
}

// Check if Appwrite CLI is installed
const checkAppwriteCLIInstalled = async () => {
  p.log.step("Checking if Appwrite CLI is installed...");
  try {
    await execa("appwrite", ["--version"], {
      stdio: "inherit",
      shell: true,
    });
    p.log.success("✅ Appwrite CLI installed!");
    return true;
  } catch {
    p.log.error("❌ Appwrite CLI not installed!");
    return false;
  }
};

const installAppwriteCLI = async () => {
  // Intsall the Appwrite CLI if not installed
  await p.tasks([
    {
      title: "Installing Appwrite CLI...",
      task: async () => {
        return await new Promise((resolve, reject) => {
          const child = execa("brew", ["install", "appwrite"]);
          child.on("error", reject);
          child.on("exit", (code) => {
            if (code === 0) resolve("Appwrite CLI is installed");
            else
              reject(
                new Error(`❌ Appwrite CLI not installed with code ${code}`),
              );
          });
        })
          .then(() => {
            p.log.success("✅ Appwrite CLI installed!");
          })
          .catch((err) => {
            p.log.error("❌ Appwrite CLI not installed!");
            handleError(err);
          });
      },
    },
  ]);
};

export type AppwriteLoggedInResponse = {
  ID: string;
  Name: string;
  Email: string;
  "MFA enabled": string;
  Endpoint: string;
};

const checkAppwriteLoggedIn = async (): Promise<boolean> => {
  p.log.step("Checking if Appwrite is logged in...");
  try {
    const { stdout } = await execa("appwrite", ["whoami", "--json"]);
    return Boolean(stdout?.length);
  } catch (err) {
    handleError(err, false);
    return false;
  }
};

const appwriteLoginInputs = async () => {
  try {
    const emailAndPassword = await p.group({
      email: () =>
        p.text({
          message: "Enter your Appwrite Email",
          validate: (value) => (value ? undefined : "Email is required"),
        }),
      password: () =>
        p.password({
          message: "Enter your Appwrite Password",
          validate: (value) => (value ? undefined : "Password is required"),
        }),
    });
    if (p.isCancel(emailAndPassword)) process.exit(1);
    return emailAndPassword;
  } catch (err) {
    handleError(err);
  }
};

export const runInit = async ({ build }: { build: BuildType }) => {
  // const spinner = p.spinner();
  // const cwd = getCwd();

  const isAppwriteCLIInstalled = await checkAppwriteCLIInstalled();
  if (!isAppwriteCLIInstalled) {
    p.log.error("Appwrite CLI is not installed");
    await installAppwriteCLI();
  }

  const isAppwriteLoggedIn = await checkAppwriteLoggedIn();
  if (!isAppwriteLoggedIn) {
    p.log.error("Appwrite is not logged in");
    const emailAndPassword = await appwriteLoginInputs();
    if (!emailAndPassword) {
      p.log.error("Appwrite login credentials are required");
      process.exit(1);
    }
    await loginAppwriteUsingEmail(
      emailAndPassword.email,
      emailAndPassword.password,
    );
  }

  const project = await selectProject();

  p.log.step(`Selected Appwrite project: ${project?.name}: ${project?.$id}`);

  await fs.writeFile("hot-updater.config.ts", getConfigTemplate(build));
  await makeEnv({
    APPWRITE_ENDPOINT: process.env.APPWRITE_ENDPOINT!,
    APPWRITE_PROJECT_ID: process.env.APPWRITE_PROJECT_ID!,
    APPWRITE_API_KEY: process.env.APPWRITE_API_KEY!,
    APPWRITE_DATABASE_ID: process.env.APPWRITE_DATABASE_ID!,
    APPWRITE_BUNDLES_COLLECTION_ID: process.env.APPWRITE_BUNDLES_COLLECTION_ID!,
    APPWRITE_TARGET_VERSIONS_COLLECTION_ID:
      process.env.APPWRITE_TARGET_VERSIONS_COLLECTION_ID!,
    APPWRITE_BUCKET_ID: process.env.APPWRITE_BUCKET_ID!,
    APPWRITE_BUNDLE_FUNCTION_BASE_URL:
      process.env.APPWRITE_BUNDLE_FUNCTION_BASE_URL!,
    APPWRITE_FUNCTION_JWT_SECRET: process.env.APPWRITE_FUNCTION_JWT_SECRET!,
  });
  p.log.success("Generated '.env.hotupdater' file with Appwrite settings.");
  p.log.success(
    "Generated 'hot-updater.config.ts' file with Appwrite settings.",
  );

  p.note(
    [
      "Next steps:",
      "- Create Appwrite Database and Collections:",
      "  - Database ID: APPWRITE_DATABASE_ID",
      "  - Collections:",
      "    - bundles (documentId = bundle id)",
      "    - target_app_versions (documentId = <platform>:<channel>:<target_app_version>)",
      "- Create private Storage bucket: APPWRITE_BUCKET_ID",
      "- Deploy two HTTP Appwrite Functions and expose them via Sites or Function URLs:",
      `  - Check API entry: @hot-updater/appwrite/functions/check-update`,
      `  - Bundle entry: @hot-updater/appwrite/functions/bundle`,
      "  - Set environment variables in the Function runtime:",
      "    APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY,",
      "    APPWRITE_DATABASE_ID, APPWRITE_BUNDLES_COLLECTION_ID,",
      "    APPWRITE_TARGET_VERSIONS_COLLECTION_ID, FUNCTION_JWT_SECRET",
      "- Use the Bundle Function URL as APPWRITE_BUNDLE_FUNCTION_BASE_URL",
    ].join("\n"),
  );
  p.log.success("Appwrite initialization completed");
};
