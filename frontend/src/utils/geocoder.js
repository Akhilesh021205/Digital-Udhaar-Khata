/**
 * Utility functions for automatic address geocoding and location resolution.
 * Uses OpenStreetMap Nominatim service with fallback handling.
 */

export const geocodeAddressText = async (addressQuery) => {
  if (!addressQuery || typeof addressQuery !== 'string' || addressQuery.trim().length < 3) {
    return null;
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressQuery.trim())}&addressdetails=1&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    );

    if (!res.ok) return null;
    const data = await res.json();

    if (Array.isArray(data) && data.length > 0) {
      const item = data[0];
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);

      if (!isNaN(lat) && !isNaN(lng)) {
        return {
          lat,
          lng,
          displayName: item.display_name,
          addressDetails: item.address ? {
            houseNumber: item.address.house_number || item.address.building || '',
            street: item.address.road || item.address.street || '',
            area: item.address.suburb || item.address.neighbourhood || item.address.residential || '',
            city: item.address.city || item.address.town || item.address.village || '',
            state: item.address.state || '',
            pincode: item.address.postcode || ''
          } : null
        };
      }
    }
    return null;
  } catch (err) {
    console.warn('Geocoding search failed:', err);
    return null;
  }
};

export const buildAddressQuery = (details) => {
  if (!details) return '';
  const { houseNumber, street, area, city, state, pincode, address } = details;
  const parts = [houseNumber, street, area, city, state, pincode]
    .filter(Boolean)
    .map(s => String(s).trim())
    .filter(s => s.length > 0);

  if (parts.length > 0) {
    return parts.join(', ');
  }
  return (address || '').trim();
};
