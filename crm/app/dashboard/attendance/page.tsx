'use client';

import { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Users,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  Download,
  Plus,
  Edit,
  LogIn,
  LogOut,
  BarChart3,
} from 'lucide-react';
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
  DialogFooter,
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone: string;
  is_active: boolean;
}

interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: 'present' | 'absent' | 'half_day' | 'leave' | 'holiday' | 'week_off';
  notes: string | null;
  total_hours: number | null;
  session_number: number;
  session_type: 'work' | 'break';
  created_at: string;
  updated_at: string;
}

interface UserWithAttendance extends User {
  attendance: AttendanceRecord[];
  totalHours: number;
  currentSession: AttendanceRecord | null; // Last uncompleted session
}

interface MonthlySummary {
  user_id: string;
  full_name: string;
  role: string;
  present_days: number;
  absent_days: number;
  half_days: number;
  leave_days: number;
  total_hours: number;
}

export default function AttendancePage() {
  const [users, setUsers] = useState<User[]>([]);
  const [usersWithAttendance, setUsersWithAttendance] = useState<UserWithAttendance[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithAttendance[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithAttendance | null>(null);
  const [attendanceForm, setAttendanceForm] = useState({
    check_in_time: '',
    check_out_time: '',
    status: 'present' as AttendanceRecord['status'],
    session_type: 'work' as 'work' | 'break',
    notes: '',
  });
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (users.length > 0) {
      fetchAttendanceForDate();
    }
  }, [users, selectedDate]);

  useEffect(() => {
    filterUsers();
  }, [usersWithAttendance, searchTerm, roleFilter, statusFilter]);

  useEffect(() => {
    fetchMonthlySummary();
  }, [selectedDate]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceForDate = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('date', selectedDate)
        .order('session_number', { ascending: true });

      if (error) throw error;

      // Group attendance records by user_id
      const attendanceByUser = new Map<string, AttendanceRecord[]>();
      data?.forEach(record => {
        const userRecords = attendanceByUser.get(record.user_id) || [];
        userRecords.push(record);
        attendanceByUser.set(record.user_id, userRecords);
      });

      const usersWithAtt: UserWithAttendance[] = users.map(user => {
        const userAttendance = attendanceByUser.get(user.id) || [];
        const totalHours = userAttendance.reduce((sum, att) => sum + (att.total_hours || 0), 0);
        const currentSession = userAttendance.find(att => att.check_in_time && !att.check_out_time) || null;

        return {
          ...user,
          attendance: userAttendance,
          totalHours,
          currentSession,
        };
      });

      setUsersWithAttendance(usersWithAtt);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      toast.error('Failed to load attendance data');
    }
  };

  const fetchMonthlySummary = async () => {
    try {
      const date = new Date(selectedDate);
      const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

      const { data: attendanceData, error } = await supabase
        .from('attendance')
        .select('*')
        .gte('date', firstDay)
        .lte('date', lastDay);

      if (error) throw error;

      // Calculate summary per user
      const summaryMap = new Map<string, MonthlySummary>();

      users.forEach(user => {
        summaryMap.set(user.id, {
          user_id: user.id,
          full_name: user.full_name || user.email,
          role: user.role,
          present_days: 0,
          absent_days: 0,
          half_days: 0,
          leave_days: 0,
          total_hours: 0,
        });
      });

      // Group by user_id and date to handle multiple sessions per day
      const userDateMap = new Map<string, Map<string, AttendanceRecord[]>>();

      attendanceData?.forEach(record => {
        const userKey = record.user_id;
        const dateKey = record.date;

        if (!userDateMap.has(userKey)) {
          userDateMap.set(userKey, new Map());
        }

        const userDates = userDateMap.get(userKey)!;
        if (!userDates.has(dateKey)) {
          userDates.set(dateKey, []);
        }

        userDates.get(dateKey)!.push(record);
      });

      // Calculate summary per user based on unique dates
      userDateMap.forEach((dateMap, userId) => {
        const summary = summaryMap.get(userId);
        if (!summary) return;

        dateMap.forEach((sessions, date) => {
          // Determine the overall status for the day based on all sessions
          const hasPresent = sessions.some(s => s.status === 'present');
          const hasAbsent = sessions.some(s => s.status === 'absent');
          const hasHalfDay = sessions.some(s => s.status === 'half_day');
          const hasLeave = sessions.some(s => s.status === 'leave');

          // Priority: present > half_day > leave > absent
          if (hasPresent) {
            summary.present_days += 1;
          } else if (hasHalfDay) {
            summary.half_days += 1;
          } else if (hasLeave) {
            summary.leave_days += 1;
          } else if (hasAbsent) {
            summary.absent_days += 1;
          }

          // Sum all hours for the day
          const dayHours = sessions.reduce((sum, s) => sum + (s.total_hours || 0), 0);
          summary.total_hours += dayHours;
        });
      });

      setMonthlySummary(Array.from(summaryMap.values()));
    } catch (error) {
      console.error('Error fetching monthly summary:', error);
      toast.error('Failed to load monthly summary');
    }
  };

  const filterUsers = () => {
    let filtered = [...usersWithAttendance];

    if (searchTerm) {
      filtered = filtered.filter(
        u =>
          u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.role?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(u => {
        // Check if any session has the specified status
        return u.attendance.some(att => att.status === statusFilter);
      });
    }

    setFilteredUsers(filtered);
  };

  const handleMarkAttendance = (user: UserWithAttendance, session?: AttendanceRecord) => {
    setSelectedUser(user);
    setEditingSessionId(session?.id || null);

    if (session) {
      // Editing existing session
      setAttendanceForm({
        check_in_time: session.check_in_time
          ? new Date(session.check_in_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
          : '',
        check_out_time: session.check_out_time
          ? new Date(session.check_out_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
          : '',
        status: session.status,
        session_type: session.session_type,
        notes: session.notes || '',
      });
    } else {
      // Adding new session
      setAttendanceForm({
        check_in_time: '',
        check_out_time: '',
        status: 'present',
        session_type: 'work',
        notes: '',
      });
    }

    setShowAttendanceModal(true);
  };

  const saveAttendance = async () => {
    if (!selectedUser) return;

    try {
      const checkInDateTime = attendanceForm.check_in_time
        ? new Date(`${selectedDate}T${attendanceForm.check_in_time}:00`).toISOString()
        : null;

      const checkOutDateTime = attendanceForm.check_out_time
        ? new Date(`${selectedDate}T${attendanceForm.check_out_time}:00`).toISOString()
        : null;

      const attendanceData = {
        user_id: selectedUser.id,
        date: selectedDate,
        check_in_time: checkInDateTime,
        check_out_time: checkOutDateTime,
        status: attendanceForm.status,
        session_type: attendanceForm.session_type,
        notes: attendanceForm.notes,
      };

      let error;

      if (editingSessionId) {
        // Update existing session
        const { error: updateError } = await supabase
          .from('attendance')
          .update(attendanceData)
          .eq('id', editingSessionId);
        error = updateError;
      } else {
        // Insert new session
        const nextSessionNumber = selectedUser.attendance.length > 0
          ? Math.max(...selectedUser.attendance.map(a => a.session_number)) + 1
          : 1;

        const { error: insertError } = await supabase
          .from('attendance')
          .insert({
            ...attendanceData,
            session_number: nextSessionNumber,
          });
        error = insertError;
      }

      if (error) throw error;

      toast.success(editingSessionId ? 'Session updated successfully' : 'New session added successfully');
      setShowAttendanceModal(false);
      setEditingSessionId(null);
      fetchAttendanceForDate();
      fetchMonthlySummary();
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast.error('Failed to save attendance');
    }
  };

  const quickCheckIn = async (user: UserWithAttendance) => {
    try {
      const now = new Date();
      const checkInDateTime = now.toISOString();

      // Determine session number
      const nextSessionNumber = user.attendance.length > 0
        ? Math.max(...user.attendance.map(a => a.session_number)) + 1
        : 1;

      const attendanceData = {
        user_id: user.id,
        date: selectedDate,
        check_in_time: checkInDateTime,
        status: 'present' as const,
        session_number: nextSessionNumber,
        session_type: 'work' as const,
      };

      const { error } = await supabase
        .from('attendance')
        .insert(attendanceData);

      if (error) throw error;

      toast.success(`Check-in recorded for ${user.full_name} (Session ${nextSessionNumber})`);
      fetchAttendanceForDate();
    } catch (error) {
      console.error('Error recording check-in:', error);
      toast.error('Failed to record check-in');
    }
  };

  const quickCheckOut = async (user: UserWithAttendance) => {
    if (!user.currentSession) {
      toast.error('Please check-in first');
      return;
    }

    try {
      const now = new Date();
      const checkOutDateTime = now.toISOString();

      const { error } = await supabase
        .from('attendance')
        .update({ check_out_time: checkOutDateTime })
        .eq('id', user.currentSession.id);

      if (error) throw error;

      toast.success(`Check-out recorded for ${user.full_name} (Session ${user.currentSession.session_number})`);
      fetchAttendanceForDate();
    } catch (error) {
      console.error('Error recording check-out:', error);
      toast.error('Failed to record check-out');
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Name', 'Email', 'Role', 'Session #', 'Session Type', 'Check In', 'Check Out', 'Hours', 'Status', 'Notes'];
    const rows: string[][] = [];

    filteredUsers.forEach(user => {
      if (user.attendance.length === 0) {
        // User with no attendance
        rows.push([
          selectedDate,
          user.full_name || '',
          user.email,
          user.role,
          '-',
          '-',
          '-',
          '-',
          '-',
          'absent',
          '',
        ]);
      } else {
        // User with one or more sessions
        user.attendance.forEach(att => {
          rows.push([
            selectedDate,
            user.full_name || '',
            user.email,
            user.role,
            att.session_number.toString(),
            att.session_type,
            att.check_in_time ? formatTime(att.check_in_time) : '-',
            att.check_out_time ? formatTime(att.check_out_time) : '-',
            att.total_hours ? att.total_hours.toFixed(2) : '-',
            att.status,
            att.notes || '',
          ]);
        });
      }
    });

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${selectedDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatTime = (dateTimeString: string) => {
    return new Date(dateTimeString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'present':
        return 'default';
      case 'absent':
        return 'destructive';
      case 'half_day':
        return 'secondary';
      case 'leave':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getUniqueRoles = () => {
    return Array.from(new Set(users.map(u => u.role)));
  };

  const todayStats = {
    total: filteredUsers.length,
    present: filteredUsers.filter(u => u.attendance.some(att => att.status === 'present')).length,
    absent: filteredUsers.filter(u => u.attendance.length === 0 || u.attendance.every(att => att.status === 'absent')).length,
    halfDay: filteredUsers.filter(u => u.attendance.some(att => att.status === 'half_day')).length,
    leave: filteredUsers.filter(u => u.attendance.some(att => att.status === 'leave')).length,
  };

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
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Attendance Management</h1>
              <p className="text-muted-foreground">Track check-in and check-out times with multiple sessions support</p>
            </div>
          </div>
        </div>
        <Button onClick={exportToCSV} variant="outline" size="lg" className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="daily" className="space-y-6">
        <TabsList>
          <TabsTrigger value="daily">Daily Attendance</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Summary</TabsTrigger>
        </TabsList>

        {/* Daily Attendance Tab */}
        <TabsContent value="daily" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card className="border-t-4 border-t-primary/50 hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <div className="rounded-full bg-primary/10 p-2">
                  <Users className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{todayStats.total}</div>
                <p className="text-xs text-muted-foreground mt-1">Active users</p>
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-green-500 hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Present</CardTitle>
                <div className="rounded-full bg-green-100 dark:bg-green-950 p-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">{todayStats.present}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {todayStats.total > 0 ? Math.round((todayStats.present / todayStats.total) * 100) : 0}% attendance rate
                </p>
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-red-500 hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Absent</CardTitle>
                <div className="rounded-full bg-red-100 dark:bg-red-950 p-2">
                  <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600 dark:text-red-400">{todayStats.absent}</div>
                <p className="text-xs text-muted-foreground mt-1">Not marked today</p>
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-orange-500 hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Half Day</CardTitle>
                <div className="rounded-full bg-orange-100 dark:bg-orange-950 p-2">
                  <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{todayStats.halfDay}</div>
                <p className="text-xs text-muted-foreground mt-1">Partial attendance</p>
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-blue-500 hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">On Leave</CardTitle>
                <div className="rounded-full bg-blue-100 dark:bg-blue-950 p-2">
                  <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{todayStats.leave}</div>
                <p className="text-xs text-muted-foreground mt-1">Approved leaves</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="border-l-4 border-l-primary">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Filters</CardTitle>
                  <CardDescription>Filter attendance by date, user, or status</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="search">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      type="search"
                      placeholder="Name, email..."
                      className="pl-8"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger id="role">
                      <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      {getUniqueRoles().map(role => (
                        <SelectItem key={role} value={role}>
                          {role.replace('_', ' ').toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger id="status">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="present">Present</SelectItem>
                      <SelectItem value="absent">Absent</SelectItem>
                      <SelectItem value="half_day">Half Day</SelectItem>
                      <SelectItem value="leave">Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(searchTerm || roleFilter !== 'all' || statusFilter !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setRoleFilter('all');
                    setStatusFilter('all');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Attendance Table */}
          <Card className="border-l-4 border-l-primary/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Attendance for {formatDate(selectedDate)}
                  </CardTitle>
                  <CardDescription>Manage daily attendance records with multiple sessions</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map(user => (
                    <>
                      {/* Main user row with summary */}
                      <TableRow key={user.id} className="border-b-2 hover:bg-muted/50">
                        <TableCell rowSpan={user.attendance.length === 0 ? 2 : user.attendance.length + 1} className="font-medium">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                              <Users className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <div className="font-semibold text-base">{user.full_name || 'N/A'}</div>
                              <div className="text-sm text-muted-foreground">{user.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell rowSpan={user.attendance.length === 0 ? 2 : user.attendance.length + 1}>
                          <Badge variant="outline" className="font-medium">
                            {user.role.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell colSpan={3} className="bg-gradient-to-r from-muted/30 to-muted/10">
                          <div className="flex items-center justify-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-semibold">
                              {user.attendance.length} Session{user.attendance.length !== 1 ? 's' : ''}
                            </span>
                            {user.currentSession && (
                              <Badge variant="default" className="ml-2 bg-green-500 text-xs">
                                Active Now
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right bg-gradient-to-r from-muted/10 to-muted/30">
                          <div className="flex items-center justify-end gap-2">
                            <BarChart3 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-lg font-bold">
                              {user.totalHours > 0 ? `${user.totalHours.toFixed(2)}h` : '0.00h'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right bg-gradient-to-r from-muted/30 to-transparent">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant={user.currentSession ? "secondary" : "default"}
                              size="sm"
                              onClick={() => quickCheckIn(user)}
                              disabled={!!user.currentSession}
                              title={user.currentSession ? "Already checked in" : "Quick Check-in"}
                              className="h-8"
                            >
                              <LogIn className="h-3.5 w-3.5 mr-1" />
                              In
                            </Button>
                            <Button
                              variant={user.currentSession ? "default" : "secondary"}
                              size="sm"
                              onClick={() => quickCheckOut(user)}
                              disabled={!user.currentSession}
                              title={user.currentSession ? "Check-out current session" : "No active session"}
                              className="h-8"
                            >
                              <LogOut className="h-3.5 w-3.5 mr-1" />
                              Out
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMarkAttendance(user)}
                              title="Add new session"
                              className="h-8"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Individual session rows */}
                      {user.attendance.length === 0 ? (
                        <TableRow key={`${user.id}-empty`} className="bg-muted/10 hover:bg-muted/20">
                          <TableCell colSpan={5} className="text-center py-4">
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                              <XCircle className="h-5 w-5" />
                              <span className="text-sm">No attendance marked for this date</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        user.attendance.map((session, idx) => (
                          <TableRow
                            key={session.id}
                            className={`${
                              session.check_out_time
                                ? 'bg-muted/5 hover:bg-muted/10'
                                : 'bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/30'
                            } transition-colors`}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2 pl-2">
                                <div className={`h-2 w-2 rounded-full ${
                                  session.check_out_time ? 'bg-gray-400' : 'bg-green-500 animate-pulse'
                                }`} />
                                {session.check_in_time ? (
                                  <div className="flex items-center gap-2">
                                    <LogIn className="h-3.5 w-3.5 text-green-600" />
                                    <span className="font-medium">{formatTime(session.check_in_time)}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                                <Badge
                                  variant={session.session_type === 'work' ? 'default' : 'secondary'}
                                  className="text-xs ml-1"
                                >
                                  #{session.session_number} {session.session_type === 'work' ? '💼' : '☕'} {session.session_type}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              {session.check_out_time ? (
                                <div className="flex items-center gap-2">
                                  <LogOut className="h-3.5 w-3.5 text-red-600" />
                                  <span className="font-medium">{formatTime(session.check_out_time)}</span>
                                </div>
                              ) : (
                                <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-300">
                                  🟢 Active
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {session.total_hours ? (
                                <span className="font-semibold text-base">{session.total_hours.toFixed(2)}h</span>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={getStatusBadgeVariant(session.status)} className="font-medium">
                                {session.status.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkAttendance(user, session)}
                                title="Edit this session"
                                className="h-8"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </>
                  ))}
                  {filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No users found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monthly Summary Tab */}
        <TabsContent value="monthly" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Attendance Summary</CardTitle>
              <CardDescription>
                Summary for {new Date(selectedDate).toLocaleString('default', { month: 'long', year: 'numeric' })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Present</TableHead>
                    <TableHead className="text-right">Absent</TableHead>
                    <TableHead className="text-right">Half Days</TableHead>
                    <TableHead className="text-right">Leaves</TableHead>
                    <TableHead className="text-right">Total Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlySummary.map(summary => (
                    <TableRow key={summary.user_id}>
                      <TableCell className="font-medium">{summary.full_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {summary.role.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-green-600 font-medium">
                        {summary.present_days}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {summary.absent_days}
                      </TableCell>
                      <TableCell className="text-right text-orange-600">
                        {summary.half_days}
                      </TableCell>
                      <TableCell className="text-right text-blue-600">
                        {summary.leave_days}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {summary.total_hours.toFixed(2)}h
                      </TableCell>
                    </TableRow>
                  ))}
                  {monthlySummary.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No attendance data for this month
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Attendance Modal */}
      <Dialog open={showAttendanceModal} onOpenChange={setShowAttendanceModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingSessionId ? (
                <>
                  <Edit className="h-5 w-5" />
                  Edit Session
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5" />
                  Add New Session
                </>
              )}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {selectedUser?.full_name} - {formatDate(selectedDate)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="session_type">Session Type</Label>
              <Select
                value={attendanceForm.session_type}
                onValueChange={(value: 'work' | 'break') =>
                  setAttendanceForm({ ...attendanceForm, session_type: value })
                }
              >
                <SelectTrigger id="session_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="work">Work</SelectItem>
                  <SelectItem value="break">Break</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="check_in">Check In Time</Label>
              <Input
                id="check_in"
                type="time"
                value={attendanceForm.check_in_time}
                onChange={(e) =>
                  setAttendanceForm({ ...attendanceForm, check_in_time: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="check_out">Check Out Time</Label>
              <Input
                id="check_out"
                type="time"
                value={attendanceForm.check_out_time}
                onChange={(e) =>
                  setAttendanceForm({ ...attendanceForm, check_out_time: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={attendanceForm.status}
                onValueChange={(value: AttendanceRecord['status']) =>
                  setAttendanceForm({ ...attendanceForm, status: value })
                }
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="half_day">Half Day</SelectItem>
                  <SelectItem value="leave">Leave</SelectItem>
                  <SelectItem value="holiday">Holiday</SelectItem>
                  <SelectItem value="week_off">Week Off</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes..."
                value={attendanceForm.notes}
                onChange={(e) =>
                  setAttendanceForm({ ...attendanceForm, notes: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAttendanceModal(false)}>
              Cancel
            </Button>
            <Button onClick={saveAttendance}>Save Attendance</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
