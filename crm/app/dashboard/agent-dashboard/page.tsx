'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useUserRole } from '@/hooks/use-user-role'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Package,
  IndianRupee,
  PhoneIncoming,
  PhoneOutgoing,
  TrendingUp,
  Clock,
  LogIn,
  LogOut,
  Calendar,
  CheckCircle2,
  RefreshCw,
  Headphones,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { toast } from 'sonner'
import { format, isToday, parseISO, isSameMonth } from 'date-fns'

const COMMISSION_PER_ORDER = 30 // ₹30 per order

const STATUS_BADGE: Record<string, string> = {
  delivered:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400",
  completed:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400",
  shipped:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-400",
  processing:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-400",
  pending:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400",
  cancelled:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400",
  failed:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400",
}

function statusBadgeClass(status: string) {
  return (
    STATUS_BADGE[status] ||
    "border-border bg-muted text-muted-foreground"
  )
}

function customerInitials(first?: string, last?: string) {
  const a = first?.trim()?.[0]?.toUpperCase() || ""
  const b = last?.trim()?.[0]?.toUpperCase() || ""
  return (a + b) || "?"
}

interface AgentConfig {
  id: string
  user_id: string
  agent_id: string
  agent_name: string | null
  campaign_name: string
  is_active: boolean
}

interface Order {
  id: string
  order_number: string
  order_date: string
  created_at: string
  total_amount: number
  order_status: string
  payment_status: string
  customer_id: string
  customers?: {
    first_name: string
    last_name: string
    mobile_primary: string
  }
}

interface AttendanceRecord {
  id: string
  date: string
  check_in_time: string | null
  check_out_time: string | null
  status: string
  total_hours: number | null
  session_number: number
  session_type: string
}

