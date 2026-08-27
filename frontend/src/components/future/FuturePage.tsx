import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Calendar, Layers, Activity, AlertCircle, Bot } from 'lucide-react';

interface FuturePageProps {
  currentLanguage: string;
}

export const FuturePage: React.FC<FuturePageProps> = ({ currentLanguage }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  const monthsList = [
    { code: 'SEP', year: 2026, label: 'SEP 2026' },
    { code: 'OCT', year: 2026, label: 'OCT 2026' },
    { code: 'NOV', year: 2026, label: 'NOV 2026' },
    { code: 'DEC', year: 2026, label: 'DEC 2026' },
    { code: 'JAN', year: 2027, label: 'JAN 2027' },
    { code: 'FEB', year: 2027, label: 'FEB 2027' },
    { code: 'MAR', year: 2027, label: 'MAR 2027' },
    { code: 'APR', year: 2027, label: 'APR 2027' },
    { code: 'MAY', year: 2027, label: 'MAY 2027' },
    { code: 'JUN', year: 2027, label: 'JUN 2027' },
    { code: 'JUL', year: 2027, label: 'JUL 2027' },
    { code: 'AUG', year: 2027, label: 'AUG 2027' },
  ];

  const [selectedMonth, setSelectedMonth] = useState(monthsList[9]); // Default to JUN 2027 for demo highlight
  const mlApiUrl = import.meta.env.VITE_ML_API_BASE_URL || '';

  // Initialize Satellite Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Centered around Central India
    const map = L.map(mapContainerRef.current, {
      center: [20.5937, 78.9629],
      zoom: 5,
      zoomControl: true,
    });
    mapRef.current = map;

    // Load Esri Satellite imagery tiles
    const satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution:
          'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      }
    );
    satelliteLayer.addTo(map);

    // Apply custom state styling bounds if necessary, or just a simple polygon overlay
    // Clean up map on unmount
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Abstract function to simulate future forecast retrieval
  const handleRetrieveForecast = async (monthCode: string, year: number) => {
    if (!mlApiUrl) {
      console.log(`VITE_ML_API_BASE_URL is not configured. Simulating forecast for ${monthCode} ${year}.`);
      return;
    }
    try {
      const response = await fetch(`${mlApiUrl}/api/forecast?month=${monthCode}&year=${year}`);
      const data = await response.json();
      console.log('Retrieved ML forecast:', data);
    } catch (e) {
      console.warn('ML forecast fetch failed (ML API offline):', (e as Error).message);
    }
  };

  const handleSelectMonth = (month: typeof monthsList[0]) => {
    setSelectedMonth(month);
    handleRetrieveForecast(month.code, month.year);
  };

  return (
    <div className="w-full h-full bg-[#ECF8F8] text-[#0F1B29] flex flex-col md:flex-row font-sans select-none overflow-hidden">

      {/* Left Sidebar - Timeline controls (Mobile: flex-row layout, Desktop: flex-col layout) */}
      <div className="w-full md:w-80 bg-white border-b md:border-b-0 md:border-r border-[#DDDDDD] flex flex-col p-4 md:p-6 md:overflow-hidden shrink-0 h-auto md:h-full">

        <div className="flex flex-col flex-1 gap-4 md:gap-8 min-h-0 h-full">
          <div>
            <h2 className="text-[#0F1B29] font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#747F8D]" />
              <span>Forecast Timeline</span>
            </h2>
            <p className="text-[10px] text-[#747F8D] mt-0.5">
              Select a forecast month to simulate predictive models.
            </p>
          </div>

          {/* Timeline container: Horizontal pills on mobile, Vertical line progression stretching to cover the sidebar on desktop */}
          <div className="relative border-l-0 ml-0 md:ml-2 flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible space-x-2 md:space-x-0 md:space-y-0 md:flex-1 md:justify-between py-1 md:py-6 md:pl-8 scrollbar-none min-h-0">
            
            {/* Absolute connecting vertical line behind nodes, bounded between top and bottom node centers */}
            <div className="hidden md:block absolute left-[15px] top-[34px] bottom-[34px] w-[2px] bg-[#DDDDDD]/60 z-0" />

            {monthsList.map((month) => {
              const isSelected = selectedMonth.code === month.code && selectedMonth.year === month.year;
              return (
                <button
                  key={month.label}
                  type="button"
                  onClick={() => handleSelectMonth(month)}
                  className={`relative shrink-0 flex items-center justify-center md:justify-between text-center md:text-left px-3 py-1.5 md:px-0 md:py-0 md:w-full rounded-full md:rounded-none transition-all duration-200 outline-none cursor-pointer text-xs font-bold tracking-wide z-10 ${
                    isSelected 
                      ? 'bg-[#0F1B29] text-white md:bg-transparent md:text-[#0F1B29]' 
                      : 'bg-white text-[#747F8D] border border-[#DDDDDD] md:bg-transparent md:border-0 hover:text-[#0F1B29]'
                  }`}
                >
                  {/* Desktop timeline circle node (vertically centered on button text) */}
                  <div className="hidden md:flex absolute -left-[25px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-[#DDDDDD] bg-white items-center justify-center z-10">
                    <div
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        isSelected ? 'bg-[#0F1B29] scale-110 shadow-[0_0_8px_rgba(15,27,41,0.4)]' : 'bg-transparent'
                      }`}
                    />
                  </div>

                  {/* Month Label */}
                  <span className="md:ml-3">
                    {month.label}
                  </span>

                  {/* Desktop shaded background highlight for selected */}
                  {isSelected && (
                    <div className="hidden md:block absolute left-0 right-0 h-7 bg-[#ECF8F8]/60 border-r-2 border-[#0F1B29] z-[-1] pointer-events-none rounded-l-md" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* Right Side - Interactive Satellite Leaflet Map */}
      <div className="flex-1 relative bg-[#ECF8F8] flex flex-col">
        {/* Leaflet Map container */}
        <div ref={mapContainerRef} className="w-full h-full z-10" />

      </div>

    </div>
  );
};
export default FuturePage;
