import { deleteUser as deleteFirebaseUser } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
} from "firebase/firestore";

import { auth, db } from "../firebase/config";

export async function deleteAccount(user) {
  const authUser = auth?.currentUser;
  const targetUid = user?.uid || authUser?.uid;

  if (!targetUid) {
    throw new Error("User not found.");
  }

  const batch = writeBatch(db);

  const collections = ["users", "payments", "categories"];

  for (const name of collections) {
    const snapshot = await getDocs(
      query(collection(db, name), where("ownerId", "==", targetUid)),
    );

    snapshot.forEach((document) => {
      batch.delete(document.ref);
    });
  }

  // Delete settings document
  batch.delete(doc(db, "settings", targetUid));

  // Commit Firestore deletes
  await batch.commit();

  // Delete Firebase Authentication account using the active auth user
  if (authUser) {
    await deleteFirebaseUser(authUser);
  } else if (user?.firebaseUser) {
    await deleteFirebaseUser(user.firebaseUser);
  } else {
    throw new Error("Authenticated user not available.");
  }

  return true;
}
