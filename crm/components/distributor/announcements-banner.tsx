"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Megaphone, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"

interface Announcement {
  id: string
  title: string
  message: string
  is_active: boolean
  created_at: string
}

interface AnnouncementsBannerProps {
  userId: string | undefined
}

export function AnnouncementsBanner({ userId }: AnnouncementsBannerProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [showRead, setShowRead] = useState(false)
  const [openAnnouncement, setOpenAnnouncement] = useState<Announcement | null>(
    null
  )

  useEffect(() => {
    if (userId) fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const fetchData = async () => {
    if (!userId) return
    setLoading(true)
    try {
      const [{ data: annData, error: annErr }, { data: readData }] =
        await Promise.all([
          supabase
            .from("announcements")
            .select("id, title, message, is_active, created_at")
            .eq("is_active", true)
            .order("created_at", { ascending: false }),
          supabase
            .from("announcement_reads")
            .select("announcement_id")
            .eq("user_id", userId),
        ])

      if (annErr) throw annErr
      setAnnouncements(annData || [])
      setReadIds(new Set((readData || []).map((r: any) => r.announcement_id)))
    } catch (error) {
      console.error("Failed to load announcements:", error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (announcementId: string) => {
    if (!userId || readIds.has(announcementId)) return
    try {
      const { error } = await supabase
        .from("announcement_reads")
        .insert({ announcement_id: announcementId, user_id: userId })
      if (error && error.code !== "23505") throw error // ignore duplicate
      setReadIds((prev) => new Set(prev).add(announcementId))
      toast.success("Marked as read")
    } catch (error: any) {
      console.error("Failed to mark read:", error)
      toast.error("Could not mark as read")
    }
  }

  if (loading || announcements.length === 0) return null

  const unread = announcements.filter((a) => !readIds.has(a.id))
  const read = announcements.filter((a) => readIds.has(a.id))

  if (unread.length === 0 && !showRead) {
    // All caught up, but allow expanding to see past ones
    return (
      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-muted-foreground">
              You're all caught up on announcements
            </span>
          </div>
          {read.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowRead(true)}
            >
              Show past ({read.length})
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-5 w-5 text-amber-600" />
              Announcements
              {unread.length > 0 && (
                <Badge className="bg-amber-600 hover:bg-amber-700 text-white">
                  {unread.length} new
                </Badge>
              )}
            </CardTitle>
            {read.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowRead((v) => !v)}
              >
                {showRead ? (
                  <>
                    Hide past
                    <ChevronUp className="h-4 w-4 ml-1" />
                  </>
                ) : (
                  <>
                    Show past ({read.length})
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            )}
          </div>
          <CardDescription>
            Messages from head office. Click an item to read and mark as read.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {unread.map((a) => (
            <AnnouncementItem
              key={a.id}
              announcement={a}
              isRead={false}
              onOpen={() => setOpenAnnouncement(a)}
            />
          ))}
          {showRead &&
            read.map((a) => (
              <AnnouncementItem
                key={a.id}
                announcement={a}
                isRead={true}
                onOpen={() => setOpenAnnouncement(a)}
              />
            ))}
        </CardContent>
      </Card>

      <Dialog
        open={openAnnouncement !== null}
        onOpenChange={(open) => !open && setOpenAnnouncement(null)}
      >
        <DialogContent className="max-w-xl">
          {openAnnouncement && (
            <>
              <DialogHeader>
                <DialogTitle>{openAnnouncement.title}</DialogTitle>
                <DialogDescription>
                  Posted{" "}
                  {format(
                    new Date(openAnnouncement.created_at),
                    "dd MMM yyyy HH:mm"
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="whitespace-pre-wrap text-sm py-2">
                {openAnnouncement.message}
              </div>
              <DialogFooter>
                {!readIds.has(openAnnouncement.id) ? (
                  <Button
                    onClick={async () => {
                      await markAsRead(openAnnouncement.id)
                      setOpenAnnouncement(null)
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Mark as read
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setOpenAnnouncement(null)}
                  >
                    Close
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function AnnouncementItem({
  announcement,
  isRead,
  onOpen,
}: {
  announcement: Announcement
  isRead: boolean
  onOpen: () => void
}) {
  return (
    <button
      onClick={onOpen}
      className={`w-full text-left rounded-lg border p-3 transition-colors hover:bg-background/80 ${
        isRead ? "opacity-60" : "bg-background"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{announcement.title}</span>
            {!isRead && (
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {announcement.message}
          </p>
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {format(new Date(announcement.created_at), "dd MMM")}
        </span>
      </div>
    </button>
  )
}
