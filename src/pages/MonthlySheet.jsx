import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { FiEdit2, FiTrash2, FiUsers } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { db } from '../firebase/config'
import useCollection from '../hooks/useCollection'
import Modal from '../components/Modal'
import { monthNames, money, formatDate, formatTime } from '../utils/date'

export default function MonthlySheet() {
  const d = new Date()
  const [month, setMonth] = useState(d.getMonth() + 1)
  const [year, setYear] = useState(d.getFullYear())
  const [editing, setEditing] = useState(null)
  const { data: users } = useCollection(db ? collection(db, 'users') : null)
  const { data: allPayments } = useCollection(db ? collection(db, 'payments') : null)
  const payments = allPayments.filter(p => +p.month === month && +p.year === year)
  const rows = useMemo(() => [...users].sort((a, b) => a.name.localeCompare(b.name)).map(user => ({ user, payment: payments.find(p => p.userId === user.id) })), [users, payments])
  const paid = rows.filter(row => Number(row.payment?.amount) > 0)
  const total = paid.reduce((sum, row) => sum + Number(row.payment.amount), 0)
  const remove = async id => { if (confirm('Delete this payment?')) { await deleteDoc(doc(db, 'payments', id)); toast.success('Payment deleted') } }

  return <div className="page">
    <div className="page-title"><div><h2>Monthly Sheet</h2><p>Record and review every payment.</p></div></div>
    <div className="toolbar filters">
      <select value={month} onChange={e => setMonth(+e.target.value)}>{monthNames.map((name, i) => <option value={i + 1} key={name}>{name}</option>)}</select>
      <input type="number" min="2024" value={year} onChange={e => setYear(+e.target.value)} />
      {rows.length > 0 && <span className="customer-count"><FiUsers /> {rows.length} {rows.length === 1 ? 'customer' : 'customers'}</span>}
    </div>
    <section className={rows.length ? 'panel table-wrap' : 'panel sheet-empty'}>
      {rows.length ? <table><thead><tr><th>SL</th><th>Name</th><th>Category</th><th>Amount</th><th>Status</th><th>Payment date</th><th>Time</th><th>Note</th><th /></tr></thead><tbody>{rows.map(({ user, payment }, i) => {
        const isPaid = Number(payment?.amount) > 0
        return <tr className={isPaid ? 'paid-row' : 'pending-row'} key={user.id}><td>{i + 1}</td><td data-label="Name"><b>{user.name}</b></td><td>{user.category}</td><td>{money(payment?.amount)}</td><td><span className={isPaid ? 'status paid' : 'status pending'}>{isPaid ? '● Paid' : '● Pending'}</span></td><td>{formatDate(payment?.paymentDate)}</td><td>{formatTime(payment?.paymentDate)}</td><td>{payment?.note || '—'}</td><td className="actions"><button onClick={() => setEditing({ user, payment })}><FiEdit2 /></button>{payment && <button className="danger" onClick={() => remove(payment.id)}><FiTrash2 /></button>}</td></tr>
      })}</tbody></table> : <div className="sheet-empty-content"><span><FiUsers /></span><h3>Start with your first customer</h3><p>Add customers from the Users page, then come back to record their payments for {monthNames[month - 1]} {year}.</p><Link className="primary" to="/users">Go to Users</Link></div>}
    </section>
    <div className="summary"><div>Total Users<b>{rows.length}</b></div><div>Paid Users<b>{paid.length}</b></div><div>Pending Users<b>{rows.length - paid.length}</b></div><div>Total Collection<b>{money(total)}</b></div><div>Average Collection<b>{money(paid.length ? total / paid.length : 0)}</b></div></div>
    {editing && <PaymentModal data={editing} month={month} year={year} close={() => setEditing(null)} />}
  </div>
}

function PaymentModal({ data, month, year, close }) {
  const [amount, setAmount] = useState(data.payment?.amount || '')
  const [note, setNote] = useState(data.payment?.note || '')
  const save = async event => { event.preventDefault(); const value = Number(amount || 0), base = { userId: data.user.id, userName: data.user.name, month, year, amount: value, status: value > 0 ? 'paid' : 'pending', note }; try { if (data.payment) await updateDoc(doc(db, 'payments', data.payment.id), { ...base, updatedAt: serverTimestamp() }); else await addDoc(collection(db, 'payments'), { ...base, paymentDate: serverTimestamp() }); toast.success('Payment saved'); close() } catch (error) { toast.error(error.message) } }
  return <Modal title={`Payment · ${data.user.name}`} onClose={close}><form className="form" onSubmit={save}><label>Amount<input type="number" min="0" step="any" autoFocus value={amount} onChange={e => setAmount(e.target.value)} /></label><label>Note<textarea value={note} onChange={e => setNote(e.target.value)} /></label><button className="primary">Save payment</button></form></Modal>
}
