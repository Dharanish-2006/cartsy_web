/**
 * LocationPicker.jsx
 *
 * Firefox crash fixes applied in this version
 * ─────────────────────────────────────────────
 * 1. TOKEN guard before map init — empty token throws in Firefox WebGL
 * 2. res.ok checked before res.json() — prevents crash on 401/403 from bad token
 * 3. overflow:hidden removed from map wrapper — was creating a stacking context
 *    around the WebGL canvas that leaked GPU compositor layers in Firefox
 * 4. backdrop-filter removed from mapHint — Firefox requires -webkit- prefix and
 *    the fallback path triggered a compositor layer explosion causing RAM spike
 * 5. Early-return cleanup — the StrictMode double-invoke guard now returns a
 *    no-op cleanup so React doesn't leak the effect on the second call
 * 6. All fetch paths validate res.ok before parsing JSON — a 401 from an invalid
 *    Mapbox token returns HTML, calling .json() on it throws a SyntaxError that
 *    is NOT an AbortError, so it falls through to the catch and crashes Firefox
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import styles from './LocationPicker.module.css'

// ─── Constants ────────────────────────────────────────────────────────────────
const TOKEN          = import.meta.env.VITE_MAPBOX_TOKEN || ''
const DEFAULT_CENTER = [80.2707, 13.0827]
const DEFAULT_ZOOM   = 11
const MAP_DRAG_DELAY = 350
const SEARCH_DELAY   = 300

// Set once at module level — only if we have a token
if (TOKEN) mapboxgl.accessToken = TOKEN

// ─── Fetch helpers (signal-aware, res.ok validated) ───────────────────────────

async function reverseGeocode(lng, lat, signal) {
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
    `?types=address,place,postcode,country&language=en&access_token=${TOKEN}`

  const res = await fetch(url, { signal })

  // res.ok check: a bad token returns 401 with HTML body, not JSON.
  // Calling .json() on HTML throws SyntaxError — not AbortError — crashing the
  // catch block's name check and leaving the component in a broken state.
  if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`)

  const data = await res.json()
  if (!data.features?.length) return null

  const feature = data.features[0]
  const ctx     = feature.context || []
  const get     = (type) => ctx.find((c) => c.id?.startsWith(type))?.text || ''

  const street = feature.place_type?.includes('address')
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

async function searchPlaces(query, signal) {
  if (!query || query.length < 2) return []

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
    `?proximity=ip&language=en&limit=5&access_token=${TOKEN}`

  const res = await fetch(url, { signal })
  if (!res.ok) return []          // soft-fail on search errors — don't crash

  const data = await res.json()
  return Array.isArray(data.features) ? data.features : []
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LocationPicker({ onAddressResolved, existingAddress = '' }) {
  const mapContainerRef   = useRef(null)
  const mapRef            = useRef(null)
  const markerRef         = useRef(null)

  // Lifecycle guards
  const mountedRef        = useRef(true)
  const geocodeAbortRef   = useRef(null)
  const searchAbortRef    = useRef(null)
  const mapDebounceRef    = useRef(null)
  const searchDebounceRef = useRef(null)

  // Stable function refs so map events never hold stale closures
  const resolvePointRef       = useRef(null)
  const debouncedResolveRef   = useRef(null)
  const onAddressResolvedRef  = useRef(onAddressResolved)

  // Keep callback ref current on every render
  useEffect(() => {
    onAddressResolvedRef.current = onAddressResolved
  }, [onAddressResolved])

  // UI state
  const [loading,     setLoading]     = useState(false)
  const [gpsLoading,  setGpsLoading]  = useState(false)
  const [searchQuery, setSearchQuery] = useState(existingAddress)
  const [suggestions, setSuggestions] = useState([])
  const [resolved,    setResolved]    = useState(null)
  const [error,       setError]       = useState('')
  const [noToken,     setNoToken]     = useState(!TOKEN)

  // ── Core geocode ─────────────────────────────────────────────────────────────
  const resolvePoint = useCallback(async (lng, lat) => {
    // Cancel previous geocode
    geocodeAbortRef.current?.abort()
    const controller = new AbortController()
    geocodeAbortRef.current = controller

    if (mountedRef.current) { setLoading(true); setError('') }

    try {
      const addr = await reverseGeocode(lng, lat, controller.signal)
      if (controller.signal.aborted || !mountedRef.current) return

      if (addr) {
        setResolved(addr)
        setSearchQuery(addr.address)
        onAddressResolvedRef.current?.(addr)
      } else {
        setError('No address found for this location.')
      }
    } catch (err) {
      if (err.name === 'AbortError' || !mountedRef.current) return
      // Distinguish token error from network error for clearer messaging
      const msg = err.message?.includes('401') || err.message?.includes('403')
        ? 'Invalid Mapbox token. Set VITE_MAPBOX_TOKEN in your .env'
        : 'Geocoding failed. Check your connection.'
      if (mountedRef.current) setError(msg)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => { resolvePointRef.current = resolvePoint }, [resolvePoint])

  // ── Debounced map resolve ─────────────────────────────────────────────────────
  const debouncedResolve = useCallback((lng, lat) => {
    clearTimeout(mapDebounceRef.current)
    mapDebounceRef.current = setTimeout(() => resolvePointRef.current?.(lng, lat), MAP_DRAG_DELAY)
  }, [])

  useEffect(() => { debouncedResolveRef.current = debouncedResolve }, [debouncedResolve])

  // ── Map init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Guard: no token → show error, don't init WebGL at all
    if (!TOKEN) { setNoToken(true); return }

    // StrictMode double-invoke guard — must return cleanup even on early return
    if (mapRef.current) return () => {}

    let map
    let marker

    try {
      map = new mapboxgl.Map({
        container:          mapContainerRef.current,
        style:              'mapbox://styles/mapbox/dark-v11',
        center:             DEFAULT_CENTER,
        zoom:               DEFAULT_ZOOM,
        fadeDuration:       0,
        attributionControl: false,
        // Firefox perf: disable pitch/rotation which adds compositor layers
        pitchWithRotate:    false,
        dragRotate:         false,
      })
      mapRef.current = map

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

      marker = new mapboxgl.Marker({ color: '#7c6aff', draggable: true })
        .setLngLat(DEFAULT_CENTER)
        .addTo(map)
      markerRef.current = marker

    } catch (err) {
      // WebGL creation can fail in Firefox with privacy.resistFingerprinting=true
      if (mountedRef.current) {
        setError('Map could not start. Try enabling WebGL in Firefox settings.')
      }
      return () => {}
    }

    // Named handlers so we can remove them exactly
    const onDragEnd = () => {
      const { lng, lat } = marker.getLngLat()
      debouncedResolveRef.current?.(lng, lat)
    }
    const onMapClick = (e) => {
      const { lng, lat } = e.lngLat
      marker.setLngLat([lng, lat])
      debouncedResolveRef.current?.(lng, lat)
    }

    marker.on('dragend', onDragEnd)
    map.on('click',      onMapClick)

    return () => {
      mountedRef.current = false

      // Abort in-flight requests
      geocodeAbortRef.current?.abort()
      searchAbortRef.current?.abort()

      // Clear timers
      clearTimeout(mapDebounceRef.current)
      clearTimeout(searchDebounceRef.current)

      // Remove event listeners before destroying map
      try { marker.off('dragend', onDragEnd) } catch {}
      try { map.off('click', onMapClick)     } catch {}

      // Destroy Mapbox — releases WebGL context + GPU memory
      try { map.remove() } catch {}
      mapRef.current    = null
      markerRef.current = null
    }
  }, []) // empty deps — everything mutable accessed via refs

  // ── GPS ───────────────────────────────────────────────────────────────────────
  const handleGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.')
      return
    }
    setGpsLoading(true)
    setError('')

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!mountedRef.current) return
        const { longitude: lng, latitude: lat } = coords
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 900 })
        markerRef.current?.setLngLat([lng, lat])
        resolvePointRef.current?.(lng, lat)
        setGpsLoading(false)
      },
      (err) => {
        if (!mountedRef.current) return
        setGpsLoading(false)
        setError(
          err.code === 1
            ? 'Location access denied. Allow location in your browser settings.'
            : 'Could not detect your location.',
        )
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }, [])

  // ── Search ────────────────────────────────────────────────────────────────────
  const handleSearchInput = useCallback((e) => {
    const q = e.target.value
    setSearchQuery(q)
    clearTimeout(searchDebounceRef.current)
    searchAbortRef.current?.abort()

    if (!q || q.length < 2) { setSuggestions([]); return }

    searchDebounceRef.current = setTimeout(async () => {
      const controller = new AbortController()
      searchAbortRef.current = controller
      try {
        const results = await searchPlaces(q, controller.signal)
        if (!controller.signal.aborted && mountedRef.current) setSuggestions(results)
      } catch (err) {
        if (err.name !== 'AbortError' && mountedRef.current) setSuggestions([])
      }
    }, SEARCH_DELAY)
  }, [])

  const handleSuggestionClick = useCallback((feature) => {
    clearTimeout(searchDebounceRef.current)
    searchAbortRef.current?.abort()
    const [lng, lat] = feature.center
    setSuggestions([])
    setSearchQuery(feature.place_name)
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 900 })
    markerRef.current?.setLngLat([lng, lat])
    resolvePointRef.current?.(lng, lat)
  }, [])

  const handleClearSearch = useCallback(() => {
    clearTimeout(searchDebounceRef.current)
    searchAbortRef.current?.abort()
    setSearchQuery('')
    setSuggestions([])
  }, [])

  const resolvedString = useMemo(
    () => resolved
      ? [resolved.address, resolved.city, resolved.postal_code, resolved.country]
          .filter(Boolean).join(', ')
      : '',
    [resolved],
  )

  // ── No-token fallback ────────────────────────────────────────────────────────
  if (noToken) {
    return (
      <div className={styles.noToken}>
        <ErrorIcon />
        <div>
          <strong>Map unavailable</strong>
          <p>Add <code>VITE_MAPBOX_TOKEN</code> to your <code>.env</code> to enable the map picker.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>

      {/* Search bar */}
      <div className={styles.searchRow}>
        <div className={styles.searchBox}>
          <SearchIcon className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search for your area, street, city…"
            value={searchQuery}
            onChange={handleSearchInput}
            autoComplete="off"
            spellCheck={false}
          />
          {searchQuery && (
            <button className={styles.clearBtn} onClick={handleClearSearch} aria-label="Clear">
              ✕
            </button>
          )}
        </div>

        <button
          className={styles.gpsBtn}
          onClick={handleGPS}
          disabled={gpsLoading}
          aria-label="Use my location"
        >
          {gpsLoading ? <span className={styles.spinner} aria-hidden /> : <GpsIcon />}
          <span>{gpsLoading ? 'Detecting…' : 'Use my location'}</span>
        </button>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <ul className={styles.suggestions} role="listbox">
          {suggestions.map((s) => (
            <li key={s.id} className={styles.suggestion} role="option" aria-selected={false}
              onClick={() => handleSuggestionClick(s)}>
              <PinIcon />
              <span>{s.place_name}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Map — NO overflow:hidden on wrapper, no backdrop-filter on overlay */}
      <div className={styles.mapWrap}>
        <div ref={mapContainerRef} className={styles.map} />
        {loading && (
          <div className={styles.mapOverlay} aria-live="polite">
            <span className={styles.spinner} aria-hidden />
            <span>Resolving address…</span>
          </div>
        )}
        <div className={styles.mapHint} aria-hidden>
          <PinIcon />
          Drag the pin or tap the map to set your location
        </div>
      </div>

      {/* Resolved */}
      {resolved && !loading && (
        <div className={styles.resolvedCard} role="status" aria-live="polite">
          <CheckIcon />
          <div className={styles.resolvedText}>
            <span className={styles.resolvedLabel}>Delivery address detected</span>
            <span className={styles.resolvedAddr}>{resolvedString}</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className={styles.errorMsg} role="alert">
          <ErrorIcon />
          {error}
        </div>
      )}

    </div>
  )
}

// ─── Icons (module-scope = stable references, no re-creation per render) ───────

const S = {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round',
  'aria-hidden': true,
}

function SearchIcon({ className }) {
  return <svg {...S} className={className}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
}
function GpsIcon() {
  return <svg {...S}><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><path d="M12 2a10 10 0 100 20A10 10 0 0012 2z" strokeOpacity=".3"/></svg>
}
function PinIcon() {
  return <svg {...S}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
}
function CheckIcon() {
  return <svg {...S} stroke="var(--success)"><polyline points="20 6 9 17 4 12"/></svg>
}
function ErrorIcon() {
  return <svg {...S}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
}