import { describe, it, expect, vi } from "vitest";
import { appwriteStorage } from "../appwriteStorage";

vi.mock("node-appwrite", () => {
  return {
    Client: vi.fn().mockImplementation(() => ({
      setEndpoint: vi.fn().mockReturnThis(),
      setProject: vi.fn().mockReturnThis(),
      setKey: vi.fn().mockReturnThis(),
    })),
    Storage: vi.fn().mockImplementation(() => ({
      createFile: vi.fn().mockResolvedValue({}),
      deleteFile: vi.fn().mockResolvedValue({}),
    })),
    InputFile: {
      fromBuffer: vi.fn(),
    },
  };
});

describe("appwriteStorage", () => {
  const factory = appwriteStorage(
    {
      endpoint: "https://cloud.appwrite.io/v1",
      projectId: "pid",
      apiKey: "key",
      bucketId: "bucket",
      functionBaseUrl: "https://fn.example.com",
      functionJwtSecret: "secret",
    },
    undefined,
  );

  it("should upload and return storageUri", async () => {
    const plugin = factory({ cwd: process.cwd() });
    const result = await plugin.upload("bundle-id", __filename);
    expect(result.storageUri.startsWith("appwrite-storage://")).toBe(true);
  });

  it("should produce a download URL via function", async () => {
    const plugin = factory({ cwd: process.cwd() });
    const { fileUrl } = await plugin.getDownloadUrl(
      "appwrite-storage://bucket/path/to/bundle.zip",
    );
    expect(fileUrl).toContain("/bundle/");
    expect(fileUrl).toContain("token=");
  });
});
