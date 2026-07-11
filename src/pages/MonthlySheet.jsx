import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { FiEdit2, FiTrash2, FiUsers } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { db } from '../firebase/config'
import useCollection from '../hooks/useCollection'
import Modal from '../components/Modal'
import { monthNames, money, formatDate, formatTime } from '../utils/date'

const period = (month, year) => Number(year) * 12 + Number(month)

export default function MonthlySheet() {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())
  const [editing, setEditing] = useState(null)
  const { data: users } = useCollection(db ? collection(db, 'users') : null)
  const { data: allPayments } = useCollection(db ? collection(db, 'payments') : null)
  const currentPeriod = period(month, year)
  const payments = allPayments.filter(payment => +payment.month === month && +payment.year === year)
  const activeUsers = users.filter(user => user.active !== false)
  const dueFor = user => {
    const bill = Number(user.monthlyBill || 0)
    const previous = allPayments.filter(payment => payment.userId === user.id && period(payment.month, payment.year) < currentPeriod).sort((a, b) => period(b.month, b.year) - period(a.month, a.year))[0]
    const missedMonths = previous ? Math.max(1, currentPeriod - period(previous.month, previous.year)) : 1
    return Math.max(0, Number(previous?.due || 0) + bill * missedMonths)
  }
  const rows = useMemo(() => {
    const currentUsers = activeUsers.map(user => ({ user, payment: payments.find(item => item.userId === user.id) }))
    const archivedUsers = payments.filter(payment => !activeUsers.some(user => user.id === payment.userId)).map(payment => ({ user: { id: payment.userId, name: payment.userName || 'Former customer', category: payment.userCategory || '—', monthlyBill: payment.monthlyBill || 0, archived: true }, payment }))
    return [...currentUsers, ...archivedUsers].sort((a, b) => a.user.name.localeCompare(b.user.name)).map(({ user, payment }) => {
    const openingDue = dueFor(user)
    return { user, payment, openingDue, due: payment ? Number(payment.due || 0) : openingDue }
    })
  }, [activeUsers, payments, allPayments, month, year])
  const paid = rows.filter(row => Number(row.payment?.amount) > 0)
  const total = paid.reduce((sum, row) => sum + Number(row.payment.amount), 0)
  const totalDue = rows.reduce((sum, row) => sum + Number(row.due || 0), 0)
  const remove = async id => { if (confirm('Delete this payment?')) { await deleteDoc(doc(db, 'payments', id)); toast.success('Payment deleted') } }

  return <div className="page">
    <div className="page-title"><div><h2>Monthly Sheet</h2><p>Record and review every payment.</p></div></div>
    <div className="toolbar filters"><select value={month} onChange={e => setMonth(+e.target.value)}>{monthNames.map((name, i) => <option value={i + 1} key={name}>{name}</option>)}</select><input type="number" min="2024" value={year} onChange={e => setYear(+e.target.value)} />{rows.length > 0 && <span className="customer-count"><FiUsers /> {rows.length} {rows.length === 1 ? 'customer' : 'customers'}</span>}</div>
    <div className="summary sheet-summary"><div>Total Users<b>{rows.length}</b></div><div>Paid Users<b>{paid.length}</b></div><div>Pending Users<b>{rows.length - paid.length}</b></div><div>Total Collection<b>{money(total)}</b></div><div>Total Due<b>{money(totalDue)}</b></div></div>
    <section className={rows.length ? 'panel table-wrap' : 'panel sheet-empty'}>
      {rows.length ? <table className="monthly-table"><thead><tr><th>SL</th><th>Name</th><th>Category</th><th>Bill</th><th>Paid</th><th>Due</th><th>Status</th><th>Payment date</th><th>Time</th><th /></tr></thead><tbody>{rows.map(({ user, payment, openingDue, due }, i) => {
        const isPaid = Number(payment?.amount) > 0
        return <tr className={isPaid ? 'paid-row' : 'pending-row'} key={user.id}><td>{i + 1}</td><td><b>{user.name}</b></td><td>{user.category}</td><td>{money(user.monthlyBill)}</td><td>{money(payment?.amount)}</td><td><b className={due > 0 ? 'due-value' : ''}>{money(due)}</b></td><td><span className={isPaid ? 'status paid' : 'status pending'}>{isPaid ? '● Paid' : '● Pending'}</span></td><td>{formatDate(payment?.paymentDate)}</td><td>{formatTime(payment?.paymentDate)}</td><td className="actions"><button onClick={() => setEditing({ user, payment, openingDue })}><FiEdit2 /></button>{payment && <button className="danger" onClick={() => remove(payment.id)}><FiTrash2 /></button>}</td></tr>
      })}</tbody></table> : <div className="sheet-empty-content"><span><FiUsers /></span><h3>Start with your first customer</h3><p>Add customers from the Users page, then come back to record their payments for {monthNames[month - 1]} {year}.</p><Link className="primary" to="/users">Go to Users</Link></div>}
    </section>
    {editing && <PaymentModal data={editing} month={month} year={year} close={() => setEditing(null)} />}
  </div>
}

function PaymentModal({ data, month, year, close }) {
  const [amount, setAmount] = useState(data.payment?.amount || '')
  const [extraDue, setExtraDue] = useState(data.payment?.extraDue || '')
  const bill = Number(data.user.monthlyBill || 0)
  const save = async event => {
    event.preventDefault()
    const paid = Number(amount || 0), addedDue = Number(extraDue || 0)
    const due = Math.max(0, Number(data.openingDue || 0) + addedDue - paid)
    const base = { userId: data.user.id, userName: data.user.name, userCategory: data.user.category, monthlyBill: bill, month, year, amount: paid, extraDue: addedDue, due, status: paid > 0 ? 'paid' : 'pending' }
    try { if (data.payment) await updateDoc(doc(db, 'payments', data.payment.id), { ...base, updatedAt: serverTimestamp() }); else await addDoc(collection(db, 'payments'), { ...base, paymentDate: serverTimestamp() }); toast.success('Payment saved'); close() } catch (error) { toast.error(error.message) }
  }
  return <Modal title={`Payment · ${data.user.name}`} onClose={close}><form className="form" onSubmit={save}><p className="payment-note">Monthly bill: <b>{money(bill)}</b> · Opening due: <b>{money(data.openingDue)}</b></p><label>Paid amount<input type="number" min="0" step="any" autoFocus value={amount} onChange={e => setAmount(e.target.value)} /></label><label>Additional due (optional)<input type="number" min="0" step="any" value={extraDue} onChange={e => setExtraDue(e.target.value)} /></label><button className="primary">Save payment</button></form></Modal>
}
