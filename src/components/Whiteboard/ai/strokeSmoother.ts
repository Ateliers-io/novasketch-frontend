import { getStroke } from "perfect-freehand";

// 1. Generate the stroke outline points
export function getSmoothedStroke(rawPoints: {x: number, y: number, pressure?: number}[]) {
  // Convert your {x, y} objects to the [x, y, pressure] arrays perfect-freehand expects
  const formattedPoints = rawPoints.map(p => [p.x, p.y, p.pressure || 0.5]);
  
  return getStroke(formattedPoints, {
    size: 8,          // Base thickness
    thinning: 0.5,    // How much it thins when moving fast
    smoothing: 0.5,   // Streamline amount
    streamline: 0.5,  // How much to predict/smooth the input
  });
}

// 2. Convert the outline points to an SVG path string for Konva
export function getSvgPathFromStroke(strokePoints: number[][]) {
  if (!strokePoints.length) return "";

  const d = strokePoints.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...strokePoints[0], "Q"]
  );

  d.push("Z");
  return d.join(" ");
}