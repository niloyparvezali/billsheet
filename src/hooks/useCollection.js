import { useEffect, useState } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { auth } from '../firebase/config'

export default function useCollection(queryRef) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  useEffect(() => {
    if (!queryRef) { setData([]); setLoading(false); return }
    setError(null)
    const unsub = onSnapshot(queryRef, snapshot => {
      const ownerId = auth?.currentUser?.uid
      const records = snapshot.docs.map(item => ({ id: item.id, ...item.data() }))
      setData(ownerId ? records.filter(record => record.ownerId === ownerId) : [])
      setLoading(false)
    }, reason => { setError(reason); setLoading(false) })
    return unsub
  }, [])
  return { data, loading, error }
}