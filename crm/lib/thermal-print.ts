/**
 * Thermal Printer utilities for direct ESC/POS printing
 */

interface ThermalPrintOrder {
  order: {
    order_number: string
    invoice_number_gst?: string | null
    invoice_number_non_gst?: string | null
    is_gst_invoice?: boolean
    order_date: string
    payment_method?: string | null
    payment_status: string
    subtotal: number
    discount_amount: number
    total_amount: number
    shipping_full_address?: string | null
  }
  customer: {
    first_name: string
    last_name: string
    mobile_primary: string
    vip_number?: string | null
    full_address?: string | null
  }
  items: Array<{
    product_name: string
    hsn_code?: string | null
    quantity: number
    unit_price: number
    discount_amount: number
    gst_percentage: number
    total: number
  }>
  companyInfo?: {
    name: string
    address: string
    city: string
    pincode: string
    phone: string
    gst: string
  }
}

interface ThermalPrintResponse {
  success: boolean
  message?: string
  printedCount?: number
  error?: string
}

// Storage key for printer settings
const PRINTER_SETTINGS_KEY = "thermal_printer_settings"

export interface PrinterSettings {
  printerIp: string
  printerPort: number
  enabled: boolean
}

const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  printerIp: "192.168.1.100",
  printerPort: 9100,
  enabled: false,
}

/**
 * Get saved printer settings from localStorage
 */
export function getPrinterSettings(): PrinterSettings {
  if (typeof window === "undefined") return DEFAULT_PRINTER_SETTINGS

  try {
    const saved = localStorage.getItem(PRINTER_SETTINGS_KEY)
    if (saved) {
      return { ...DEFAULT_PRINTER_SETTINGS, ...JSON.parse(saved) }
    }
  } catch (error) {
    console.error("Error loading printer settings:", error)
  }
  return DEFAULT_PRINTER_SETTINGS
}

/**
 * Save printer settings to localStorage
 */
export function savePrinterSettings(settings: PrinterSettings): void {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(PRINTER_SETTINGS_KEY, JSON.stringify(settings))
  } catch (error) {
    console.error("Error saving printer settings:", error)
  }
}

/**
 * Check if direct thermal printing is enabled
 */
export function isThermalPrintEnabled(): boolean {
  return getPrinterSettings().enabled
}

/**
 * Print orders directly to thermal printer with auto-cut
 * @param orders - Array of order data to print
 * @returns Promise with print result
 */
export async function printThermalReceipts(
  orders: ThermalPrintOrder[]
): Promise<ThermalPrintResponse> {
  const settings = getPrinterSettings()

  if (!settings.enabled) {
    return {
      success: false,
      error: "Direct thermal printing is not enabled. Please configure printer settings.",
    }
  }

  try {
    const response = await fetch("/api/thermal-print", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orders,
        printerIp: settings.printerIp,
        printerPort: settings.printerPort,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: result.error || "Failed to print",
      }
    }

    return result
  } catch (error) {
    console.error("Thermal print error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    }
  }
}

/**
 * Test printer connection
 */
export async function testPrinterConnection(
  printerIp: string,
  printerPort: number
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch("/api/thermal-print/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ printerIp, printerPort }),
    })

    const result = await response.json()
    return {
      success: result.success,
      message: result.message || (result.success ? "Connected successfully" : "Connection failed"),
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Network error",
    }
  }
}
