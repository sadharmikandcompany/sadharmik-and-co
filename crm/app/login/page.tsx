"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2, Package, TruckIcon, BarChart3, Eye, EyeOff } from "lucide-react"
import { getRoleBasedRedirectPath } from "@/lib/utils/role-redirect"
import { agentAutoCheckIn } from "@/lib/utils/agent-attendance"
import type { UserRole } from "@/lib/types/database"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        // Fetch user role and redirect accordingly
        const { data: userProfile } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single()

        const redirectPath = getRoleBasedRedirectPath(userProfile?.role as UserRole || null)
        router.push(redirectPath)
      } else {
        setCheckingSession(false)
      }
    }

    checkSession()
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      if (data.session) {
        // Fetch user role and redirect accordingly
        const { data: userProfile } = await supabase
          .from('users')
          .select('role')
          .eq('id', data.session.user.id)
          .single()

        if (userProfile?.role === 'customer_support') {
          await agentAutoCheckIn(data.session.user.id)
        }

        const redirectPath = getRoleBasedRedirectPath(userProfile?.role as UserRole || null)
        router.push(redirectPath)
        router.refresh()
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred during login"
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      {/* Left side - Branding/Hero section */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/95 to-primary/90 p-12 text-primary-foreground flex-col justify-between relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:40px_40px]" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-foreground/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary-foreground/10 rounded-full blur-3xl" />

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-12 w-12 rounded-xl bg-primary-foreground/10 backdrop-blur-sm flex items-center justify-center border border-primary-foreground/20">
              <Package className="h-7 w-7" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Sadharmik & Company</h1>
          </div>

          <div className="max-w-md space-y-6">
            <h2 className="text-4xl font-bold leading-tight">
              Streamline Your Supply Chain Operations
            </h2>
            <p className="text-lg text-primary-foreground/80 leading-relaxed">
              Manage inventory, track shipments, and optimize your logistics with our comprehensive supply chain management platform.
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="relative z-10 grid grid-cols-3 gap-6">
          <div className="flex flex-col gap-2">
            <div className="h-10 w-10 rounded-lg bg-primary-foreground/10 backdrop-blur-sm flex items-center justify-center border border-primary-foreground/20">
              <Package className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">Inventory Management</p>
            <p className="text-xs text-primary-foreground/70">Track stock levels in real-time</p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="h-10 w-10 rounded-lg bg-primary-foreground/10 backdrop-blur-sm flex items-center justify-center border border-primary-foreground/20">
              <TruckIcon className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">Shipment Tracking</p>
            <p className="text-xs text-primary-foreground/70">Monitor deliveries end-to-end</p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="h-10 w-10 rounded-lg bg-primary-foreground/10 backdrop-blur-sm flex items-center justify-center border border-primary-foreground/20">
              <BarChart3 className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">Analytics & Insights</p>
            <p className="text-xs text-primary-foreground/70">Data-driven decisions</p>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-background via-background to-muted/20">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Sadharmik & Company</h1>
          </div>

          <Card className="border-2 shadow-lg">
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="text-3xl font-bold tracking-tight">Welcome back</CardTitle>
              <CardDescription className="text-base">
                Sign in to your account to continue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium">
                      Password
                    </Label>
                    <button
                      type="button"
                      className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                      onClick={() => {/* Add forgot password logic */}}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      disabled={loading}
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-0 flex items-center justify-center w-10 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                {error && (
                  <Alert variant="destructive" className="border-destructive/50">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button
                  type="submit"
                  className="w-full h-11 text-base font-medium shadow-sm"
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                  {loading ? "Signing in..." : "Sign in"}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Need help?{" "}
                  <button
                    type="button"
                    className="text-primary hover:text-primary/80 font-medium transition-colors"
                    onClick={() => {/* Add contact support logic */}}
                  >
                    Contact support
                  </button>
                </p>
              </div>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  )
}
