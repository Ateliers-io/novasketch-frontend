import { Stage, Layer, Line } from 'react-konva';
import { useRef, useState, useEffect } from 'react';
import './Whiteboard.css';

const GRID_SIZE = 40;
const GRID_COLOR = '#e0e0e0';

interface GridProps {
  width: number;
  height: number;
}

function Grid({ width, height }: GridProps) {
  const lines = [];

  // Vertical lines
  for (let x = 0; x <= width; x += GRID_SIZE) {
    lines.push(
      <Line
        key={`v-${x}`}
        points={[x, 0, x, height]}
        stroke={GRID_COLOR}
        strokeWidth={1}
      />
    );
  }

  // Horizontal lines
  for (let y = 0; y <= height; y += GRID_SIZE) {
    lines.push(
      <Line
        key={`h-${y}`}
        points={[0, y, width, y]}
        stroke={GRID_COLOR}
        strokeWidth={1}
      />
    );
  }

  return <>{lines}</>;
}

export default function Whiteboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    function handleResize() {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    }

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="whiteboard-container" ref={containerRef}>
      <Stage width={dimensions.width} height={dimensions.height}>
        <Layer>
          <Grid width={dimensions.width} height={dimensions.height} />
        </Layer>
      </Stage>
    </div>
  );
}
