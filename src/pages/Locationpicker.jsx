import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import styles from './Locationpicker.module.css'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || ''

mapboxgl.accessToken = TOKEN
async function reverseGeocode(lng, lat) {
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
    `?types=address,place,postcode,country&language=en&access_token=${TOKEN}`

  const res  = await fetch(url)
  const data = await res.json()

  if (!data.features?.length) return null
  const feature = data.features[0]
  const ctx     = feature.context || []

  const get = (type) => ctx.find((c) => c.id.startsWith(type))?.text || ''
  const street   = feature.place_type.includes('address')
    ? `${feature.address || ''} ${feature.text || ''}`.trim()
    : feature.place_name?.split(',')[0] || ''

  return {
    address:     street,
    city:        get('place') || get('locality') || get('district'),
    postal_code: get('postcode'),
    country:     get('country'),
    lat,
    lng,
  }
}

async function searchPlaces(query) {
  if (query.length < 2) return []
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
    `?proximity=ip&language=en&limit=5&access_token=${TOKEN}`
  const res  = await fetch(url)
  const data = await res.json()
  return data.features || []
}

export default function LocationPicker({ onAddressResolved, existingAddress = '' }) {
  const mapContainer = useRef(null)
  const map          = useRef(null)
  const marker       = useRef(null)

  const [loading,     setLoading]     = useState(false)
  const [gpsLoading,  setGpsLoading]  = useState(false)
  const [searchQuery, setSearchQuery] = useState(existingAddress)
  const [suggestions, setSuggestions] = useState([])
  const [resolved,    setResolved]    = useState(null)
  const [error,       setError]       = useState('')

  useEffect(() => {
    if (map.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style:     'mapbox://styles/mapbox/dark-v11',
      center:    [80.2707, 13.0827], // default: Chennai
      zoom:      11,
    })

    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

    // Draggable marker
    marker.current = new mapboxgl.Marker({ color: '#7c6aff', draggable: true })
      .setLngLat([80.2707, 13.0827])
      .addTo(map.current)

    marker.current.on('dragend', async () => {
      const { lng, lat } = marker.current.getLngLat()
      await resolvePoint(lng, lat)
    })

    map.current.on('click', async (e) => {
      const { lng, lat } = e.lngLat
      marker.current.setLngLat([lng, lat])
      await resolvePoint(lng, lat)
    })

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  const resolvePoint = useCallback(async (lng, lat) => {
    setLoading(true)
    setError('')
    try {
      const addr = await reverseGeocode(lng, lat)
      if (addr) {
        setResolved(addr)
        setSearchQuery(addr.address)
        onAddressResolved?.(addr)
      } else {
        setError('Could not determine address for this location.')
      }
    } catch {
      setError('Geocoding failed. Check your Mapbox token.')
    } finally {
      setLoading(false)
    }
  }, [onAddressResolved])

  const handleGPS = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.')
      return
    }
    setGpsLoading(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { longitude: lng, latitude: lat } = coords
        map.current.flyTo({ center: [lng, lat], zoom: 15, duration: 1200 })
        marker.current.setLngLat([lng, lat])
        await resolvePoint(lng, lat)
        setGpsLoading(false)
      },
      (err) => {
        setGpsLoading(false)
        setError(
          err.code === 1
            ? 'Location access denied. Please allow location in your browser.'
            : 'Unable to retrieve your location.'
        )
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleSearchInput = async (e) => {
    const q = e.target.value
    setSearchQuery(q)
    if (q.length < 2) { setSuggestions([]); return }
    const results = await searchPlaces(q)
    setSuggestions(results)
  }

  const handleSuggestionClick = async (feature) => {
    const [lng, lat] = feature.center
    setSuggestions([])
    setSearchQuery(feature.place_name)
    map.current.flyTo({ center: [lng, lat], zoom: 15, duration: 900 })
    marker.current.setLngLat([lng, lat])
    await resolvePoint(lng, lat)
  }

  return (
    <div className={styles.wrapper}>
      {/* Search bar */}
      <div className={styles.searchRow}>
        <div className={styles.searchBox}>
          <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className={styles.searchInput}
            placeholder="Search for your area, street, city…"
            value={searchQuery}
            onChange={handleSearchInput}
            autoComplete="off"
          />
          {searchQuery && (
            <button className={styles.clearBtn} onClick={() => { setSearchQuery(''); setSuggestions([]) }}>
              ✕
            </button>
          )}
        </div>

        <button
          className={`${styles.gpsBtn} ${gpsLoading ? styles.gpsBtnLoading : ''}`}
          onClick={handleGPS}
          disabled={gpsLoading}
          title="Use my current location"
        >
          {gpsLoading
            ? <span className={styles.spinner} />
            : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                <path d="M12 2a10 10 0 100 20A10 10 0 0012 2z" strokeOpacity=".3"/>
              </svg>
            )
          }
          <span>{gpsLoading ? 'Detecting…' : 'Use my location'}</span>
        </button>
      </div>

      {suggestions.length > 0 && (
        <ul className={styles.suggestions}>
          {suggestions.map((s) => (
            <li key={s.id} className={styles.suggestion} onClick={() => handleSuggestionClick(s)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <span>{s.place_name}</span>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.mapWrap}>
        <div ref={mapContainer} className={styles.map} />
        {loading && (
          <div className={styles.mapOverlay}>
            <span className={styles.spinner} />
            <span>Resolving address…</span>
          </div>
        )}
        <div className={styles.mapHint}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          Drag the pin or tap the map to set your location
        </div>
      </div>

      {resolved && !loading && (
        <div className={styles.resolvedCard}>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--success)"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <div className={styles.resolvedText}>
            <span className={styles.resolvedLabel}>Delivery address detected</span>
            <span className={styles.resolvedAddr}>
              {[resolved.address, resolved.city, resolved.postal_code, resolved.country]
                .filter(Boolean).join(', ')}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className={styles.errorMsg}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}
    </div>
  )
}