export default function AgentDashboardPage() {
  const { userProfile, role, loading: roleLoading } = useUserRole()
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null)
  const [todaysOrders, setTodaysOrders] = useState<Order[]>([])
  const [totalOrders, setTotalOrders] = useState(0)
  const [todaysOrdersCount, setTodaysOrdersCount] = useState(0)
  const [monthlyOrdersCount, setMonthlyOrdersCount] = useState(0)
  const [monthlyOrdersAmount, setMonthlyOrdersAmount] = useState(0)
  const [totalCommission, setTotalCommission] = useState(0)
  const [todaysCommission, setTodaysCommission] = useState(0)
  const [monthlyCommission, setMonthlyCommission] = useState(0)
  const [incomingCalls, setIncomingCalls] = useState(0)
  const [outgoingCalls, setOutgoingCalls] = useState(0)
  const [todaysIncomingCalls, setTodaysIncomingCalls] = useState(0)
  const [todaysOutgoingCalls, setTodaysOutgoingCalls] = useState(0)
  const [monthlyIncomingCalls, setMonthlyIncomingCalls] = useState(0)
  const [monthlyOutgoingCalls, setMonthlyOutgoingCalls] = useState(0)
  const [callConversions, setCallConversions] = useState(0)
  const [monthlyCallConversions, setMonthlyCallConversions] = useState(0)
  const [todaysAttendance, setTodaysAttendance] = useState<AttendanceRecord[]>([])
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!roleLoading && userProfile?.id) {
      fetchAgentData()
    }
  }, [roleLoading, userProfile?.id])

  const fetchAgentData = async () => {
    if (!userProfile?.id) return

    setLoading(true)
    try {
      // 1. Get agent config for this user (may not exist)
      const { data: configData, error: configError } = await supabase
        .from('user_agent_config')
        .select('*')
        .eq('user_id', userProfile.id)
        .maybeSingle() // Use maybeSingle instead of single to avoid error when no record

      if (configError) {
        console.log('No agent config found:', configError.message)
      }

      setAgentConfig(configData)

      const agentId = configData?.agent_id
      const userId = userProfile.id

      // Get today's date range
      const today = new Date()

      // 2. Fetch orders - by agent_id OR by user_id
      let ordersData: Order[] = []

      if (agentId) {
        // Fetch orders by agent_id
        const { data: agentOrders, error: agentOrdersError } = await supabase
          .from('orders')
          .select('id, order_number, order_date, created_at, total_amount, order_status, payment_status, customer_id')
          .eq('created_by_agent_id', agentId)
          .order('created_at', { ascending: false })
          .limit(500)

        if (agentOrdersError) {
          console.error('Error fetching agent orders:', agentOrdersError.message, agentOrdersError.details)
        }

        // Also fetch orders by user_id
        const { data: userOrders, error: userOrdersError } = await supabase
          .from('orders')
          .select('id, order_number, order_date, created_at, total_amount, order_status, payment_status, customer_id')
          .eq('created_by_user_id', userId)
          .order('created_at', { ascending: false })
          .limit(500)

        if (userOrdersError) {
          console.error('Error fetching user orders:', userOrdersError.message, userOrdersError.details)
        }

        // Merge and deduplicate orders
        const allOrdersMap = new Map<string, Order>()
        ;(agentOrders || []).forEach(o => allOrdersMap.set(o.id, o as Order))
        ;(userOrders || []).forEach(o => allOrdersMap.set(o.id, o as Order))
        ordersData = Array.from(allOrdersMap.values())
        // Sort by created_at descending
        ordersData.sort((a, b) => new Date(b.created_at || b.order_date).getTime() - new Date(a.created_at || a.order_date).getTime())
      } else {
        // No agent config - fetch orders only by user_id
        const { data, error } = await supabase
          .from('orders')
          .select('id, order_number, order_date, created_at, total_amount, order_status, payment_status, customer_id')
          .eq('created_by_user_id', userId)
          .order('created_at', { ascending: false })
          .limit(500)

        if (error) {
          console.error('Error fetching orders:', error.message, error.details)
        }

        ordersData = (data || []) as Order[]
      }

      // Fetch customer details for the orders (separate query)
      const customerIds = [...new Set(ordersData.filter(o => o.customer_id).map(o => o.customer_id))]
      if (customerIds.length > 0) {
        const { data: customersData } = await supabase
          .from('customers')
          .select('id, first_name, last_name, mobile_primary')
          .in('id', customerIds.slice(0, 100)) // Limit to first 100 customers

        if (customersData) {
          const customerMap = new Map(customersData.map(c => [c.id, c]))
          ordersData = ordersData.map(order => ({
            ...order,
            customers: order.customer_id ? customerMap.get(order.customer_id) : undefined
          }))
        }
      }

      const allOrders = ordersData || []
      setTotalOrders(allOrders.length)
      setTotalCommission(allOrders.length * COMMISSION_PER_ORDER)
      setRecentOrders(allOrders.slice(0, 10))

      // Filter today's orders
      const todayOrders = allOrders.filter(order => {
        const orderDate = new Date(order.order_date || order.created_at)
        return isToday(orderDate)
      })
      setTodaysOrders(todayOrders)
      setTodaysOrdersCount(todayOrders.length)
      setTodaysCommission(todayOrders.length * COMMISSION_PER_ORDER)

      // Filter this month's orders
      const monthOrders = allOrders.filter(order => {
        const orderDate = new Date(order.order_date || order.created_at)
        return isSameMonth(orderDate, today)
      })
      setMonthlyOrdersCount(monthOrders.length)
      setMonthlyCommission(monthOrders.length * COMMISSION_PER_ORDER)
      setMonthlyOrdersAmount(monthOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0))

      // 3. Fetch call logs
      if (agentId) {
        // Total calls
        const { data: allCalls } = await supabase
          .from('myoperator_call_logs')
          .select('id, direction, status, created_at, customer_id')
          .eq('agent_id', agentId)

        const allCallsData = allCalls || []
        const incoming = allCallsData.filter(c => c.direction === 'inbound' || c.direction === 'incoming')
        const outgoing = allCallsData.filter(c => c.direction === 'outbound' || c.direction === 'outgoing')
        setIncomingCalls(incoming.length)
        setOutgoingCalls(outgoing.length)

        // Today's calls
        const todayCalls = allCallsData.filter(call => {
          const callDate = new Date(call.created_at)
          return isToday(callDate)
        })
        const todayIncoming = todayCalls.filter(c => c.direction === 'inbound' || c.direction === 'incoming')
        const todayOutgoing = todayCalls.filter(c => c.direction === 'outbound' || c.direction === 'outgoing')
        setTodaysIncomingCalls(todayIncoming.length)
        setTodaysOutgoingCalls(todayOutgoing.length)

        // This month's calls
        const monthCalls = allCallsData.filter(call => {
          const callDate = new Date(call.created_at)
          return isSameMonth(callDate, today)
        })
        const monthIncoming = monthCalls.filter(c => c.direction === 'inbound' || c.direction === 'incoming')
        const monthOutgoing = monthCalls.filter(c => c.direction === 'outbound' || c.direction === 'outgoing')
        setMonthlyIncomingCalls(monthIncoming.length)
        setMonthlyOutgoingCalls(monthOutgoing.length)

        // Calculate call to order conversion
        // Find calls that have a matching customer_id in orders
        const callCustomerIds = new Set(allCallsData.filter(c => c.customer_id).map(c => c.customer_id))
        const orderCustomerIds = new Set(allOrders.map(o => o.customer_id))
        const convertedCustomers = [...callCustomerIds].filter(id => orderCustomerIds.has(id))
        setCallConversions(convertedCustomers.length)

        // Monthly call to order conversion
        const monthCallCustomerIds = new Set(monthCalls.filter(c => c.customer_id).map(c => c.customer_id))
        const monthOrderCustomerIds = new Set(
          allOrders
            .filter(o => isSameMonth(new Date(o.order_date || o.created_at), today))
            .map(o => o.customer_id)
        )
        const monthConverted = [...monthCallCustomerIds].filter(id => monthOrderCustomerIds.has(id))
        setMonthlyCallConversions(monthConverted.length)
      }

      // 4. Fetch today's attendance
      const todayDate = format(today, 'yyyy-MM-dd')
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .eq('date', todayDate)
        .order('session_number', { ascending: true })

      setTodaysAttendance(attendanceData || [])

    } catch (error) {
      console.error('Error fetching agent data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  // Check if there's an active (unclosed) session
  const hasActiveSession = todaysAttendance.some(a => a.check_in_time && !a.check_out_time)

  // Calculate total hours worked today
  const totalHoursToday = todaysAttendance.reduce((acc, session) => {
    return acc + (session.total_hours || 0)
  }, 0)

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return `${h}h ${m}m`
  }

  if (loading || roleLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Headphones className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              Agent Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Welcome back, {userProfile?.full_name || agentConfig?.agent_name || 'Agent'}
              {agentConfig && (
                <span className="ml-2 text-xs">
                  (ID: {agentConfig.agent_id})
                </span>
              )}
            </p>
          </div>
        </div>
        <Button onClick={fetchAgentData} variant="outline" size="sm">
          <RefreshCw />
          Refresh
        </Button>
      </div>

      {/* Warning if no agent config */}
      {!agentConfig && (
        <Alert variant="default" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800 dark:text-yellow-400">Agent Configuration Missing</AlertTitle>
          <AlertDescription className="text-yellow-700 dark:text-yellow-500">
            Your account is not linked to an agent ID. Call statistics will not be available.
            Please contact admin to set up your agent configuration in the system.
          </AlertDescription>
        </Alert>
      )}

      {/* Attendance Card */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-primary" />
            Today&apos;s Attendance
          </CardTitle>
          <CardDescription>
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </CardDescription>
          <CardAction>
            <Badge variant={hasActiveSession ? "default" : "secondary"}>
              {hasActiveSession ? "Active" : "Inactive"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-4">
              {todaysAttendance.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sessions recorded yet</p>
              ) : (
                todaysAttendance.map((session) => (
                  <div key={session.id} className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="font-normal">
                      Session {session.session_number}
                    </Badge>
                    <span className="text-green-600 flex items-center gap-1">
                      <LogIn className="h-3 w-3" />
                      {session.check_in_time ? format(parseISO(session.check_in_time), 'HH:mm') : '-'}
                    </span>
                    <span className="text-muted-foreground">-</span>
                    <span className="text-red-600 flex items-center gap-1">
                      <LogOut className="h-3 w-3" />
                      {session.check_out_time ? format(parseISO(session.check_out_time), 'HH:mm') : 'Active'}
                    </span>
                    {session.total_hours && (
                      <span className="text-xs text-muted-foreground">
                        ({formatDuration(session.total_hours)})
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center gap-3">
              {totalHoursToday > 0 && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total Today</p>
                  <p className="font-semibold">{formatDuration(totalHoursToday)}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Today's Orders */}
        <Card>
          <CardHeader>
            <CardDescription>Today&apos;s Orders</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {todaysOrdersCount}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Package className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Commission:{" "}
            <span className="font-medium text-green-600">
              ₹{todaysCommission}
            </span>
          </CardContent>
        </Card>

        {/* Total Orders */}
        <Card>
          <CardHeader>
            <CardDescription>Total Orders</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {totalOrders}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            All time orders
          </CardContent>
        </Card>

        {/* Total Commission */}
        <Card>
          <CardHeader>
            <CardDescription>Total Commission</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-green-600">
              ₹{totalCommission.toLocaleString()}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-950/40">
                <IndianRupee className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            ₹{COMMISSION_PER_ORDER} per order
          </CardContent>
        </Card>

        {/* Call Conversions */}
        <Card>
          <CardHeader>
            <CardDescription>Call Conversions</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {callConversions}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Calls converted to orders
          </CardContent>
        </Card>
      </div>

      {/* Calls Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Today's Incoming Calls */}
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
          <CardHeader>
            <CardDescription>Today&apos;s Incoming</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-blue-600">
              {todaysIncomingCalls}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/60">
                <PhoneIncoming className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowDownRight className="h-3 w-3" />
            Calls received today
          </CardContent>
        </Card>

        {/* Today's Outgoing Calls */}
        <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
          <CardHeader>
            <CardDescription>Today&apos;s Outgoing</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-orange-600">
              {todaysOutgoingCalls}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/60">
                <PhoneOutgoing className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowUpRight className="h-3 w-3" />
            Calls made today
          </CardContent>
        </Card>

        {/* Total Incoming Calls */}
        <Card>
          <CardHeader>
            <CardDescription>Total Incoming</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {incomingCalls}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <PhoneIncoming className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            All time incoming
          </CardContent>
        </Card>

        {/* Total Outgoing Calls */}
        <Card>
          <CardHeader>
            <CardDescription>Total Outgoing</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {outgoingCalls}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <PhoneOutgoing className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            All time outgoing
          </CardContent>
        </Card>
      </div>

      {/* Monthly Stats Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight">
            This Month ({format(new Date(), 'MMMM yyyy')})
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Monthly Orders */}
          <Card className="border-purple-200 bg-purple-50/50 dark:border-purple-900 dark:bg-purple-950/20">
            <CardHeader>
              <CardDescription>Monthly Orders</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums text-purple-600">
                {monthlyOrdersCount}
              </CardTitle>
              <CardAction>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-950/60">
                  <Package className="h-4 w-4" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Orders this month
            </CardContent>
          </Card>

          {/* Monthly Commission */}
          <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
            <CardHeader>
              <CardDescription>Monthly Commission</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums text-green-600">
                ₹{monthlyCommission.toLocaleString()}
              </CardTitle>
              <CardAction>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-950/60">
                  <IndianRupee className="h-4 w-4" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              ₹{COMMISSION_PER_ORDER} per order
            </CardContent>
          </Card>

          {/* Monthly Sales Value */}
          <Card>
            <CardHeader>
              <CardDescription>Monthly Sales</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums">
                ₹{monthlyOrdersAmount.toLocaleString()}
              </CardTitle>
              <CardAction>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Total order value
            </CardContent>
          </Card>

          {/* Monthly Incoming Calls */}
          <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
            <CardHeader>
              <CardDescription>Monthly Incoming</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums text-blue-600">
                {monthlyIncomingCalls}
              </CardTitle>
              <CardAction>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/60">
                  <PhoneIncoming className="h-4 w-4" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Calls received
            </CardContent>
          </Card>

          {/* Monthly Outgoing Calls */}
          <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
            <CardHeader>
              <CardDescription>Monthly Outgoing</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums text-orange-600">
                {monthlyOutgoingCalls}
              </CardTitle>
              <CardAction>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/60">
                  <PhoneOutgoing className="h-4 w-4" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Calls made
            </CardContent>
          </Card>

          {/* Monthly Conversions */}
          <Card>
            <CardHeader>
              <CardDescription>Monthly Conversions</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums">
                {monthlyCallConversions}
              </CardTitle>
              <CardAction>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Calls → orders
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Orders Table */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-muted-foreground" />
            Recent Orders
          </CardTitle>
          <CardDescription>Your last 10 orders</CardDescription>
          <CardAction>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/orders">
                View all
                <ArrowUpRight />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          {recentOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Package className="h-5 w-5 opacity-50" />
              </div>
              <p className="text-sm font-medium text-foreground">
                No orders found
              </p>
              <p className="mt-1 text-xs">
                Orders will appear here once placed
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs font-medium">
                        {order.order_number}
                      </TableCell>
                      <TableCell>
                        {order.customers ? (
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[0.625rem] font-semibold text-muted-foreground">
                              {customerInitials(
                                order.customers.first_name,
                                order.customers.last_name
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium">
                                {order.customers.first_name}{" "}
                                {order.customers.last_name}
                              </p>
                              <p className="truncate text-[0.6875rem] text-muted-foreground tabular-nums">
                                {order.customers.mobile_primary}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {format(
                          parseISO(order.order_date || order.created_at),
                          "dd MMM yyyy"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        ₹{order.total_amount?.toLocaleString() || 0}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`capitalize ${statusBadgeClass(order.order_status)}`}
                        >
                          {order.order_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`capitalize ${statusBadgeClass(order.payment_status)}`}
                        >
                          {order.payment_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Today's Orders Detail */}
      {todaysOrders.length > 0 && (
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Today&apos;s Orders Detail
            </CardTitle>
            <CardDescription>
              {todaysOrdersCount} orders today · Commission{" "}
              <span className="font-medium text-emerald-600">
                ₹{todaysCommission}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todaysOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs font-medium">
                        {order.order_number}
                      </TableCell>
                      <TableCell>
                        {order.customers ? (
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[0.625rem] font-semibold text-muted-foreground">
                              {customerInitials(
                                order.customers.first_name,
                                order.customers.last_name
                              )}
                            </div>
                            <span className="truncate text-xs font-medium">
                              {order.customers.first_name}{" "}
                              {order.customers.last_name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {format(
                          parseISO(order.order_date || order.created_at),
                          "HH:mm"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        ₹{order.total_amount?.toLocaleString() || 0}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-emerald-600">
                        ₹{COMMISSION_PER_ORDER}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
