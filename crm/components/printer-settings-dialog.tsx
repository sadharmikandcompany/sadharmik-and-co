"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Printer, Loader2, CheckCircle, XCircle, Settings } from "lucide-react"
import { toast } from "sonner"
import {
  getPrinterSettings,
  savePrinterSettings,
  testPrinterConnection,
  PrinterSettings,
} from "@/lib/thermal-print"

interface PrinterSettingsDialogProps {
  trigger?: React.ReactNode
}

export function PrinterSettingsDialog({ trigger }: PrinterSettingsDialogProps) {
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState<PrinterSettings>({
    printerIp: "192.168.1.100",
    printerPort: 9100,
    enabled: false,
  })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null)

  useEffect(() => {
    if (open) {
      const savedSettings = getPrinterSettings()
      setSettings(savedSettings)
      setTestResult(null)
    }
  }, [open])

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)

    const result = await testPrinterConnection(settings.printerIp, settings.printerPort)

    setTesting(false)
    setTestResult(result.success ? "success" : "error")

    if (result.success) {
      toast.success(result.message)
    } else {
      toast.error(result.message)
    }
  }

  const handleSave = () => {
    savePrinterSettings(settings)
    toast.success("Printer settings saved")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            Printer Settings
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Thermal Printer Settings
          </DialogTitle>
          <DialogDescription>
            Configure your thermal printer for direct printing with auto-cut.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enabled">Enable Direct Printing</Label>
              <p className="text-sm text-muted-foreground">
                Print directly to thermal printer with auto-cut
              </p>
            </div>
            <Switch
              id="enabled"
              checked={settings.enabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, enabled: checked })
              }
            />
          </div>

          {/* Printer IP */}
          <div className="grid gap-2">
            <Label htmlFor="printerIp">Printer IP Address</Label>
            <Input
              id="printerIp"
              placeholder="192.168.1.100"
              value={settings.printerIp}
              onChange={(e) =>
                setSettings({ ...settings, printerIp: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              The IP address of your network thermal printer
            </p>
          </div>

          {/* Printer Port */}
          <div className="grid gap-2">
            <Label htmlFor="printerPort">Printer Port</Label>
            <Input
              id="printerPort"
              type="number"
              placeholder="9100"
              value={settings.printerPort}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  printerPort: parseInt(e.target.value) || 9100,
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Default port is 9100 for most thermal printers
            </p>
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing || !settings.printerIp}
              className="flex-1"
            >
              {testing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Printer className="mr-2 h-4 w-4" />
                  Test Connection
                </>
              )}
            </Button>
            {testResult === "success" && (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
            {testResult === "error" && (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
          </div>

          {/* Instructions */}
          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="font-medium mb-1">How to find your printer IP:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Print a test page from your thermal printer</li>
              <li>Look for "IP Address" or "Network Settings"</li>
              <li>Enter the IP address above (e.g., 192.168.1.100)</li>
              <li>Click "Test Connection" to verify</li>
            </ol>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
