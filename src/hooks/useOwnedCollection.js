import { collection, query, where } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import useCollection from './useCollection'

export default function useOwnedCollection(name) {
  const { user } = useAuth()
  return useCollection(db && user ? query(collection(db, name), where('ownerId', '==', user.uid)) : null)
}