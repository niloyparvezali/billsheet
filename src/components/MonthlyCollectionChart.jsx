import { useEffect, useMemo, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { readThemeColors } from "../utils/theme";

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
  const [themeColors, setThemeColors] = useState(readThemeColors);

  useEffect(() => {
    const syncTheme = () => setThemeColors(readThemeColors());
    syncTheme();
    window.addEventListener("themechange", syncTheme);
    return () => window.removeEventListener("themechange", syncTheme);
  }, []);

  const chartStyle = useMemo(
    () => ({
      axis: themeColors.axis,
      grid: themeColors.grid,
      label: themeColors.label,
      tooltipBg: themeColors.tooltipBg,
      tooltipText: themeColors.tooltipText,
      active: themeColors.active,
      default: themeColors.default,
    }),
    [themeColors],
  );

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
              stroke={chartStyle.grid}
              opacity={1}
            />

            <XAxis
              dataKey="name"
              interval={0}
              tick={{
                fontSize: 13,
                fontWeight: 600,
                fill: chartStyle.axis,
              }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              width={55}
              tick={{ fontSize: 11, fill: chartStyle.axis }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `৳${v}`}
            />

            <Tooltip
              formatter={(v) => money(v)}
              contentStyle={{
                background: chartStyle.tooltipBg,
                border: `1px solid ${chartStyle.grid}`,
                color: chartStyle.tooltipText,
                borderRadius: 12,
              }}
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
            />

            <Bar dataKey="collection" maxBarSize={55} radius={[12, 12, 0, 0]}>
              <LabelList
                dataKey="collection"
                position="top"
                formatter={(v) => (v ? money(v) : "")}
                fill={chartStyle.label}
                style={{ fontSize: 11, fontWeight: 600 }}
              />

              {currentChart.map((item, index) => (
                <Cell
                  key={index}
                  fill={
                    item.collection === highestMonth.collection
                      ? chartStyle.active
                      : chartStyle.default
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
