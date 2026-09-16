/**
 * Google Maps Distance Matrix API Integration
 * Calculates distances and durations between multiple origins and destinations
 */

import { GOOGLE_MAPS_API_KEY } from "./config/google-maps"

export interface Location {
  address: string
  pincode?: string
  city?: string
  state?: string
}

export interface DistanceMatrixResult {
  originIndex: number
  destinationIndex: number
  distance: {
    text: string
    value: number // in meters
  }
  duration: {
    text: string
    value: number // in seconds
  }
  status: string
}

export interface RouteOptimizationInput {
  warehouseAddress: Location
  deliveryAddresses: Array<{
    orderId: string
    address: Location
  }>
}

export interface OptimizedRoute {
  orderId: string
  sequenceNumber: number
  address: Location
  distanceFromPrevious?: number // meters
  durationFromPrevious?: number // seconds
  estimatedArrivalTime?: string
  returnToWarehouse?: {
    distance: number // meters
    duration: number // seconds
  }
}

/**
 * Build full address string from location object
 */
function buildAddressString(location: Location): string {
  const parts: string[] = []

  if (location.address) {
    parts.push(location.address)
  }
  if (location.city) {
    parts.push(location.city)
  }
  if (location.state) {
    parts.push(location.state)
  }
  if (location.pincode) {
    parts.push(location.pincode)
  }

  return parts.join(", ")
}

/**
 * Fetch distance matrix from Google Maps API
 * @param origins Array of origin addresses
 * @param destinations Array of destination addresses
 * @returns Distance matrix results
 */
export async function fetchDistanceMatrix(
  origins: string[],
  destinations: string[]
): Promise<DistanceMatrixResult[]> {
  const apiKey = GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    throw new Error("Google Maps API key is not configured")
  }

  // Google Maps Distance Matrix API has limits:
  // - Max 25 origins x 25 destinations per request (625 elements)
  // - Max 100 elements per request for free tier
  // We'll batch if needed

  const results: DistanceMatrixResult[] = []

  // Process in batches if needed
  const maxOriginsPerRequest = 10
  const maxDestinationsPerRequest = 10

  for (let i = 0; i < origins.length; i += maxOriginsPerRequest) {
    const originBatch = origins.slice(i, i + maxOriginsPerRequest)

    for (let j = 0; j < destinations.length; j += maxDestinationsPerRequest) {
      const destBatch = destinations.slice(j, j + maxDestinationsPerRequest)

      const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json")
      url.searchParams.append("origins", originBatch.join("|"))
      url.searchParams.append("destinations", destBatch.join("|"))
      url.searchParams.append("key", apiKey)
      url.searchParams.append("mode", "driving")
      url.searchParams.append("units", "metric")
      url.searchParams.append("departure_time", "now") // Get real-time traffic

      try {
        const response = await fetch(url.toString())

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()

        if (data.status !== "OK") {
          throw new Error(`Distance Matrix API error: ${data.status}`)
        }

        // Parse results
        data.rows.forEach((row: any, originIdx: number) => {
          row.elements.forEach((element: any, destIdx: number) => {
            results.push({
              originIndex: i + originIdx,
              destinationIndex: j + destIdx,
              distance: element.distance || { text: "N/A", value: 0 },
              duration: element.duration || { text: "N/A", value: 0 },
              status: element.status,
            })
          })
        })
      } catch (error) {
        console.error("Error fetching distance matrix:", error)
        throw error
      }
    }
  }

  return results
}

/**
 * Optimize route using nearest neighbor algorithm with return to warehouse
 * This creates a round-trip route: Warehouse -> Deliveries -> Warehouse
 * @param input Warehouse and delivery addresses
 * @returns Optimized route sequence
 */
