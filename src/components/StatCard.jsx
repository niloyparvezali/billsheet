import { motion } from "framer-motion";
import { useLanguage } from "../context/LanguageContext";

export default function StatCard({ label, value, icon, tone = "blue" }) {
  const { formatNumber } = useLanguage();

  const displayValue = typeof value === "number" ? formatNumber(value) : value;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`stat ${tone}`}
    >
      <div>
        <p>{label}</p>
        <h2>{displayValue}</h2>
      </div>
      <span>{icon}</span>
    </motion.article>
  );
}

