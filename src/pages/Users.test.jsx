import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Users from "./Users";
import { buildUserDocId, findDuplicateUser } from "../utils/users";

const { mockNavigate, mockUseOwnedCollection, mockSetDoc } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseOwnedCollection: vi.fn(),
  mockSetDoc: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../hooks/useOwnedCollection", () => ({
  default: mockUseOwnedCollection,
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { uid: "session-owner-1" } }),
}));

vi.mock("../context/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key, fallback) => fallback ?? key,
    formatNumber: (value) => String(value),
  }),
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("firebase/firestore", () => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  serverTimestamp: () => ({}),
  setDoc: mockSetDoc,
  updateDoc: vi.fn(),
}));

vi.mock("../firebase/config", () => ({
  db: {},
  auth: { currentUser: { uid: "auth-owner-1" } },
}));

vi.mock("../components/Modal", () => ({
  default: ({ children }) => <div>{children}</div>,
}));

vi.mock("../components/ConfirmModal", () => ({
  default: () => null,
}));

vi.mock("../components/CategoryModal", () => ({
  default: () => null,
}));

vi.mock("../components/UserForm", () => ({
  default: ({ form, setForm, onSubmit }) => (
    <form onSubmit={onSubmit}>
      <label>
        Name
        <input
          value={form?.name || ""}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
        />
      </label>
      <label>
        Phone
        <input
          value={form?.phone || ""}
          onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
        />
      </label>
      <label>
        Monthly Bill
        <input
          type="number"
          value={form?.monthlyBill ?? ""}
          onChange={(event) => setForm((current) => ({ ...current, monthlyBill: event.target.value }))}
        />
      </label>
      <label>
        Join date
        <input
          type="date"
          value={form?.joinDate || ""}
          onChange={(event) => setForm((current) => ({ ...current, joinDate: event.target.value }))}
        />
      </label>
      <button type="submit">Save user</button>
    </form>
  ),
}));

vi.mock("../components/PaymentModal", () => ({
  default: () => null,
}));

vi.mock("../components/UsersTable", () => ({
  default: ({ list, onSelectUser }) => (
    <div>
      {list.map((user) => (
        <button key={user.id} type="button" onClick={() => onSelectUser?.(user.id)}>
          {user.name}
        </button>
      ))}
    </div>
  ),
}));

describe("Users mobile navigation", () => {
  it("treats the same normalized phone number and same name as duplicate user identities", () => {
    const existingUsers = [
      { id: "owner-1-phone-+8801712345678", ownerId: "owner-1", name: "Anik", phone: "+8801712345678" },
    ];

    expect(findDuplicateUser(existingUsers, { ownerId: "owner-1", phone: "01712345678" })).toEqual(existingUsers[0]);
    expect(findDuplicateUser(existingUsers, { ownerId: "owner-1", name: "Anik" })).toEqual(existingUsers[0]);
    expect(findDuplicateUser(existingUsers, { ownerId: "owner-2", phone: "01712345678" })).toBeNull();
    expect(buildUserDocId({ ownerId: "owner-1", phone: "01712345678" })).toBe("owner-1-phone-+8801712345678");
  });

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseOwnedCollection.mockImplementation((collectionName) => {
      if (collectionName === "users") {
        return {
          data: [
            {
              id: "user-1",
              name: "Alice",
              phone: "+8801712345678",
              monthlyBill: 1200,
              category: "Gold",
              status: "Active",
              packages: [],
              active: true,
              createdAt: "2024-01-01",
            },
          ],
        };
      }
      if (collectionName === "categories") {
        return { data: [] };
      }
      return { data: [] };
    });

    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 375,
    });
    window.dispatchEvent(new Event("resize"));
  });

  it("switches to a dedicated mobile details view and restores the list on back", () => {
    render(
      <MemoryRouter>
        <Users />
      </MemoryRouter>,
    );

    expect(screen.getByPlaceholderText(/search users by name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add_user/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /alice/i }));

    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/search users by name/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add_user/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /back/i }));

    expect(screen.getByPlaceholderText(/search users by name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add_user/i })).toBeInTheDocument();
  });

  it("shows the desktop details view and returns to the list on back", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1280,
    });
    window.dispatchEvent(new Event("resize"));

    render(
      <MemoryRouter>
        <Users />
      </MemoryRouter>,
    );

    expect(screen.getByPlaceholderText(/search users by name/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /alice/i }));

    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/search users by name/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /back/i }));

    expect(screen.getByPlaceholderText(/search users by name/i)).toBeInTheDocument();
  });

  it("uses the authenticated owner UID when creating a new user record", async () => {
    mockSetDoc.mockReset();

    render(
      <MemoryRouter>
        <Users />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /add_user/i }));
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "John Smith" } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "+8801712345678" } });
    fireEvent.change(screen.getByLabelText(/monthly bill/i), { target: { value: "1200" } });
    fireEvent.change(screen.getByLabelText(/join date/i), { target: { value: "2025-01-10" } });
    fireEvent.click(screen.getByRole("button", { name: /save user/i }));

    await waitFor(() => {
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
    });

    expect(mockSetDoc.mock.calls[0][1]).toEqual(
      expect.objectContaining({ ownerId: "auth-owner-1" }),
    );
  });
});
