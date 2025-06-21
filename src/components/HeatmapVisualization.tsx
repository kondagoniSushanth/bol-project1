import React from 'react';

interface HeatmapVisualizationProps {
  pressureValues: number[];
  soleType: 'left' | 'right';
  isRecording: boolean;
}

const HeatmapVisualization: React.FC<HeatmapVisualizationProps> = ({
  pressureValues,
  soleType,
  isRecording
}) => {
  const getPressureColor = (value: number): string => {
    if (value === 0) return '#374151'; // Gray for no pressure
    if (value <= 50) return '#00BCD4';   // Cool blue
    if (value <= 100) return '#4CAF50';  // Green
    if (value <= 150) return '#FFEB3B';  // Yellow
    if (value <= 200) return '#FF9800';  // Orange
    return '#F44336';                    // Hot red
  };

  const getPressureSize = (value: number): number => {
    const minSize = 20;
    const maxSize = 40;
    const normalizedValue = Math.min(value / 250, 1); // Normalize to 0-1
    return minSize + (normalizedValue * (maxSize - minSize));
  };

  // Pressure point coordinates for left sole (mirrored for right)
const leftSolePoints = [
  { x: 27.6, y: 26.7 },  // P1
  { x: 48.6, y: 26.7 },  // P2
  { x: 30.5, y: 45.5 },  // P3
  { x: 58.0, y: 37.1 },  // P4
  { x: 30.1, y: 59.8 },  // P5
  { x: 55.0, y: 49.6 },  // P6
  { x: 35.3, y: 75.3 },  // P7
  { x: 51.0, y: 62.0 }   // P8
];

// Mirror X-coordinates across vertical center for right sole (768px width)
const rightSolePoints = [
  { x: 27.6, y: 26.7 },  // P1
  { x: 48.6, y: 26.7 },  // P2
  { x: 30.5, y: 45.5 },  // P3
  { x: 58.0, y: 37.1 },  // P4
  { x: 30.1, y: 59.8 },  // P5
  { x: 55.0, y: 49.6 },  // P6
  { x: 35.3, y: 75.3 },  // P7
  { x: 51.0, y: 62.0 }   // P8
];

  const points = soleType === 'left' ? leftSolePoints : rightSolePoints;

  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* Foot sole image */}
      <div className="relative">
        <img 
          src={`/${soleType}_sole.png`}
          alt={`${soleType} sole`}
          className="w-full h-auto opacity-90"
        />
        
        {/* Pressure points overlay */}
        <div className="absolute inset-0">
          {points.map((point, index) => (
            <div
              key={index}
              className={`absolute rounded-full border-2 border-white shadow-lg transition-all duration-300 ${
                isRecording ? 'animate-pulse' : ''
              }`}
              style={{
                left: `${point.x}%`,
                top: `${point.y}%`,
                width: `${getPressureSize(pressureValues[index] || 0)}px`,
                height: `${getPressureSize(pressureValues[index] || 0)}px`,
                backgroundColor: getPressureColor(pressureValues[index] || 0),
                transform: 'translate(-50%, -50%)',
                opacity: pressureValues[index] > 0 ? 0.8 : 0.3
              }}
            >
              {/* Pressure value label */}
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-bold text-white bg-black bg-opacity-50 px-1 rounded">
                {pressureValues[index] || 0}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Color legend */}
      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm font-medium">Pressure (kPa)</div>
        <div className="flex items-center space-x-1">
          <div className="text-xs">0</div>
          <div className="flex flex-col space-y-1">
            <div className="w-4 h-2 bg-gradient-to-r from-[#00BCD4] via-[#4CAF50] via-[#FFEB3B] via-[#FF9800] to-[#F44336]"></div>
          </div>
          <div className="text-xs">225+</div>
        </div>
      </div>

      {/* Recording indicator */}
      {isRecording && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center space-x-2 bg-red-900 text-red-100 px-3 py-1 rounded-full text-sm">
            <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
            <span>Recording in progress... please stand still</span>
          </div>
        </div>
      )}

      {/* Pressure point labels */}
      <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
        {pressureValues.map((value, index) => (
          <div key={index} className="text-center">
            <div className="font-medium">P{index + 1}</div>
            <div className="text-gray-400">{value || 0} kPa</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HeatmapVisualization;