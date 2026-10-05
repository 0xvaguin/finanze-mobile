import React, { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from './ThemeProvider';

export interface ChartPoint { x: number; y: number }
export interface ChartSeries { points: ChartPoint[]; color: string; step?: boolean; dashed?: boolean }

const PAD = 8;

/** Numero do dia (UTC, so como calculadora de escala) de uma data YYYY-MM-DD. */
export function dayNumber(date: string): number {
  return Math.floor(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / 86_400_000);
}

export function LineChart({ series, height = 140, label }: { series: ChartSeries[]; height?: number; label: string }) {
  const { p } = useTheme();
  const [w, setW] = useState(0);
  const all = series.flatMap((s) => s.points);
  const onLayout = (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width));
  if (all.length === 0) return null;

  const xs = all.map((pt) => pt.x);
  const ys = all.map((pt) => pt.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  let minY = Math.min(...ys), maxY = Math.max(...ys);
  if (maxY === minY) { maxY += 1; minY = Math.max(0, minY - 1); }
  const margin = (maxY - minY) * 0.08;
  minY = Math.max(0, minY - margin);
  maxY += margin;

  const inner = Math.max(0, w - PAD * 2);
  const sx = (x: number) => PAD + (maxX === minX ? inner / 2 : ((x - minX) / (maxX - minX)) * inner);
  const sy = (y: number) => height - PAD - ((y - minY) / (maxY - minY)) * (height - PAD * 2);

  const pathFor = (s: ChartSeries) => {
    const pts = [...s.points].sort((a, b) => a.x - b.x);
    let d = '';
    pts.forEach((pt, i) => {
      const x = sx(pt.x), y = sy(pt.y);
      if (i === 0) d += `M${x.toFixed(1)} ${y.toFixed(1)}`;
      else if (s.step) {
        const prev = pts[i - 1] as ChartPoint;
        d += ` L${x.toFixed(1)} ${sy(prev.y).toFixed(1)} L${x.toFixed(1)} ${y.toFixed(1)}`;
      } else d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    return d;
  };

  return (
    <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={label} style={{ height }}>
      {w > 0 && (
        <Svg width={w} height={height}>
          <Path d={`M${PAD} ${height - PAD} L${w - PAD} ${height - PAD}`} stroke={p.border} strokeWidth={1} />
          {series.map((s, i) =>
            s.points.length === 1 ? (
              <Circle key={i} cx={sx((s.points[0] as ChartPoint).x)} cy={sy((s.points[0] as ChartPoint).y)} r={4} fill={s.color} />
            ) : (
              <Path key={i} d={pathFor(s)} stroke={s.color} strokeWidth={2.5} fill="none" strokeDasharray={s.dashed ? '6 6' : undefined} strokeLinejoin="round" />
            ),
          )}
        </Svg>
      )}
    </View>
  );
}
