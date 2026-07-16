import dayjs from "dayjs";
import { Link } from "react-router-dom";

export default function RecentPayments({ recentPayments, money }) {
  return (
    <section className="panel recent-payments-panel">
      <div className="panel-header">
        <div>
          <h3>Recent Payments</h3>
          <p>Latest successful collections</p>
        </div>

        <Link to="/history" className="text-button">
          View All →
        </Link>
      </div>

      <div className="payment-row payment-row-head">
        <div>Customer</div>
        <div>Amount</div>
        <div>Date</div>
      </div>

      {recentPayments.length > 0 ? (
        recentPayments.map((payment, index) => (
          <div
            key={
              payment.id ||
              payment.userId ||
              payment.paymentDate?.seconds ||
              index
            }
            className="payment-row payment-row-item"
          >
            <div className="payment-name">
              <span className="payment-label">Customer</span>
              <b>{payment.userName || payment.customerName || "Customer"}</b>
            </div>
            <div className="payment-amount">
              <span className="payment-label">Amount</span>
              {money(payment.amount)}
            </div>
            <div className="payment-date">
              <span className="payment-label">Date</span>
              {dayjs(payment.paymentDate?.toDate()).format("DD MMM")}
            </div>
          </div>
        ))
      ) : (
        <p className="empty">No payments recorded yet.</p>
      )}
    </section>
  );
}
