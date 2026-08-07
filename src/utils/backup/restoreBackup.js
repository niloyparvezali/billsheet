import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "../../firebase/config";

const COLLECTIONS = ["users", "payments", "categories"];

const OPTIONAL_FIELDS = new Set([
  "joinDate",
  "inactiveDate",
  "disconnectedAt",
  "phone",
  "category",
  "categoryId",
  "customerId",
  "userId",
  "statusHistory",
  "packages",
  "address",
  "status",
  "ownerId",
  "createdAt",
  "updatedAt",
  "theme",
  "smsTemplate",
]);

const normalizeBackupRecord = (item = {}) => ({
  ...item,
  id: undefined,
  ownerId: undefined,
});

const sanitizeValue = (value, key, path) => {
  if (value === undefined) {
    return OPTIONAL_FIELDS.has(key) ? null : undefined;
  }

  if (value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    const sanitizedArray = value
      .map((item, index) => sanitizeValue(item, key, `${path}[${index}]`))
      .filter((item) => item !== undefined);
    return sanitizedArray;
  }

  if (typeof value === "object") {
    return sanitizeObject(value, path);
  }

  return value;
};

const sanitizeObject = (object, path) => {
  if (object === null) {
    return null;
  }

  const sanitized = {};

  for (const [key, value] of Object.entries(object)) {
    const currentPath = path ? `${path}.${key}` : key;
    const sanitizedValue = sanitizeValue(value, key, currentPath);

    if (sanitizedValue !== undefined) {
      sanitized[key] = sanitizedValue;
    }
  }

  return sanitized;
};

const validateNoUndefined = (value, path) => {
  if (value === undefined) {
    throw new Error(`Undefined value found at restore path: ${path}`);
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => validateNoUndefined(item, `${path}[${index}]`));
    return;
  }

  if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      validateNoUndefined(item, `${path}.${key}`);
    }
  }
};

const sanitizeRecordForFirestore = (record, path) => {
  const sanitized = sanitizeObject(record, path);
  validateNoUndefined(sanitized, path);
  return sanitized;
};

const cloneForAccount = (item, ownerId) => {
  const record = normalizeBackupRecord(item);
  return sanitizeRecordForFirestore({
    ...record,
    ownerId,
  }, "backup.record");
};

const createFreshDocId = (collectionName) => {
  if (!db) return `${collectionName}-${Math.random().toString(36).slice(2, 10)}`;
  const ref = doc(collection(db, collectionName));
  return ref?.id || `${collectionName}-${Math.random().toString(36).slice(2, 10)}`;
};

export async function restoreBackup(backup, user, mode = "keep") {
  if (!user?.uid) {
    throw new Error("User not found.");
  }

  if (!backup) {
    throw new Error("Backup not found.");
  }

  if (!backup.collections) {
    throw new Error("Invalid backup file.");
  }

  const {
    users = [],
    payments = [],
    categories = [],
    settings = {},
  } = backup.collections;

  const shouldReplaceExisting = mode === "replace";

  if (shouldReplaceExisting) {
    const deleteBatch = writeBatch(db);

    for (const name of COLLECTIONS) {
      const snapshot = await getDocs(
        query(collection(db, name), where("ownerId", "==", user.uid)),
      );

      snapshot.forEach((documentSnapshot) => {
        deleteBatch.delete(documentSnapshot.ref);
      });
    }

    deleteBatch.delete(doc(db, "settings", user.uid));
    await deleteBatch.commit();
  }

  const restoreBatch = writeBatch(db);

  const restoredUsers = [];
  const restoredPayments = [];
  const restoredCategories = [];
  const userIdMap = new Map();
  const categoryIdMap = new Map();

  users.forEach((item) => {
    const freshId = createFreshDocId("users");
    let nextRecord = cloneForAccount(item, user.uid);
    const backupKey = item.id || item.customerId || item.name || freshId;
    userIdMap.set(backupKey, freshId);

    try {
      nextRecord = sanitizeRecordForFirestore(nextRecord, `users/${freshId}`);
    } catch (error) {
      throw new Error(`Failed to sanitize user restore record users/${freshId}: ${error.message}`);
    }

    restoredUsers.push({ id: freshId, ...nextRecord });
    restoreBatch.set(doc(db, "users", freshId), nextRecord, { merge: false });
  });

  categories.forEach((item) => {
    const freshId = createFreshDocId("categories");
    let nextRecord = cloneForAccount(item, user.uid);
    const backupKey = item.id || item.name || freshId;
    categoryIdMap.set(backupKey, freshId);

    try {
      nextRecord = sanitizeRecordForFirestore(nextRecord, `categories/${freshId}`);
    } catch (error) {
      throw new Error(`Failed to sanitize category restore record categories/${freshId}: ${error.message}`);
    }

    restoredCategories.push({ id: freshId, ...nextRecord });
    restoreBatch.set(doc(db, "categories", freshId), nextRecord, { merge: false });
  });

  payments.forEach((item) => {
    const freshId = createFreshDocId("payments");
    let nextRecord = cloneForAccount(item, user.uid);
    const backupUserId = item.userId || item.customerId || item.userName || item.customerName || item.name;
    const backupCategoryId = item.categoryId || item.category || item.userCategory;

    const freshUserId = userIdMap.get(backupUserId);
    if (freshUserId) {
      nextRecord.userId = freshUserId;
      if (!nextRecord.customerId) {
        nextRecord.customerId = item.customerId || freshUserId;
      }
    }

    const freshCategoryId = categoryIdMap.get(backupCategoryId);
    if (freshCategoryId) {
      nextRecord.categoryId = freshCategoryId;
      nextRecord.category = item.category || nextRecord.category;
    }

    try {
      nextRecord = sanitizeRecordForFirestore(nextRecord, `payments/${freshId}`);
    } catch (error) {
      throw new Error(`Failed to sanitize payment restore record payments/${freshId}: ${error.message}`);
    }

    restoredPayments.push({ id: freshId, ...nextRecord });
    restoreBatch.set(doc(db, "payments", freshId), nextRecord, { merge: false });
  });

  let sanitizedSettings;
  try {
    sanitizedSettings = sanitizeRecordForFirestore(
      { ...settings, ownerId: user.uid },
      `settings/${user.uid}`,
    );
  } catch (error) {
    throw new Error(`Failed to sanitize settings restore record settings/${user.uid}: ${error.message}`);
  }

  restoreBatch.set(doc(db, "settings", user.uid), sanitizedSettings, { merge: false });

  await restoreBatch.commit();

  return {
    users: restoredUsers.length,
    payments: restoredPayments.length,
    categories: restoredCategories.length,
    settings: Object.keys(settings).length > 0,
  };
}
