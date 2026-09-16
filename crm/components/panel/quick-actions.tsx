"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"
import { useRouter } from "next/navigation"

interface QuickAction {
  title: string
  description?: string
  icon: LucideIcon
  href?: string
  onClick?: () => void
  variant?: "default" | "outline" | "secondary" | "ghost"
}

interface QuickActionsProps {
  title?: string
  description?: string
  actions: QuickAction[]
}

export function QuickActions({
  title = "Quick Actions",
  description,
  actions
}: QuickActionsProps) {
  const router = useRouter()

  const handleAction = (action: QuickAction) => {
    if (action.onClick) {
      action.onClick()
    } else if (action.href) {
      router.push(action.href)
    }
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription className="text-sm">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="grid gap-2">
        {actions.map((action, index) => {
          const Icon = action.icon
          return (
            <Button
              key={index}
              variant={action.variant || "ghost"}
              className="justify-start h-auto py-2.5 px-3"
              onClick={() => handleAction(action)}
            >
              <Icon className="mr-3 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="text-left">
                <div className="text-sm font-medium">{action.title}</div>
                {action.description && (
                  <div className="text-xs text-muted-foreground font-normal">
                    {action.description}
                  </div>
                )}
              </div>
            </Button>
          )
        })}
      </CardContent>
    </Card>
  )
}