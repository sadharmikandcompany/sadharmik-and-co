import { NextRequest, NextResponse } from "next/server"
import { optimizeRoute, RouteOptimizationInput } from "@/lib/google-maps-distance"

export async function POST(request: NextRequest) {
  try {
    const body: RouteOptimizationInput = await request.json()

    if (!body.warehouseAddress) {
      return NextResponse.json(
        { error: "Warehouse address is required" },
        { status: 400 }
      )
    }

    if (!body.deliveryAddresses || body.deliveryAddresses.length === 0) {
      return NextResponse.json(
        { error: "Delivery addresses are required" },
        { status: 400 }
      )
    }

    console.log(
      `Optimizing route for ${body.deliveryAddresses.length} deliveries from warehouse`
    )

    const optimizedRoute = await optimizeRoute(body)

    return NextResponse.json({
      success: true,
      optimizedRoute,
    })
  } catch (error) {
    console.error("Error optimizing route:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to optimize route",
      },
      { status: 500 }
    )
  }
}
