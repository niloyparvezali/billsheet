import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase/config";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
} from "recharts";
export default function MonthlyCollectionChart({
  currentChart,
  chartPage,
  setChartPage,
  user,
  highestMonth,
  lowestMonth,
  totalCollection,
  averageCollection,
  year,
  money,
}) {
  return (
    <section className="panel monthly-panel">
      <div className="panel-header">
        <div>
          <h3>📊 Monthly Collection</h3>
          <p>{year} Collection Overview</p>
        </div>

        <div className="chart-nav">
          <button
            className={chartPage === 0 ? "active" : ""}
            onClick={async () => {
              setChartPage(0);

              if (user) {
                await setDoc(
                  doc(db, "settings", user.uid),
                  { dashboardChartPage: 0 },
                  { merge: true },
                );
              }
            }}
          >
            Jan – Jun
          </button>

          <button
            className={chartPage === 1 ? "active" : ""}
            onClick={async () => {
              setChartPage(1);

              if (user) {
                await setDoc(
                  doc(db, "settings", user.uid),
                  { dashboardChartPage: 1 },
                  { merge: true },
                );
              }
            }}
          >
            Jul – Dec
          </button>
        </div>
      </div>

      <div className="chart">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={currentChart}
            margin={{
              top: 35,
              right: 10,
              left: -15,
              bottom: 15,
            }}
            barCategoryGap="25%"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              opacity={0.15}
            />

            <XAxis
              dataKey="name"
              interval={0}
              tick={{
                fontSize: 13,
                fontWeight: 600,
              }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              width={55}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `৳${v}`}
            />

            <Tooltip formatter={(v) => money(v)} />

            <Bar dataKey="collection" maxBarSize={55} radius={[12, 12, 0, 0]}>
              <LabelList
                dataKey="collection"
                position="top"
                formatter={(v) => (v ? money(v) : "")}
              />

              {currentChart.map((item, index) => (
                <Cell
                  key={index}
                  fill={
                    item.collection === highestMonth.collection
                      ? "#4F46E5"
                      : "#7C83FF"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
