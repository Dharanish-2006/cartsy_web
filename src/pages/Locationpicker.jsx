/**
 * LocationPicker.jsx — production-optimized
 *
 * Fix summary vs previous version:
 *
 * 1. AbortController on every fetch
 *    reverseGeocode() and searchPlaces() both accept a signal. A single
 *    geocodeAbortRef holds the controller for the active reverse-geocode request.
 *    A single searchAbortRef holds the controller for the active search request.
 *    Before each new fetch we call .abort() on the previous controller, so only
 *    the most-recent request can ever call setState.
 *
 * 2. Debounce for map interactions (click / dragend) and search input
 *    mapDebounceRef holds a setTimeout id. On every click/drag we clear the
 *    previous timer and set a new 350 ms one. The user has to "settle" before
 *    a fetch fires. Search input is debounced with a separate 300 ms timer.
 *
 * 3. One in-flight reverse-geocode at a time
 *    geocodingRef is a boolean flag. If a geocode is already in progress we
 *    abort it first, then set the flag, then fetch. This prevents N concurrent
 *    requests even if the debounce fires while a slow fetch is still running.
 *
 * 4. Stale-closure fix for map event listeners
 *    Map events are registered once at mount and must not re-register on every
 *    render (that would leak listeners). We store mutable state in a ref
 *    (resolvePointRef) so the event handlers always call the latest version of
 *    the function without needing to re-register.
 *
 * 5. isMounted guard
 *    A mountedRef is set false in the useEffect cleanup. Every async path that
 *    calls setState checks mountedRef.current first so we never update state on
 *    an unmounted component.
 *
 * 6. Full cleanup
 *    useEffect returns a teardown that aborts any in-flight fetch, clears the
 *    debounce timer, removes the Mapbox instance, and resets all refs.
 */

import {
  useEffect, useRef, useState, useCallback, useMemo,
} from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import styles from './Locationpicker.module.css'
const TOKEN          = import.meta.env.VITE_MAPBOX_TOKEN || ''
const DEFAULT_CENTER = [80.2707, 13.0827] 
const DEFAULT_ZOOM   = 11
const MAP_DRAG_DELAY = 350
const SEARCH_DELAY   = 300

mapboxgl.accessToken = TOKEN
async function reverseGeocode(lng, lat, signal) {
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
    `?types=address,place,postcode,country&language=en&access_token=${TOKEN}`

  const res  = await fetch(url, { signal })
  const data = await res.json()

  if (!data.features?.length) return null

  const feature = data.features[0]
  const ctx     = feature.context || []
  const get     = (type) => ctx.find((c) => c.id.startsWith(type))?.text || ''

  const street = feature.place_type.includes('address')
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
  if (query.length < 2) return []
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
    `?proximity=ip&language=en&limit=5&access_token=${TOKEN}`
  const res  = await fetch(url, { signal })
  const data = await res.json()
  return data.features || []
}

