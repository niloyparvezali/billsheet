import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
} from "firebase/firestore";

import { db } from "../../firebase/config";

export async function resetApplicationData(user) {
  if (!user?.uid) {
    throw new Error("User not found.");
  }

  const batch = writeBatch(db);

  // Delete Users
  const usersSnapshot = await getDocs(
    query(collection(db, "users"), where("ownerId", "==", user.uid)),
  );

  usersSnapshot.forEach((document) => {
    batch.delete(document.ref);
  });

  // Delete Payments
  const paymentsSnapshot = await getDocs(
    query(collection(db, "payments"), where("ownerId", "==", user.uid)),
  );

  paymentsSnapshot.forEach((document) => {
    batch.delete(document.ref);
  });

  // Delete Categories
  const categoriesSnapshot = await getDocs(
    query(collection(db, "categories"), where("ownerId", "==", user.uid)),
  );

  categoriesSnapshot.forEach((document) => {
    batch.delete(document.ref);
  });

  // Delete Settings
  batch.delete(doc(db, "settings", user.uid));

  // Commit all deletes
  await batch.commit();

  return true;
}
