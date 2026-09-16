import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Create admin client with service role (lazy initialization)
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables")
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// PATCH - Update user
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { full_name, role, phone, is_active, password } = body

    const supabaseAdmin = getSupabaseAdmin()

    // Update password if provided
    if (password) {
      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
        id,
        { password }
      )

      if (passwordError) {
        console.error("Password update error:", passwordError)
        return NextResponse.json(
          { error: `Failed to update password: ${passwordError.message}` },
          { status: 400 }
        )
      }
    }

    // Update public.users table
    const updateData: Record<string, unknown> = {}
    if (full_name !== undefined) updateData.full_name = full_name
    if (role !== undefined) updateData.role = role
    if (phone !== undefined) updateData.phone = phone
    if (is_active !== undefined) updateData.is_active = is_active

    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update(updateData)
      .eq("id", id)

    if (updateError) {
      console.error("Update error:", updateError)
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// DELETE - Delete user
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabaseAdmin = getSupabaseAdmin()

    // Delete from auth (cascade will delete from public.users)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id)

    if (error) {
      console.error("Delete error:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Error deleting user:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
