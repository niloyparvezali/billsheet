import { useMemo, useState } from 'react'
import { collection } from 'firebase/firestore'
import { FiDownload, FiPrinter, FiSearch } from 'react-icons/fi'
import { db } from '../firebase/config'
import useCollection from '../hooks/useCollection'
import { exportExcel, exportPdf } from '../utils/exports'
import { money } from '../utils/date'

export default function Reports() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [search, setSearch] = useState('')
  const { data: payments } = useCollection(db ? collection(db, 'payments') : null)
  const yearlyRows = useMemo(() => {
    const totals = new Map()
    payments.filter(payment => +payment.year === +year).forEach(payment => {
      const id = payment.userId || payment.userName
      const current = totals.get(id) || { Name: payment.userName || 'Customer', 'Total Paid': 0 }
      current['Total Paid'] += Number(payment.amount || 0)
      totals.set(id, current)
    })
    return [...totals.values()].filter(row => row.Name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.Name.localeCompare(b.Name))
  }, [payments, year, search])
  const total = yearlyRows.reduce((sum, row) => sum + row['Total Paid'], 0)
  const paymentCount = payments.filter(payment => +payment.year === +year && Number(payment.amount) > 0).length
  return <div className="page"><div className="page-title"><div><h2>Reports</h2><p>Yearly payment totals from January to December.</p></div><div className="button-row"><button className="secondary" onClick={() => exportPdf(yearlyRows, `yearly-report-${year}`)}><FiDownload /> PDF</button><button className="secondary" onClick={() => exportExcel(yearlyRows, `yearly-report-${year}`)}><FiDownload /> Excel</button><button className="secondary" onClick={() => print()}><FiPrinter /> Print</button></div></div><div className="toolbar filters"><input type="number" min="2024" value={year} onChange={e => setYear(+e.target.value)} /><label className="search"><FiSearch /><input placeholder="Search customer" value={search} onChange={e => setSearch(e.target.value)} /></label></div><div className="stats compact"><div className="stat blue"><div><p>Total collection</p><h2>{money(total)}</h2></div></div><div className="stat green"><div><p>Customers paid</p><h2>{yearlyRows.filter(row => row['Total Paid'] > 0).length}</h2></div></div><div className="stat orange"><div><p>Payments recorded</p><h2>{paymentCount}</h2></div></div></div><section className="panel table-wrap"><table><thead><tr><th>Name</th><th>Total paid ({year})</th></tr></thead><tbody>{yearlyRows.map((row, i) => <tr key={`${row.Name}-${i}`}><td><b>{row.Name}</b></td><td>{money(row['Total Paid'])}</td></tr>)}</tbody></table>{!yearlyRows.length && <p className="empty">No payment records found for {year}.</p>}</section></div>
}
