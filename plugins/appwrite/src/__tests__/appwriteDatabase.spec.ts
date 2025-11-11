import { describe, it, expect, vi } from "vitest";
import { appwriteDatabase } from "../appwriteDatabase";

const listDocumentsMock = vi
  .fn()
  .mockResolvedValue({ total: 0, documents: [] });
const getDocumentMock = vi.fn().mockRejectedValue(new Error("not found"));
const createDocumentMock = vi.fn().mockResolvedValue({});
const updateDocumentMock = vi.fn().mockResolvedValue({});
const deleteDocumentMock = vi.fn().mockResolvedValue({});

vi.mock("node-appwrite", () => {
  return {
    Client: vi.fn().mockImplementation(() => ({
      setEndpoint: vi.fn().mockReturnThis(),
      setProject: vi.fn().mockReturnThis(),
      setKey: vi.fn().mockReturnThis(),
    })),
    Databases: vi.fn().mockImplementation(() => ({
      listDocuments: listDocumentsMock,
      getDocument: getDocumentMock,
      createDocument: createDocumentMock,
      updateDocument: updateDocumentMock,
      deleteDocument: deleteDocumentMock,
    })),
    Query: {
      equal: vi.fn((..._args) => "eq"),
      orderDesc: vi.fn((_f) => "order"),
      limit: vi.fn((_n) => "limit"),
      offset: vi.fn((_n) => "offset"),
      greaterThanEqual: vi.fn((_f, _v) => "gte"),
    },
    ID: { unique: vi.fn() },
  };
});

describe("appwriteDatabase", () => {
  const factory = appwriteDatabase(
    {
      endpoint: "https://cloud.appwrite.io/v1",
      projectId: "pid",
      apiKey: "key",
      databaseId: "db",
      bundlesCollectionId: "bundles",
      targetVersionsCollectionId: "target_app_versions",
    },
    undefined,
  );

  it("getChannels returns array", async () => {
    listDocumentsMock.mockResolvedValueOnce({
      total: 1,
      documents: [{ channel: "production" }],
    });
    const plugin = factory({ cwd: process.cwd() });
    const channels = await plugin.getChannels();
    expect(Array.isArray(channels)).toBe(true);
  });

  it("commitBundle inserts bundle and creates target_app_versions doc", async () => {
    const plugin = factory({ cwd: process.cwd() });
    // @ts-expect-error private
    await plugin.appendBundle({
      id: "00000000-0000-0000-0000-000000000001",
      platform: "ios",
      shouldForceUpdate: false,
      enabled: true,
      fileHash: "hash",
      gitCommitHash: null,
      message: "msg",
      channel: "production",
      storageUri: "appwrite-storage://bucket/file",
      targetAppVersion: "1.2.x",
      fingerprintHash: null,
      metadata: {},
    });
    await plugin.commitBundle();
    expect(createDocumentMock).toHaveBeenCalled();
  });
});
