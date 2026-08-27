import React from 'react';

export const IndiaMapHero: React.FC = () => {
  // Floating markers data - Srinagar J&K brought further inward (away from Nepal/China border)
  const markers = [
    { name: 'Northern Region', top: '25%', left: '38%', delay: '0s' },
    { name: 'Western Region', top: '49%', left: '21%', delay: '1s' },
    { name: 'Southern Region', top: '73%', left: '35%', delay: '2s' },
  ];

  return (
    <div className="relative w-full max-w-[470px] lg:max-w-[510px] mx-auto select-none font-sans py-2">
      
      {/* Flat Map with Contour Elevation Drop Shadow */}
      <div className="relative w-full">
        {/* SVG base map with professional dual drop shadow to create visual depth */}
        <img
          src="/india-map.svg"
          className="w-full h-auto object-contain pointer-events-none filter drop-shadow-[0_12px_16px_rgba(15,27,41,0.22)] drop-shadow-[0_4px_6px_rgba(15,27,41,0.12)]"
          alt="India Border Map"
        />

        {/* Floating location markers relative to map container */}
        {markers.map((marker, idx) => (
          <div
            key={idx}
            style={{
              position: 'absolute',
              top: marker.top,
              left: marker.left,
              animationDelay: marker.delay,
            }}
            className="animate-float flex flex-col items-center group cursor-pointer pointer-events-auto"
          >
            {/* Soft pink/purple glow halo behind pin matching the Figma reference */}
            <div className="absolute -top-1 w-8 h-8 rounded-full bg-pink-500/10 border border-pink-400/20 blur-sm pointer-events-none animate-pulse" />

            {/* Figma-faithful teardrop pin pointer with dark navy fill, white border, and white inner circle */}
            <svg viewBox="0 0 32 38" className="w-7 h-9 drop-shadow-md z-10 transition-transform duration-300 group-hover:scale-110">
              <path
                d="M16 0C7.16 0 0 7.16 0 16c0 11.25 14.25 21.37 14.87 21.8a1.69 1.69 0 0 0 2.26 0C17.75 37.37 32 27.25 32 16 32 7.16 24.84 0 16 0z"
                fill="#0F1B29"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
              <circle cx="16" cy="16" r="4.5" fill="none" stroke="#FFFFFF" strokeWidth="2" />
            </svg>

            {/* Micro tooltip */}
            <div className="absolute top-9 whitespace-nowrap bg-[#0F1B29] text-white text-[9px] font-bold px-2 py-1 rounded-md shadow opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none transform translate-y-1 group-hover:translate-y-0 z-20">
              {marker.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IndiaMapHero;
