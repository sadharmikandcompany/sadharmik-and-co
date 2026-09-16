import { supabase } from "@/lib/supabase"
import { format, differenceInMinutes } from "date-fns"

export async function agentAutoCheckIn(userId: string) {
  const now = new Date()
  const todayDate = format(now, "yyyy-MM-dd")

  const { data: existingSessions, error: fetchError } = await supabase
    .from("attendance")
    .select("id, check_in_time, check_out_time, session_number")
    .eq("user_id", userId)
    .eq("date", todayDate)
    .order("session_number", { ascending: true })

  if (fetchError) {
    console.error("agentAutoCheckIn: failed to fetch sessions", fetchError.message)
    return
  }

  const sessions = existingSessions || []
  const hasActive = sessions.some(s => s.check_in_time && !s.check_out_time)
  if (hasActive) return

  const nextSession = sessions.length + 1

  const { error: insertError } = await supabase.from("attendance").insert({
    user_id: userId,
    date: todayDate,
    check_in_time: now.toISOString(),
    status: "present",
    session_number: nextSession,
    session_type: "work",
    created_by: userId,
  })

  if (insertError) {
    console.error("agentAutoCheckIn: failed to insert session", insertError.message)
  }
}

export async function agentAutoCheckOut(userId: string) {
  const now = new Date()
  const todayDate = format(now, "yyyy-MM-dd")

  const { data: openSessions, error: fetchError } = await supabase
    .from("attendance")
    .select("id, check_in_time")
    .eq("user_id", userId)
    .eq("date", todayDate)
    .is("check_out_time", null)
    .order("session_number", { ascending: false })
    .limit(1)

  if (fetchError) {
    console.error("agentAutoCheckOut: failed to fetch open session", fetchError.message)
    return
  }

  const openSession = openSessions?.[0]
  if (!openSession?.check_in_time) return

  const checkInTime = new Date(openSession.check_in_time)
  const totalHours = differenceInMinutes(now, checkInTime) / 60

  const { error: updateError } = await supabase
    .from("attendance")
    .update({
      check_out_time: now.toISOString(),
      total_hours: totalHours,
      updated_by: userId,
    })
    .eq("id", openSession.id)

  if (updateError) {
    console.error("agentAutoCheckOut: failed to update session", updateError.message)
  }
}
