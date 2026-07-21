import dayjs from "dayjs";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

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

export default function RecentPayments({ recentPayments }) {
  const { t, formatMoney, toBengaliNumerals, language } = useLanguage();

  return (
    <section className="panel recent-payments-panel">
      <div className="panel-header">
        <div>
          <h3>{t("recent_payments")}</h3>
          <p>{t("latest_collections", "Latest successful collections")}</p>
        </div>

        <Link to="/history" className="text-button">
          {t("view_all", "View All")} →
        </Link>
      </div>

      <div className="payment-row payment-row-head">
        <div>{t("name")}</div>
        <div>{t("amount")}</div>
        <div>{t("date")}</div>
      </div>

      {recentPayments.length > 0 ? (
        recentPayments.map((payment, index) => {
          const paymentDate = getPaymentDate(payment.paymentDate);
          let dateStr = "--";
          if (paymentDate) {
            const formattedDate = dayjs(paymentDate).format("DD MMM");
            dateStr = language === "bn" ? toBengaliNumerals(formattedDate) : formattedDate;
          }

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
                <span className="payment-label">{t("name")}</span>
                <b>{payment.userName || payment.customerName || t("users")}</b>
              </div>

              <div className="payment-amount">
                <span className="payment-label">{t("amount")}</span>
                {formatMoney(payment.amount)}
              </div>

              <div className="payment-date">
                <span className="payment-label">{t("date")}</span>
                {dateStr}
              </div>
            </div>
          );
        })
      ) : (
        <p className="empty">{t("no_recent_payments")}</p>
      )}
    </section>
  );
}

