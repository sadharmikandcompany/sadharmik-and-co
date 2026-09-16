import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { order, items, retailer_id } = body

    // Include retailer_id on the order so it's linked to the retailer
    const orderWithRetailer = retailer_id
      ? { ...order, retailer_id }
      : order

    // Insert the order (trigger will generate default invoice number)
    const { data: orderData, error: orderError } = await supabaseServer
      .from("orders")
      .insert([orderWithRetailer])
      .select()
      .single()

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 400 })
    }

    // If retailer_id is set, override invoice number with retailer_code prefix
    if (retailer_id) {
      const { data: retailer } = await supabaseServer
        .from("retailers")
        .select("retailer_code, gst_number")
        .eq("id", retailer_id)
        .single()

      if (retailer?.retailer_code) {
        const isGst = orderData.is_gst_invoice
        const invoiceColumn = isGst ? "invoice_number_gst" : "invoice_number_non_gst"

        // Find the max existing number for this retailer code
        const { data: maxInvoice } = await supabaseServer
          .from("orders")
          .select(invoiceColumn)
          .like(invoiceColumn, `${retailer.retailer_code}%`)
          .not(invoiceColumn, "is", null)
          .order(invoiceColumn, { ascending: false })
          .limit(50)

        let nextNum = 1
        if (maxInvoice && maxInvoice.length > 0) {
          // Extract max number from existing invoices with this prefix
          for (const inv of maxInvoice) {
            const val = (inv as Record<string, string>)[invoiceColumn]
            const numPart = val.substring(retailer.retailer_code.length)
            const parsed = parseInt(numPart, 10)
            if (!isNaN(parsed) && parsed >= nextNum) {
              nextNum = parsed + 1
            }
          }
        }

        const paddedNum = String(nextNum).padStart(3, "0")
        const newInvoiceNumber = `${retailer.retailer_code}${paddedNum}`

        await supabaseServer
          .from("orders")
          .update({ [invoiceColumn]: newInvoiceNumber })
          .eq("id", orderData.id)

        orderData[invoiceColumn] = newInvoiceNumber
      }
    }

    // Insert order items
    const orderItems = items.map((item: any) => ({
      ...item,
      order_id: orderData.id,
    }))

    const { error: itemsError } = await supabaseServer
      .from("order_items")
      .insert(orderItems)

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 400 })
    }

    return NextResponse.json({ order: orderData })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
