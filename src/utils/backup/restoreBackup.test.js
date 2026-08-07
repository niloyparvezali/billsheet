import { beforeEach, describe, expect, it, vi } from "vitest";
import { restoreBackup } from "./restoreBackup";

const mockBatch = {
  delete: vi.fn(),
  set: vi.fn(),
  commit: vi.fn(),
};

const mockDocs = [];

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((db, name) => ({ db, name })),
  doc: vi.fn((db, path, id) => ({ db, path, id })),
  getDocs: vi.fn(async () => ({ forEach: () => {} })),
  query: vi.fn((collectionRef) => collectionRef),
  where: vi.fn(() => ({})),
  writeBatch: vi.fn(() => mockBatch),
  getFirestore: vi.fn(() => null),
}));

describe("restoreBackup", () => {
  beforeEach(() => {
    mockBatch.delete.mockReset();
    mockBatch.set.mockReset();
    mockBatch.commit.mockReset();
    mockBatch.commit.mockResolvedValue(undefined);
    mockDocs.length = 0;
  });

  it("creates fresh document IDs and rewires payments to the new user record when restoring a snapshot", async () => {
    const backup = {
      collections: {
        users: [{ id: "old-user", name: "Alice", customerId: "CUST-001" }],
        payments: [{ id: "old-payment", userId: "old-user", customerId: "CUST-001" }],
        categories: [],
        settings: { theme: "dark" },
      },
    };

    const user = { uid: "account-b" };

    await restoreBackup(backup, user, "keep");

    expect(mockBatch.set).toHaveBeenCalled();
    const userSetCalls = mockBatch.set.mock.calls.filter(([ref]) => ref.path === "users");
    expect(userSetCalls).toHaveLength(1);

    const createdUserRef = userSetCalls[0][0];
    expect(createdUserRef.path).toBe("users");
    expect(createdUserRef.id).toBeDefined();

    const paymentSetCalls = mockBatch.set.mock.calls.filter(([ref]) => ref.path === "payments");
    expect(paymentSetCalls).toHaveLength(1);

    const restoredPayment = paymentSetCalls[0][1];
    expect(restoredPayment.id).toBeUndefined();
    expect(restoredPayment.userId).toBe(createdUserRef.id);
  });

  it("converts undefined optional backup fields to null and removes unsupported undefined values", async () => {
    const backup = {
      collections: {
        users: [
          {
            id: "old-user",
            name: "Alice",
            phone: undefined,
            category: undefined,
            extraField: undefined,
          },
        ],
        payments: [],
        categories: [],
        settings: {},
      },
    };

    const user = { uid: "account-b" };

    await restoreBackup(backup, user, "keep");

    const userSetCalls = mockBatch.set.mock.calls.filter(([ref]) => ref.path === "users");
    expect(userSetCalls).toHaveLength(1);

    const restoredUser = userSetCalls[0][1];
    expect(restoredUser).toMatchObject({
      name: "Alice",
      phone: null,
      category: null,
    });
    expect(restoredUser).not.toHaveProperty("extraField");
  });

  it("converts undefined optional backup fields to null and removes unsupported undefined values", async () => {
    const backup = {
      collections: {
        users: [
          {
            id: "old-user",
            name: "Alice",
            phone: undefined,
            category: undefined,
            extraField: undefined,
          },
        ],
        payments: [],
        categories: [],
        settings: {},
      },
    };

    const user = { uid: "account-b" };

    await restoreBackup(backup, user, "keep");

    const userSetCalls = mockBatch.set.mock.calls.filter(([ref]) => ref.path === "users");
    expect(userSetCalls).toHaveLength(1);

    const restoredUser = userSetCalls[0][1];
    expect(restoredUser).toMatchObject({
      name: "Alice",
      phone: null,
      category: null,
    });
    expect(restoredUser).not.toHaveProperty("extraField");
  });
});
