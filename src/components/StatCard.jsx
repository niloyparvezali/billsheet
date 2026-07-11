import { motion } from 'framer-motion'
export default function StatCard({ label, value, icon, tone='blue' }) { return <motion.article initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className={`stat ${tone}`}><div><p>{label}</p><h2>{value}</h2></div><span>{icon}</span></motion.article> }
