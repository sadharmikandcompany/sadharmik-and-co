'use client';

import { useState, useEffect } from 'react';
import { Search, DollarSign, Package, Users, Calendar, Filter, Download, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const COMMISSION_PER_ORDER = 30; // 30 rupees per order

interface AgentOrder {
  id: string;
  order_number: string;
  created_by_agent_id: string;
  created_by_agent_name: string;
  order_date: string;
  total_amount: number;
  order_status: string;
  payment_status: string;
}

interface AgentSummary {
  agent_id: string;
  agent_name: string;
  total_orders: number;
  total_commission: number;
  orders: AgentOrder[];
}

interface MonthlyTotal {
  month: string;
  year: number;
  total_orders: number;
  total_commission: number;
  unique_agents: number;
}

export default function AgentCommissionsPage() {
  const [orders, setOrders] = useState<AgentOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<AgentOrder[]>([]);
  const [agentSummaries, setAgentSummaries] = useState<AgentSummary[]>([]);
  const [monthlyTotals, setMonthlyTotals] = useState<MonthlyTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedAgentDetail, setSelectedAgentDetail] = useState<AgentSummary | null>(null);
  const [showAgentModal, setShowAgentModal] = useState(false);

  useEffect(() => {
    fetchAgentOrders();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, searchTerm, selectedAgent, selectedMonth, dateFrom, dateTo]);

  useEffect(() => {
    calculateSummaries();
  }, [filteredOrders]);

  const fetchAgentOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .not('created_by_agent_id', 'is', null)
        .order('order_date', { ascending: false });

      if (error) throw error;

      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching agent orders:', error);
      toast.error('Failed to load agent orders');
    } finally {
      setLoading(false);
    }
  };

  const filterOrders = () => {
    let filtered = [...orders];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (order) =>
          order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.created_by_agent_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.created_by_agent_id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Agent filter
    if (selectedAgent !== 'all') {
      filtered = filtered.filter((order) => order.created_by_agent_id === selectedAgent);
    }

    // Month filter
    if (selectedMonth !== 'all') {
      filtered = filtered.filter((order) => {
        const orderDate = new Date(order.order_date);
        const monthYear = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
        return monthYear === selectedMonth;
      });
    }

    // Date range filter
    if (dateFrom) {
      filtered = filtered.filter((order) => new Date(order.order_date) >= new Date(dateFrom));
    }
    if (dateTo) {
      filtered = filtered.filter((order) => new Date(order.order_date) <= new Date(dateTo));
    }

    setFilteredOrders(filtered);
  };

  const calculateSummaries = () => {
    // Calculate agent summaries
    const agentMap = new Map<string, AgentSummary>();

    filteredOrders.forEach((order) => {
      const agentId = order.created_by_agent_id;
      if (!agentMap.has(agentId)) {
        agentMap.set(agentId, {
          agent_id: agentId,
          agent_name: order.created_by_agent_name || agentId,
          total_orders: 0,
          total_commission: 0,
          orders: [],
        });
      }

      const summary = agentMap.get(agentId)!;
      summary.total_orders += 1;
      summary.total_commission += COMMISSION_PER_ORDER;
      summary.orders.push(order);
    });

    setAgentSummaries(Array.from(agentMap.values()).sort((a, b) => b.total_orders - a.total_orders));

    // Calculate monthly totals
    const monthMap = new Map<string, MonthlyTotal>();

    filteredOrders.forEach((order) => {
      const orderDate = new Date(order.order_date);
      const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          month: orderDate.toLocaleString('default', { month: 'long' }),
          year: orderDate.getFullYear(),
          total_orders: 0,
          total_commission: 0,
          unique_agents: new Set<string>().size,
        });
      }

      const monthly = monthMap.get(monthKey)!;
      monthly.total_orders += 1;
      monthly.total_commission += COMMISSION_PER_ORDER;
    });

    // Calculate unique agents per month
    const monthlyAgents = new Map<string, Set<string>>();
    filteredOrders.forEach((order) => {
      const orderDate = new Date(order.order_date);
      const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyAgents.has(monthKey)) {
        monthlyAgents.set(monthKey, new Set());
      }
      monthlyAgents.get(monthKey)!.add(order.created_by_agent_id);
    });

    const monthlyTotalsArray = Array.from(monthMap.entries()).map(([key, value]) => ({
      ...value,
      unique_agents: monthlyAgents.get(key)?.size || 0,
    }));

    setMonthlyTotals(monthlyTotalsArray.sort((a, b) => {
      const dateA = new Date(a.year, ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].indexOf(a.month));
      const dateB = new Date(b.year, ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].indexOf(b.month));
      return dateB.getTime() - dateA.getTime();
    }));
  };

  const getUniqueAgents = () => {
    const agents = new Set<string>();
    orders.forEach((order) => {
      if (order.created_by_agent_id) {
        agents.add(order.created_by_agent_id);
      }
    });
    return Array.from(agents);
  };

  const getUniqueMonths = () => {
    const months = new Set<string>();
    orders.forEach((order) => {
      const orderDate = new Date(order.order_date);
      const monthYear = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
      months.add(monthYear);
    });
    return Array.from(months).sort().reverse();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const exportToCSV = () => {
    const headers = ['Order Number', 'Agent ID', 'Agent Name', 'Order Date', 'Order Amount', 'Commission', 'Status'];
    const rows = filteredOrders.map((order) => [
      order.order_number,
      order.created_by_agent_id,
      order.created_by_agent_name,
      formatDate(order.order_date),
      order.total_amount,
      COMMISSION_PER_ORDER,
      order.order_status,
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-commissions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const totalOrders = filteredOrders.length;
  const totalCommission = totalOrders * COMMISSION_PER_ORDER;
  const uniqueAgentCount = new Set(filteredOrders.map((o) => o.created_by_agent_id)).size;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-6 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agent Commissions</h1>
          <p className="text-muted-foreground">Track and manage agent order commissions</p>
        </div>
        <Button onClick={exportToCSV} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-xs text-muted-foreground">Agent-created orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commission</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCommission)}</div>
            <p className="text-xs text-muted-foreground">@ ₹{COMMISSION_PER_ORDER} per order</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueAgentCount}</div>
            <p className="text-xs text-muted-foreground">Creating orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. per Agent</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {uniqueAgentCount > 0 ? Math.round(totalOrders / uniqueAgentCount) : 0}
            </div>
            <p className="text-xs text-muted-foreground">Orders per agent</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter orders by agent, date range, or search</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search orders..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger>
                <SelectValue placeholder="All Agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {getUniqueAgents().map((agentId) => {
                  const agent = orders.find((o) => o.created_by_agent_id === agentId);
                  return (
                    <SelectItem key={agentId} value={agentId}>
                      {agent?.created_by_agent_name || agentId}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue placeholder="All Months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {getUniqueMonths().map((month) => {
                  const [year, monthNum] = month.split('-');
                  const date = new Date(parseInt(year), parseInt(monthNum) - 1);
                  return (
                    <SelectItem key={month} value={month}>
                      {date.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Input
              type="date"
              placeholder="From Date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />

            <Input
              type="date"
              placeholder="To Date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          {(searchTerm || selectedAgent !== 'all' || selectedMonth !== 'all' || dateFrom || dateTo) && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedAgent('all');
                  setSelectedMonth('all');
                  setDateFrom('');
                  setDateTo('');
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agent Summaries */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Performance</CardTitle>
          <CardDescription>Commission breakdown by agent</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agentSummaries.map((summary) => (
                <TableRow key={summary.agent_id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{summary.agent_name}</div>
                      <div className="text-sm text-muted-foreground">{summary.agent_id}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{summary.total_orders}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(summary.total_commission)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedAgentDetail(summary);
                        setShowAgentModal(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {agentSummaries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No agent orders found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Monthly Totals */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Breakdown</CardTitle>
          <CardDescription>Commission totals by month</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Agents</TableHead>
                <TableHead className="text-right">Total Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyTotals.map((monthly, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">
                    {monthly.month} {monthly.year}
                  </TableCell>
                  <TableCell className="text-right">{monthly.total_orders}</TableCell>
                  <TableCell className="text-right">{monthly.unique_agents}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(monthly.total_commission)}
                  </TableCell>
                </TableRow>
              ))}
              {monthlyTotals.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No monthly data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* All Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Orders</CardTitle>
          <CardDescription>Complete list of agent-created orders</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Order Amount</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.slice(0, 50).map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.order_number}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium text-sm">{order.created_by_agent_name}</div>
                      <div className="text-xs text-muted-foreground">{order.created_by_agent_id}</div>
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(order.order_date)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(order.total_amount)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(COMMISSION_PER_ORDER)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={order.order_status === 'completed' ? 'default' : 'secondary'}>
                      {order.order_status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filteredOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No orders found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {filteredOrders.length > 50 && (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Showing 50 of {filteredOrders.length} orders. Use filters to narrow down results.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agent Detail Modal */}
      <Dialog open={showAgentModal} onOpenChange={setShowAgentModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agent Details</DialogTitle>
            <DialogDescription>
              {selectedAgentDetail?.agent_name} ({selectedAgentDetail?.agent_id})
            </DialogDescription>
          </DialogHeader>

          {selectedAgentDetail && (
            <div className="space-y-6">
              {/* Agent Stats */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{selectedAgentDetail.total_orders}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Commission</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(selectedAgentDetail.total_commission)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Avg. Order Value</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(
                        selectedAgentDetail.orders.reduce((sum, o) => sum + o.total_amount, 0) /
                          selectedAgentDetail.total_orders
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Agent Orders */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Order History</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedAgentDetail.orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.order_number}</TableCell>
                        <TableCell>{formatDate(order.order_date)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(order.total_amount)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(COMMISSION_PER_ORDER)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={order.order_status === 'completed' ? 'default' : 'secondary'}>
                            {order.order_status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