export default function LocationPicker({ onAddressResolved, existingAddress = '' }) {
  const mapContainerRef  = useRef(null)
  const mapRef           = useRef(null)
  const markerRef        = useRef(null)
  const mountedRef       = useRef(true)  
  const geocodingRef     = useRef(false) 
  const geocodeAbortRef  = useRef(null)  
  const searchAbortRef   = useRef(null)  
  const mapDebounceRef   = useRef(null)
  const searchDebounceRef= useRef(null)
  const resolvePointRef  = useRef(null)
  const onAddressResolvedRef = useRef(onAddressResolved)
  useEffect(() => { onAddressResolvedRef.current = onAddressResolved }, [onAddressResolved])

  const [loading,     setLoading]     = useState(false)
  const [gpsLoading,  setGpsLoading]  = useState(false)
  const [searchQuery, setSearchQuery] = useState(existingAddress)
  const [suggestions, setSuggestions] = useState([])
  const [resolved,    setResolved]    = useState(null)
  const [error,       setError]       = useState('')

  const resolvePoint = useCallback(async (lng, lat) => {
    if (geocodeAbortRef.current) {
      geocodeAbortRef.current.abort()
    }

    const controller = new AbortController()
    geocodeAbortRef.current = controller
    geocodingRef.current    = true

    if (mountedRef.current) {
      setLoading(true)
      setError('')
    }

    try {
      const addr = await reverseGeocode(lng, lat, controller.signal)
      if (controller.signal.aborted || !mountedRef.current) return

      if (addr) {
        setResolved(addr)
        setSearchQuery(addr.address)
        onAddressResolvedRef.current?.(addr)
      } else {
        setError('Could not determine address for this location.')
      }
    } catch (err) {
      if (err.name === 'AbortError' || !mountedRef.current) return
      setError('Geocoding failed. Check your Mapbox token.')
    } finally {
      if (mountedRef.current) setLoading(false)
      geocodingRef.current = false
    }
  }, [])
  useEffect(() => { resolvePointRef.current = resolvePoint }, [resolvePoint])

  const debouncedResolve = useCallback((lng, lat) => {
    clearTimeout(mapDebounceRef.current)
    mapDebounceRef.current = setTimeout(() => {
      resolvePointRef.current?.(lng, lat)
    }, MAP_DRAG_DELAY)
  }, [])

  const debouncedResolveRef = useRef(debouncedResolve)
  useEffect(() => { debouncedResolveRef.current = debouncedResolve }, [debouncedResolve])
  useEffect(() => {
    if (mapRef.current) return 

    const map = new mapboxgl.Map({
      container:        mapContainerRef.current,
      style:            'mapbox://styles/mapbox/dark-v11',
      center:           DEFAULT_CENTER,
      zoom:             DEFAULT_ZOOM,
      fadeDuration:     0,
      trackResize:      true,
      attributionControl: false,
    })
    mapRef.current = map

    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      'top-right',
    )

    const marker = new mapboxgl.Marker({ color: '#7c6aff', draggable: true })
      .setLngLat(DEFAULT_CENTER)
      .addTo(map)
    markerRef.current = marker

    const onDragEnd = () => {
      const { lng, lat } = marker.getLngLat()
      debouncedResolveRef.current(lng, lat)
    }

    const onMapClick = (e) => {
      const { lng, lat } = e.lngLat
      marker.setLngLat([lng, lat])
      debouncedResolveRef.current(lng, lat)
    }

    marker.on('dragend', onDragEnd)
    map.on('click', onMapClick)

    return () => {
      mountedRef.current = false

      geocodeAbortRef.current?.abort()
      searchAbortRef.current?.abort()

      clearTimeout(mapDebounceRef.current)
      clearTimeout(searchDebounceRef.current)

      marker.off('dragend', onDragEnd)
      map.off('click', onMapClick)

      map.remove()
      mapRef.current    = null
      markerRef.current = null
    }
  }, []) 
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
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 1200 })
        markerRef.current?.setLngLat([lng, lat])
        resolvePointRef.current?.(lng, lat)
        setGpsLoading(false)
      },
      (err) => {
        if (!mountedRef.current) return
        setGpsLoading(false)
        setError(
          err.code === 1
            ? 'Location access denied. Please allow location in your browser.'
            : 'Unable to retrieve your location.',
        )
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }, []) 
  const handleSearchInput = useCallback((e) => {
    const q = e.target.value
    setSearchQuery(q)
    clearTimeout(searchDebounceRef.current)
    searchAbortRef.current?.abort()
    if (q.length < 2) { setSuggestions([]); return }

    searchDebounceRef.current = setTimeout(async () => {
      const controller = new AbortController()
      searchAbortRef.current = controller

      try {
        const results = await searchPlaces(q, controller.signal)
        if (!controller.signal.aborted && mountedRef.current) {
          setSuggestions(results)
        }
      } catch (err) {
        if (err.name !== 'AbortError' && mountedRef.current) {
          setSuggestions([])
        }
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
  return (
    <div className={styles.wrapper}>

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
            <button
              className={styles.clearBtn}
              onClick={handleClearSearch}
              aria-label="Clear search"
            >✕</button>
          )}
        </div>

        <button
          className={styles.gpsBtn}
          onClick={handleGPS}
          disabled={gpsLoading}
          title="Use my current location"
          aria-label="Detect my location"
        >
          {gpsLoading
            ? <span className={styles.spinner} aria-hidden />
            : <GpsIcon />
          }
          <span>{gpsLoading ? 'Detecting…' : 'Use my location'}</span>
        </button>
      </div>

      {suggestions.length > 0 && (
        <ul className={styles.suggestions} role="listbox">
          {suggestions.map((s) => (
            <li
              key={s.id}
              className={styles.suggestion}
              role="option"
              aria-selected={false}
              onClick={() => handleSuggestionClick(s)}
            >
              <PinIcon />
              <span>{s.place_name}</span>
            </li>
          ))}
        </ul>
      )}

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

      {resolved && !loading && (
        <div className={styles.resolvedCard} role="status" aria-live="polite">
          <CheckIcon />
          <div className={styles.resolvedText}>
            <span className={styles.resolvedLabel}>Delivery address detected</span>
            <span className={styles.resolvedAddr}>{resolvedString}</span>
          </div>
        </div>
      )}

      {error && (
        <div className={styles.errorMsg} role="alert">
          <ErrorIcon />
          {error}
        </div>
      )}

    </div>
  )
}
const SVG_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '2',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

function SearchIcon({ className }) {
  return (
    <svg {...SVG_PROPS} className={className}>
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function GpsIcon() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <path d="M12 2a10 10 0 100 20A10 10 0 0012 2z" strokeOpacity=".3" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg {...SVG_PROPS} stroke="var(--success)">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}