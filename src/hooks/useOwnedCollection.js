import { useMemo } from "react";
import { collection, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import useCollection from "./useCollection";

const EMPTY_QUERY_CONSTRAINTS = [];

export default function useOwnedCollection(
  name,
  queryConstraints = EMPTY_QUERY_CONSTRAINTS,
) {
  const { user } = useAuth();

  const q = useMemo(() => {
    if (!db || !user?.uid) return null;

    const constraints = Array.isArray(queryConstraints)
      ? queryConstraints.filter(Boolean)
      : [];

    return query(
      collection(db, name),
      where("ownerId", "==", user.uid),
      ...constraints,
    );
  }, [name, queryConstraints, user?.uid]);

  return useCollection(q);
}
