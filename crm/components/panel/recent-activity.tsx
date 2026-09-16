import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { formatDistanceToNow } from "date-fns"

interface Activity {
  id: string
  type: 'order' | 'stock' | 'payment' | 'delivery' | 'profile'
  title: string
  description?: string
  timestamp: string | Date
  icon?: string
  status?: 'success' | 'warning' | 'error' | 'info'
}

interface RecentActivityProps {
  activities: Activity[]
  title?: string
  description?: string
  emptyMessage?: string
}

export function RecentActivity({
  activities,
  title = "Recent Activity",
  description = "Your latest activities and updates",
  emptyMessage = "No recent activity"
}: RecentActivityProps) {
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800'
      case 'error':
        return 'bg-red-100 text-red-800'
      case 'info':
      default:
        return 'bg-blue-100 text-blue-800'
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'order':
        return '📦'
      case 'stock':
        return '📊'
      case 'payment':
        return '💳'
      case 'delivery':
        return '🚚'
      case 'profile':
        return '👤'
      default:
        return '📌'
    }
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {emptyMessage}
          </p>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className={getStatusColor(activity.status)}>
                    {activity.icon || getActivityIcon(activity.type)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {activity.title}
                  </p>
                  {activity.description && (
                    <p className="text-sm text-muted-foreground">
                      {activity.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(activity.timestamp), {
                      addSuffix: true
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}