import dayjs from "dayjs";
import { Link } from "react-router-dom";

const getPaymentDate = (value) => {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value.seconds === "number") {
    return new Date(value.seconds * 1000);
  }

  if (typeof value === "string" || typeof value === "number") {
    return new Date(value);
  }

  return null;
};

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
        recentPayments.map((payment, index) => {
          const paymentDate = getPaymentDate(payment.paymentDate);

          return (
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
                {paymentDate ? dayjs(paymentDate).format("DD MMM") : "--"}
              </div>
            </div>
          );
        })
      ) : (
        <p className="empty">No payments recorded yet.</p>
      )}
    </section>
  );
}
