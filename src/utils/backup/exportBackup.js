import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../firebase/config";

export async function exportBackup(user) {
  if (!user?.uid) {
    throw new Error("User not found.");
  }

  // Load all user-owned collections
  const [usersSnap, paymentsSnap, categoriesSnap, settingsSnap] =
    await Promise.all([
      getDocs(query(collection(db, "users"), where("ownerId", "==", user.uid))),
      getDocs(
        query(collection(db, "payments"), where("ownerId", "==", user.uid)),
      ),
      getDocs(
        query(collection(db, "categories"), where("ownerId", "==", user.uid)),
      ),
      getDoc(doc(db, "settings", user.uid)),
    ]);

  const backup = {
    app: "Bill Sheet",
    version: 1,
    ownerId: user.uid,
    ownerEmail: user.email || "",
    createdAt: new Date().toISOString(),

    collections: {
      users: usersSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })),

      payments: paymentsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })),

      categories: categoriesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })),

      settings: settingsSnap.exists() ? settingsSnap.data() : {},
    },
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  const now = new Date();

  const fileName = `BillSheet_Backup_${now
    .toISOString()
    .replace(/:/g, "-")
    .slice(0, 16)}.json`;

  link.href = url;
  link.download = fileName;

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  URL.revokeObjectURL(url);

  return backup;
}
