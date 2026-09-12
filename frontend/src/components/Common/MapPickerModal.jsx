import { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import { HiOutlineLocationMarker, HiOutlineSearch, HiOutlineCheck, HiOutlineExternalLink } from 'react-icons/hi';
import { toast } from 'react-toastify';
import 'leaflet/dist/leaflet.css';

const GoogleGIcon = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);

const MapPickerModal = ({ isOpen, onClose, onSelectLocation, initialAddress = '' }) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const tileLayerRef = useRef(null);

  const [selectedAddr, setSelectedAddr] = useState(initialAddress);
  const [coords, setCoords] = useState({ lat: 17.3850, lng: 78.4867 });
  const [searchQuery, setSearchQuery] = useState(initialAddress);
  const [mapType, setMapType] = useState('roadmap'); // 'roadmap' or 'satellite'
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  // Reverse geocode lat/lng into human readable address
  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      if (!res.ok) throw new Error('Failed to fetch address');
      const data = await res.json();
      if (data && data.display_name) {
        setSelectedAddr(data.display_name);
        setSearchQuery(data.display_name);
      } else {
        const fallback = `Location Pin (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
        setSelectedAddr(fallback);
      }
    } catch (err) {
      const fallback = `Location Pin (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
      setSelectedAddr(fallback);
    }
  };

  // Initialize interactive map with Google Maps tiles
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    const initMap = async () => {
      let L;
      try {
        const leafletModule = await import('leaflet');
        L = leafletModule.default || leafletModule;
      } catch (err) {
        if (window.L) L = window.L;
        else return;
      }

      if (!isMounted || !mapContainerRef.current) return;

      // Fix default Leaflet icon paths
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      let startLat = coords.lat;
      let startLng = coords.lng;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Initialize high-performance Leaflet instance with direct scroll wheel zoom & touch zoom
      const map = L.map(mapContainerRef.current, {
        center: [startLat, startLng],
        zoom: 16,
        zoomControl: true,
        scrollWheelZoom: true,
        touchZoom: true,
        dragging: true,
        tap: true,
        preferCanvas: true,
        keepBuffer: 6
      });

      // Parallel Google Maps Subdomains (mt0, mt1, mt2, mt3)
      const lyrsCode = mapType === 'satellite' ? 's,h' : 'm';
      const googleTileUrl = `https://{s}.google.com/vt/lyrs=${lyrsCode}&x={x}&y={y}&z={z}`;

      const tileLayer = L.tileLayer(googleTileUrl, {
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps',
        maxZoom: 20,
      }).addTo(map);

      tileLayerRef.current = tileLayer;

      // Draggable Red Marker Pin
      const marker = L.marker([startLat, startLng], { draggable: true }).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setCoords({ lat: pos.lat, lng: pos.lng });
        reverseGeocode(pos.lat, pos.lng);
      });

      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        setCoords({ lat, lng });
        reverseGeocode(lat, lng);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;

      // Auto locate GPS position if no initial address
      if (!initialAddress && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
          if (!isMounted) return;
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCoords({ lat, lng });
          map.setView([lat, lng], 17);
          marker.setLatLng([lat, lng]);
          reverseGeocode(lat, lng);
        }, () => {}, { enableHighAccuracy: true });
      }

      // Multiple size recalculation steps to guarantee tiles load immediately when modal opens
      const invalidate = () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      };

      invalidate();
      setTimeout(invalidate, 100);
      setTimeout(invalidate, 300);
      setTimeout(invalidate, 600);
    };

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen]);

  // Toggle Map Type (Roadmap vs Satellite)
  const toggleMapType = async (newType) => {
    setMapType(newType);
    if (!mapInstanceRef.current) return;
    let L;
    try {
      const leafletModule = await import('leaflet');
      L = leafletModule.default || leafletModule;
    } catch (err) {
      if (window.L) L = window.L;
      else return;
    }

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }
    const lyrsCode = newType === 'satellite' ? 's,h' : 'm';
    const googleTileUrl = `https://{s}.google.com/vt/lyrs=${lyrsCode}&x={x}&y={y}&z={z}`;

    const newTileLayer = L.tileLayer(googleTileUrl, {
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google Maps',
      maxZoom: 20,
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newTileLayer;
  };

  // Search location on Google Maps
  const handleSearchLocation = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.trim())}&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const targetLat = parseFloat(data[0].lat);
        const targetLng = parseFloat(data[0].lon);
        setCoords({ lat: targetLat, lng: targetLng });
        setSelectedAddr(data[0].display_name);

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([targetLat, targetLng], 17);
          markerRef.current.setLatLng([targetLat, targetLng]);
        }
        toast.success(`Google Maps centered to: ${data[0].display_name.split(',')[0]}`);
      } else {
        toast.warning('Location not found. Try searching city or landmark.');
      }
    } catch (err) {
      toast.error('Search failed.');
    } finally {
      setSearching(false);
    }
  };

  // Jump to Live GPS Location on Google Maps
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([lat, lng], 17);
          markerRef.current.setLatLng([lat, lng]);
        }
        reverseGeocode(lat, lng);
        setLocating(false);
        toast.success('Google Maps centered to your live GPS position!');
      },
      (err) => {
        setLocating(false);
        toast.error('Location permission denied.');
      },
      { enableHighAccuracy: true }
    );
  };

  const handleConfirm = () => {
    if (!selectedAddr || !selectedAddr.trim()) {
      toast.warning('Please select a location on Google Maps.');
      return;
    }
    onSelectLocation(selectedAddr.trim());
    onClose();
    toast.success('Google Maps location saved!');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Google Maps — Select Location"
      maxWidth="sm:max-w-3xl lg:max-w-4xl"
      contentClassName="p-3 sm:p-4 overflow-hidden"
    >
      <div className="space-y-3">
        {/* Top Control Bar & Immediate Confirm Button (NO SCROLL REQUIRED!) */}
        <form onSubmit={handleSearchLocation} className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <HiOutlineSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-gray" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Google Maps for shop, area, landmark..."
              className="w-full pl-9 pr-3 py-2 bg-soft-white dark:bg-slate-800 border border-soft-gray dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-orange text-deep-navy dark:text-white font-medium"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="px-3.5 py-2 bg-orange hover:bg-orange-hover text-white text-xs font-bold rounded-xl transition-colors border-none cursor-pointer shrink-0 disabled:opacity-50 flex items-center gap-1 shadow-xs"
          >
            <HiOutlineSearch size={14} />
            <span>{searching ? 'Searching...' : 'Search'}</span>
          </button>
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={locating}
            className="px-3 py-2 bg-pure-white dark:bg-slate-800 border border-soft-gray dark:border-slate-700 text-deep-navy dark:text-white hover:text-orange font-bold text-xs rounded-xl transition-colors cursor-pointer shrink-0 flex items-center gap-1 shadow-2xs"
            title="Locate me on Google Maps"
          >
            <HiOutlineLocationMarker size={15} className="text-orange" />
            <span className="hidden sm:inline">{locating ? 'Locating...' : 'GPS'}</span>
          </button>

          {/* Map / Satellite View Toggle */}
          <div className="flex border border-soft-gray dark:border-slate-700 rounded-xl overflow-hidden p-0.5 bg-soft-white dark:bg-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => toggleMapType('roadmap')}
              className={`px-2.5 py-1.5 text-xs font-bold border-none cursor-pointer transition-colors rounded-lg ${
                mapType === 'roadmap' ? 'bg-orange text-white shadow-xs' : 'bg-transparent text-slate-gray hover:text-deep-navy dark:hover:text-white'
              }`}
            >
              Map
            </button>
            <button
              type="button"
              onClick={() => toggleMapType('satellite')}
              className={`px-2.5 py-1.5 text-xs font-bold border-none cursor-pointer transition-colors rounded-lg ${
                mapType === 'satellite' ? 'bg-orange text-white shadow-xs' : 'bg-transparent text-slate-gray hover:text-deep-navy dark:hover:text-white'
              }`}
            >
              Satellite
            </button>
          </div>
        </form>

        {/* High-Performance Google Maps Tile View Canvas */}
        <div className="relative w-full rounded-2xl overflow-hidden border border-soft-gray dark:border-slate-700 shadow-md bg-slate-100 dark:bg-slate-900">
          <div
            ref={mapContainerRef}
            style={{ position: 'relative', width: '100%', minHeight: '300px' }}
            className="w-full h-[300px] sm:h-[340px] block z-10 relative overflow-hidden"
          />

          <div className="absolute top-3 right-3 z-20 bg-pure-white/95 dark:bg-slate-900/95 text-deep-navy dark:text-white text-[11px] font-bold px-3 py-1.5 rounded-xl border border-soft-gray/60 shadow-md backdrop-blur-xs flex items-center gap-1.5 pointer-events-none">
            <GoogleGIcon /> Google Maps Live Tiles
          </div>
        </div>

        {/* Selected Location Address Output */}
        <div className="p-3 bg-soft-white dark:bg-slate-800/90 border border-soft-gray/80 dark:border-slate-700 rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-gray dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <GoogleGIcon /> Selected Location Address
            </span>
            <span className="text-[10px] text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-950/40 px-2 py-0.5 rounded-full border border-green-200/50">
              Verified Pin Location
            </span>
          </div>
          <input
            type="text"
            value={selectedAddr}
            onChange={(e) => setSelectedAddr(e.target.value)}
            placeholder="Selected Google Maps Address..."
            className="w-full px-3 py-2 bg-pure-white dark:bg-slate-900 border border-soft-gray dark:border-slate-700 rounded-lg text-xs font-bold text-deep-navy dark:text-white focus:outline-none focus:border-orange shadow-inner"
          />
        </div>

        {/* Bottom Action Footer */}
        <div className="flex justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-transparent border border-soft-gray dark:border-slate-700 text-slate-gray dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold border-none cursor-pointer transition-colors shadow-md flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98]"
          >
            <HiOutlineCheck size={16} /> Confirm & Save Location
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default MapPickerModal;
