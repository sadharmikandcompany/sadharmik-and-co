/**
 * Server-Side Pincode Lookup Utility
 * For use in Next.js API routes and server components
 */

import fs from 'fs'
import path from 'path'

export type PincodeData = {
  city: string
  state: string
  district: string
}

// Cache for parsed pincode data
let pincodeCache: Map<string, PincodeData> | null = null

/**
 * Parse CSV and build pincode lookup cache (server-side)
 */
async function buildPincodeCache(): Promise<Map<string, PincodeData>> {
  if (pincodeCache) {
    return pincodeCache
  }

  try {
    // Read CSV file from public directory
    const csvPath = path.join(process.cwd(), 'public', 'All pincode.csv')
    const csvText = fs.readFileSync(csvPath, 'utf-8')

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
    console.log(`Pincode cache built with ${cache.size} entries`)
    return cache
  } catch (error) {
    console.error('Error loading pincode data (server-side):', error)
    return new Map()
  }
}

/**
 * Look up city and state by pincode (server-side)
 * Returns null if pincode not found
 */
export async function lookupPincodeServer(pincode: string): Promise<PincodeData | null> {
  const cleanPincode = pincode.trim()

  if (!cleanPincode || cleanPincode.length !== 6) {
    return null
  }

  const cache = await buildPincodeCache()
  return cache.get(cleanPincode) || null
}

/**
 * Check if a pincode exists in the database (server-side)
 */
export async function isValidPincodeServer(pincode: string): Promise<boolean> {
  const result = await lookupPincodeServer(pincode)
  return result !== null
}

/**
 * Preload the pincode cache (server-side)
 */
export async function preloadPincodeCacheServer(): Promise<void> {
  await buildPincodeCache()
}
