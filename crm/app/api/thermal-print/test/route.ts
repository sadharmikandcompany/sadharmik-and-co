import { NextRequest, NextResponse } from "next/server"

// ESC/POS Commands for test print
const ESC = "\x1B"
const GS = "\x1D"
const COMMANDS = {
  INIT: ESC + "@",
  ALIGN_CENTER: ESC + "a" + "\x01",
  BOLD_ON: ESC + "E" + "\x01",
  BOLD_OFF: ESC + "E" + "\x00",
  CUT_PAPER: GS + "V" + "\x00",
  FEED_LINES: (n: number) => ESC + "d" + String.fromCharCode(n),
  LINE: "------------------------------------------------",
}

interface TestRequest {
  printerIp: string
  printerPort: number
}

async function testPrinterConnection(printerIp: string, printerPort: number): Promise<{ connected: boolean; error?: string }> {
  return new Promise((resolve) => {
    import("net").then((netModule) => {
      const net = netModule
      const client = new net.Socket()

      const timeout = setTimeout(() => {
        client.destroy()
        resolve({ connected: false, error: "Connection timeout" })
      }, 5000)

      client.connect(printerPort, printerIp, () => {
        clearTimeout(timeout)

        // Send a test print
        const testData =
          COMMANDS.INIT +
          COMMANDS.ALIGN_CENTER +
          COMMANDS.BOLD_ON +
          "PRINTER TEST\n" +
          COMMANDS.BOLD_OFF +
          COMMANDS.LINE + "\n" +
          "Connection successful!\n" +
          `IP: ${printerIp}\n` +
          `Port: ${printerPort}\n` +
          `Time: ${new Date().toLocaleString()}\n` +
          COMMANDS.LINE + "\n" +
          COMMANDS.FEED_LINES(3) +
          COMMANDS.CUT_PAPER

        client.write(testData, "binary", (err) => {
          client.end()
          if (err) {
            resolve({ connected: false, error: err.message })
          } else {
            resolve({ connected: true })
          }
        })
      })

      client.on("error", (err) => {
        clearTimeout(timeout)
        client.destroy()
        resolve({ connected: false, error: err.message })
      })
    }).catch((err) => {
      resolve({ connected: false, error: err.message })
    })
  })
}

export async function POST(request: NextRequest) {
  try {
    const body: TestRequest = await request.json()

    if (!body.printerIp) {
      return NextResponse.json(
        { success: false, message: "Printer IP is required" },
        { status: 400 }
      )
    }

    const printerPort = body.printerPort || 9100

    const result = await testPrinterConnection(body.printerIp, printerPort)

    if (result.connected) {
      return NextResponse.json({
        success: true,
        message: "Printer connected successfully! Test page printed.",
      })
    } else {
      return NextResponse.json({
        success: false,
        message: `Connection failed: ${result.error}`,
      })
    }
  } catch (error) {
    console.error("Printer test error:", error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Test failed",
      },
      { status: 500 }
    )
  }
}
