import React, { useEffect, useRef } from 'react';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartConfiguration,
} from 'chart.js';

Chart.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  DoughnutController,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler
);

interface ChartCanvasProps {
  config: ChartConfiguration;
  heightClass?: string;
  ariaLabel: string;
}

export const ChartCanvas: React.FC<ChartCanvasProps> = ({
  config,
  heightClass = 'h-72',
  ariaLabel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  const chartTypeRef = useRef<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const enhancedConfig: ChartConfiguration = {
      ...config,
      options: {
        ...config.options,
        animation: prefersReduced
          ? false
          : {
              duration: 680,
              easing: 'easeOutQuart',
              ...(typeof config.options?.animation === 'object' ? config.options.animation : {}),
            },
        transitions: prefersReduced
          ? undefined
          : {
              active: {
                animation: {
                  duration: 220,
                },
              },
            },
      },
    };

    if (chartInstanceRef.current && chartTypeRef.current === config.type) {
      chartInstanceRef.current.data = enhancedConfig.data;
      if (enhancedConfig.options) {
        chartInstanceRef.current.options = enhancedConfig.options;
      }
      chartInstanceRef.current.update();
      return;
    }

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    chartTypeRef.current = config.type;
    chartInstanceRef.current = new Chart(canvas, enhancedConfig);
  }, [config]);

  useEffect(() => {
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
        chartTypeRef.current = null;
      }
    };
  }, []);

  return (
    <div className={`relative w-full ${heightClass}`}>
      <canvas ref={canvasRef} aria-label={ariaLabel} role="img" />
    </div>
  );
};
