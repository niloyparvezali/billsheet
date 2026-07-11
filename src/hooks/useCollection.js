import { useEffect, useState } from 'react'
import { onSnapshot } from 'firebase/firestore'
export default function useCollection(queryRef) { const [data, setData] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(null); useEffect(() => { if (!queryRef) { setLoading(false); return } setError(null); const unsub = onSnapshot(queryRef, s => { setData(s.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) }, e => { setError(e); setLoading(false) }); return unsub }, []); return { data, loading, error } }
