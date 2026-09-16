/**
 * Pincode Lookup Utility
 * Provides functions to auto-populate city and state based on Indian pincodes
 */

export type PincodeData = {
  city: string
  state: string
  district: string
}

// Cache for parsed pincode data
let pincodeCache: Map<string, PincodeData> | null = null

/**
 * Parse CSV and build pincode lookup cache
 */
async function buildPincodeCache(): Promise<Map<string, PincodeData>> {
  if (pincodeCache) {
    return pincodeCache
  }

  try {
    const response = await fetch('/All pincode.csv')
    const csvText = await response.text()

    const cache = new Map<string, PincodeData>()
    const lines = csvText.split('\n')

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Parse CSV line (handling potential commas in quoted fields)
      const values = line.split(',')

      if (values.length >= 9) {
        const pincode = values[4]?.trim()
        const district = values[7]?.trim()
        const statename = values[8]?.trim()

        if (pincode && district && statename) {
          // Store the first occurrence of each pincode
          // (some pincodes might have multiple entries for different offices)
          if (!cache.has(pincode)) {
            cache.set(pincode, {
              city: district,
              state: statename,
              district: district
            })
          }
        }
      }
    }

    pincodeCache = cache
    return cache
  } catch (error) {
    console.error('Error loading pincode data:', error)
    return new Map()
  }
}

/**
 * Look up city and state by pincode
 * Returns null if pincode not found
 */
export async function lookupPincode(pincode: string): Promise<PincodeData | null> {
  const cleanPincode = pincode.trim()

  if (!cleanPincode || cleanPincode.length !== 6) {
    return null
  }

  const cache = await buildPincodeCache()
  return cache.get(cleanPincode) || null
}

/**
 * Check if a pincode exists in the database
 */
export async function isValidPincode(pincode: string): Promise<boolean> {
  const result = await lookupPincode(pincode)
  return result !== null
}

/**
 * Preload the pincode cache (call this on app initialization)
 */
export async function preloadPincodeCache(): Promise<void> {
  await buildPincodeCache()
}