export async function optimizeRoute(
  input: RouteOptimizationInput
): Promise<OptimizedRoute[]> {
  const { warehouseAddress, deliveryAddresses } = input

  if (deliveryAddresses.length === 0) {
    return []
  }

  if (deliveryAddresses.length === 1) {
    return [
      {
        orderId: deliveryAddresses[0].orderId,
        sequenceNumber: 1,
        address: deliveryAddresses[0].address,
      },
    ]
  }

  // Build address strings
  const warehouseAddressStr = buildAddressString(warehouseAddress)
  const deliveryAddressStrs = deliveryAddresses.map((d) => buildAddressString(d.address))

  // Fetch distance matrix
  // We need: warehouse -> all deliveries, and all deliveries -> all deliveries
  const allAddresses = [warehouseAddressStr, ...deliveryAddressStrs]

  console.log("Fetching distance matrix for route optimization...")
  const distanceMatrix = await fetchDistanceMatrix(allAddresses, allAddresses)

  // Build a lookup map for quick distance retrieval
  const distanceMap = new Map<string, DistanceMatrixResult>()
  distanceMatrix.forEach((result) => {
    const key = `${result.originIndex}-${result.destinationIndex}`
    distanceMap.set(key, result)
  })

  // Helper function to get distance between two points
  const getDistance = (fromIdx: number, toIdx: number): number => {
    const key = `${fromIdx}-${toIdx}`
    const result = distanceMap.get(key)
    return result?.duration.value || Infinity // Use duration (time) for optimization
  }

  // Nearest neighbor algorithm with consideration for return trip
  const visited = new Set<number>()
  const route: OptimizedRoute[] = []
  let currentIdx = 0 // Start from warehouse (index 0)

  // Visit all delivery points
  while (visited.size < deliveryAddresses.length) {
    let nearestIdx = -1
    let shortestDuration = Infinity

    // If this is the last delivery, consider the return trip to warehouse
    const isLastDelivery = visited.size === deliveryAddresses.length - 1

    // Find nearest unvisited delivery point
    for (let i = 0; i < deliveryAddresses.length; i++) {
      if (!visited.has(i)) {
        const deliveryIdx = i + 1 // +1 because index 0 is warehouse
        const durationToDelivery = getDistance(currentIdx, deliveryIdx)

        let totalDuration = durationToDelivery

        // If this is the last delivery, add return time to warehouse
        if (isLastDelivery) {
          const returnDuration = getDistance(deliveryIdx, 0) // Return to warehouse
          totalDuration += returnDuration
        }

        if (totalDuration < shortestDuration) {
          shortestDuration = totalDuration
          nearestIdx = i
        }
      }
    }

    if (nearestIdx === -1) break

    visited.add(nearestIdx)

    const deliveryIdx = nearestIdx + 1
    const distanceResult = distanceMap.get(`${currentIdx}-${deliveryIdx}`)

    route.push({
      orderId: deliveryAddresses[nearestIdx].orderId,
      sequenceNumber: route.length + 1,
      address: deliveryAddresses[nearestIdx].address,
      distanceFromPrevious: distanceResult?.distance.value,
      durationFromPrevious: distanceResult?.duration.value,
    })

    currentIdx = deliveryIdx
  }

  // Add return trip info to the last delivery
  if (route.length > 0 && currentIdx !== 0) {
    const returnDistanceResult = distanceMap.get(`${currentIdx}-0`)
    if (returnDistanceResult) {
      // Store return trip info in the last delivery stop
      const lastStop = route[route.length - 1]
      lastStop.returnToWarehouse = {
        distance: returnDistanceResult.distance.value,
        duration: returnDistanceResult.duration.value,
      }
    }
  }

  return route
}

/**
 * Calculate total route statistics including return trip to warehouse
 */
export function calculateRouteStats(optimizedRoute: OptimizedRoute[]) {
  let totalDistance = 0
  let totalDuration = 0

  optimizedRoute.forEach((stop) => {
    if (stop.distanceFromPrevious) {
      totalDistance += stop.distanceFromPrevious
    }
    if (stop.durationFromPrevious) {
      totalDuration += stop.durationFromPrevious
    }
    // Add return trip if this is the last stop
    if (stop.returnToWarehouse) {
      totalDistance += stop.returnToWarehouse.distance
      totalDuration += stop.returnToWarehouse.duration
    }
  })

  return {
    totalDistance, // in meters
    totalDuration, // in seconds
    totalDistanceKm: (totalDistance / 1000).toFixed(2),
    totalDurationHours: (totalDuration / 3600).toFixed(2),
    totalDurationMinutes: Math.round(totalDuration / 60),
    numberOfStops: optimizedRoute.length,
  }
}
