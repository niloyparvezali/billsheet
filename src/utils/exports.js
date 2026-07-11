import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
export function exportExcel(rows, name) { const sheet = XLSX.utils.json_to_sheet(rows); const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Report'); XLSX.writeFile(book, `${name}.xlsx`) }
export function exportPdf(rows, name) { const pdf = new jsPDF(); const keys = Object.keys(rows[0] || {}); pdf.text(name, 14, 14); autoTable(pdf, { head: [keys], body: rows.map(r => keys.map(k => r[k])) , startY: 20 }); pdf.save(`${name}.pdf`) }
