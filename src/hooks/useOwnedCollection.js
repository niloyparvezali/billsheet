import { useMemo } from "react";
import { collection, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import useCollection from "./useCollection";

export default function useOwnedCollection(name) {
  const { user } = useAuth();

  const q = useMemo(() => {
    if (!db || !user?.uid) return null;
    return query(collection(db, name), where("ownerId", "==", user.uid));
  }, [name, user?.uid]);

  return useCollection(q);
}
