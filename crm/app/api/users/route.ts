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

// POST - Create new user
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, full_name, role, phone, is_active } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
      },
    })

    if (authError) {
      console.error("Auth error:", authError)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
    }

    // Upsert public.users table (insert if trigger didn't create row, update if it did)
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .upsert({
        id: authData.user.id,
        email,
        full_name,
        role: role || "customer_support",
        phone,
        is_active: is_active !== undefined ? is_active : true,
      })

    if (updateError) {
      console.error("Update error:", updateError)
      // Try to rollback by deleting the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json(
      { success: true, user: authData.user },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating user:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
