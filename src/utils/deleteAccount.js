import { deleteUser } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
} from "firebase/firestore";

import { db } from "../firebase/config";

export async function deleteAccount(user) {
  if (!user?.uid) {
    throw new Error("User not found.");
  }

  const batch = writeBatch(db);

  const collections = ["users", "payments", "categories"];

  for (const name of collections) {
    const snapshot = await getDocs(
      query(collection(db, name), where("ownerId", "==", user.uid)),
    );

    snapshot.forEach((document) => {
      batch.delete(document.ref);
    });
  }

  // Delete settings document
  batch.delete(doc(db, "settings", user.uid));

  // Commit Firestore deletes
  await batch.commit();

  // Delete Firebase Authentication account
  await deleteUser(user);

  return true;
}
