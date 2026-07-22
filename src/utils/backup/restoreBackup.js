import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "../../firebase/config";

export async function restoreBackup(backup, user) {
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

  // ----------------------------
  // STEP 1
  // Delete current user's data
  // ----------------------------

  const collections = ["users", "payments", "categories"];

  const deleteBatch = writeBatch(db);

  for (const name of collections) {
    const snapshot = await getDocs(
      query(collection(db, name), where("ownerId", "==", user.uid)),
    );

    snapshot.forEach((documentSnapshot) => {
      deleteBatch.delete(documentSnapshot.ref);
    });
  }

  deleteBatch.delete(doc(db, "settings", user.uid));

  await deleteBatch.commit();

  // ----------------------------
  // STEP 2
  // Restore backup
  // ----------------------------

  const restoreBatch = writeBatch(db);

  users.forEach((item) => {
    restoreBatch.set(
      doc(db, "users", item.id),
      {
        ...item,
        ownerId: user.uid,
      },
      { merge: false },
    );
  });

  payments.forEach((item) => {
    restoreBatch.set(
      doc(db, "payments", item.id),
      {
        ...item,
        ownerId: user.uid,
      },
      { merge: false },
    );
  });

  categories.forEach((item) => {
    restoreBatch.set(
      doc(db, "categories", item.id),
      {
        ...item,
        ownerId: user.uid,
      },
      { merge: false },
    );
  });

  restoreBatch.set(doc(db, "settings", user.uid), settings, { merge: false });

  await restoreBatch.commit();

  return {
    users: users.length,
    payments: payments.length,
    categories: categories.length,
    settings: Object.keys(settings).length > 0,
  };
}
