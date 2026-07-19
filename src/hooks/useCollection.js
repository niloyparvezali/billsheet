import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";

export default function useCollection(queryRef) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!queryRef) {
      setData([]);
      setError(null);
      setLoading(false);
      return undefined;
    }

    setError(null);
    setLoading(true);

    const unsub = onSnapshot(
      queryRef,
      (snapshot) => {
        const records = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));
        setData(records);
        setLoading(false);
      },
      (reason) => {
        console.error("Firestore listener error:", reason);
        setError(reason);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [queryRef]);

  return { data, loading, error };
}
