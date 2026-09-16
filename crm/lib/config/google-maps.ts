// Google Maps API Configuration

export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

export const getGoogleMapsApiKey = () => {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('Google Maps API key is not configured')
  }
  return GOOGLE_MAPS_API_KEY
}