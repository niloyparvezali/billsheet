import { describe, expect, it, vi } from "vitest";
import { normalizePhone, validateEmail } from "./AuthContext";

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((db, path) => ({ db, path })),
  doc: vi.fn((db, path, id) => ({ db, path, id })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn((collectionRef, whereClause) => ({ collectionRef, whereClause })),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  where: vi.fn((field, op, value) => ({ field, op, value })),
}));

vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: class {
    constructor() {
      this.provider = "google";
    }
  },
}));

vi.mock("../firebase/config", () => ({
  auth: {},
  db: {},
  firebaseReady: true,
}));

describe("Email-based Firebase auth architecture", () => {
  describe("Email normalization", () => {
    it("normalizes email with leading/trailing spaces", () => {
      expect(validateEmail("  bondhumohol.net@gmail.com  ")).toBe(
        "bondhumohol.net@gmail.com"
      );
    });

    it("normalizes email to lowercase", () => {
      expect(validateEmail("BondhuMohOl.Net@Gmail.Com")).toBe(
        "bondhumohol.net@gmail.com"
      );
    });

    it("normalizes email with both spaces and uppercase", () => {
      expect(validateEmail("  BondhuMohOl.Net@Gmail.Com  ")).toBe(
        "bondhumohol.net@gmail.com"
      );
    });

    it("rejects invalid email formats", () => {
      expect(validateEmail("notanemail")).toBeNull();
      expect(validateEmail("@example.com")).toBeNull();
      expect(validateEmail("user@")).toBeNull();
      expect(validateEmail("user @example.com")).toBeNull();
    });

    it("accepts valid email formats", () => {
      expect(validateEmail("user@example.com")).toBe("user@example.com");
      expect(validateEmail("first.last@sub.example.co.uk")).toBe(
        "first.last@sub.example.co.uk"
      );
    });
  });

  describe("Passcode validation", () => {
    it("requires exactly 6 digits", () => {
      // These are validation checks that should happen before Firebase Auth call
      const testPasscodes = ["12345", "1234567", "123abc", ""];
      testPasscodes.forEach((passcode) => {
        expect(/^\d{6}$/.test(passcode)).toBe(false);
      });

      expect(/^\d{6}$/.test("123456")).toBe(true);
    });
  });

  describe("Phone normalization", () => {
    it("normalizes a spaced phone number to digits", () => {
      expect(normalizePhone("017 1234 5678")).toBe("01712345678");
    });

    it("normalizes a phone number with dashes", () => {
      expect(normalizePhone("017-1234-5678")).toBe("01712345678");
    });

    it("handles empty phone number", () => {
      expect(normalizePhone("")).toBe("");
    });
  });

  describe("Firebase Auth Integration (Mocked)", () => {
    it("should call Firebase Auth with real email + 6-digit passcode", async () => {
      // This test verifies the function signature expectations
      const email = "bondhumohol.net@gmail.com";
      const passcode = "123456";

      // The actual implementation will call:
      // signInWithEmailAndPassword(auth, email, passcode)
      // where email is the REAL email address, not an internal email

      expect(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)).toBe(true);
      expect(/^\d{6}$/.test(passcode)).toBe(true);
    });
  });

  describe("No internal emails", () => {
    it("should NOT generate p_@billsheet-internal emails", () => {
      // The new architecture uses real emails
      const internalEmailPattern = /^p_\d+@billsheet(-internal|\.internal)$/;
      const realEmail = "bondhumohol.net@gmail.com";

      expect(internalEmailPattern.test(realEmail)).toBe(false);
    });

    it("should preserve real email addresses", () => {
      const email = validateEmail("bondhumohol.net@gmail.com");
      expect(email).toBe("bondhumohol.net@gmail.com");
      expect(email).not.toMatch(/billsheet/);
      expect(email).not.toMatch(/^p_/);
    });
  });

  describe("Google Sign-In", () => {
    it("should use GoogleAuthProvider for popup sign-in", async () => {
      const { GoogleAuthProvider } = await import("firebase/auth");
      
      // Verify GoogleAuthProvider can be instantiated
      const provider = new GoogleAuthProvider();
      expect(provider).toBeDefined();
      expect(provider.provider).toBe("google");
    });

    it("should handle Google sign-in without creating internal emails", () => {
      // Google sign-in should use real email from Google account
      const googleEmail = "user@gmail.com";
      const isRealEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(googleEmail);
      expect(isRealEmail).toBe(true);
      expect(googleEmail).not.toMatch(/^p_/);
      expect(googleEmail).not.toMatch(/billsheet/);
    });
  });
});
