import * as XLSX from "xlsx"
import { supabase } from "@/lib/supabase"

const STATE_CODE_TO_NAME: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
}

const STATE_NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_CODE_TO_NAME).map(([code, name]) => [name.toLowerCase(), code])
)

function resolveStateCode(stateRaw: string | null | undefined, gstin?: string | null): string {
  if (gstin && /^\d{2}/.test(gstin)) return gstin.slice(0, 2)
  if (!stateRaw) return ""
  const s = String(stateRaw).trim()
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0")
  return STATE_NAME_TO_CODE[s.toLowerCase()] || ""
}

function resolveStateName(stateRaw: string | null | undefined, gstin?: string | null): string {
  const code = resolveStateCode(stateRaw, gstin)
  if (code && STATE_CODE_TO_NAME[code]) return STATE_CODE_TO_NAME[code]
  if (stateRaw && !/^\d{1,2}$/.test(String(stateRaw))) return String(stateRaw)
  return ""
}

function placeOfSupply(stateRaw: string | null | undefined, gstin?: string | null): string {
  const code = resolveStateCode(stateRaw, gstin)
  const name = resolveStateName(stateRaw, gstin)
  if (code && name) return `${code}-${name}`
  return name || code || ""
}

function fmtInvDate(d: string): string {
  if (!d) return ""
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d
  const dd = String(dt.getDate()).padStart(2, "0")
  const mm = String(dt.getMonth() + 1).padStart(2, "0")
  const yyyy = dt.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function fmtLongDate(d: string): string {
  if (!d) return ""
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${String(dt.getDate()).padStart(2, "0")}-${months[dt.getMonth()]}-${dt.getFullYear()}`
}

function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

type LedgerRow = {
  invoice_number: string
  txn_date: string
  txn_type: string
  party_name: string | null
  gstin: string | null
  state_code: string | null
  hsn: string | null
  taxable_value: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  cess_amount: number
  cgst_rate: number
  sgst_rate: number
  igst_rate: number
  is_b2b: boolean
}

export type GSTR1ExportParams = {
  selectedMonth: string   // "YYYY-MM"
  companyGstin?: string
  companyName?: string
}

function getNextMonth(monthStr: string) {
  const [year, month] = monthStr.split("-").map(Number)
  const nextDate = new Date(year, month, 1)
  return `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-01`
}

function monthLabel(monthStr: string) {
  const [y, m] = monthStr.split("-").map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleString("en-US", { month: "long", year: "numeric" })
}

function monthFileLabel(monthStr: string) {
  const [y, m] = monthStr.split("-").map(Number)
  const yy = String(y).slice(-2)
  const mm = String(m).padStart(2, "0")
  return `${mm}_${yy}`
}

function aoaToSheet(rows: (string | number)[][]): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(rows)
}

function setColWidths(sheet: XLSX.WorkSheet, widths: number[]) {
  sheet["!cols"] = widths.map(w => ({ wch: w }))
}

async function loadRowsFromTaxLedger(start: string, end: string): Promise<LedgerRow[]> {
  const { data, error } = await supabase
    .from("tax_ledger")
    .select("*")
    .in("txn_type", ["sale", "credit_note", "debit_note"])
    .gte("txn_date", start)
    .lt("txn_date", end)
    .order("txn_date", { ascending: true })
    .order("invoice_number", { ascending: true })
  if (error) throw error
  return (data || []).map((t: any) => ({
    invoice_number: t.invoice_number || "",
    txn_date: t.txn_date,
    txn_type: t.txn_type,
    party_name: t.party_name,
    gstin: t.gstin,
    state_code: t.state_code,
    hsn: t.hsn,
    taxable_value: Number(t.taxable_value || 0),
    cgst_amount: Number(t.cgst_amount || 0),
    sgst_amount: Number(t.sgst_amount || 0),
    igst_amount: Number(t.igst_amount || 0),
    cess_amount: Number(t.cess_amount || 0),
    cgst_rate: Number(t.cgst_rate || 0),
    sgst_rate: Number(t.sgst_rate || 0),
    igst_rate: Number(t.igst_rate || 0),
    is_b2b: !!t.is_b2b,
  }))
}

function customerLabel(c: any): string {
  if (!c) return ""
  if (c.company_name) return c.company_name
  return [c.first_name, c.last_name].filter(Boolean).join(" ").trim()
}

async function loadRowsFromOrders(start: string, end: string): Promise<LedgerRow[]> {
  const { data: orders, error: oErr } = await supabase
    .from("orders")
    .select(`*, order_items(*)`)
    .eq("is_gst_invoice", true)
    .gte("order_date", start)
    .lt("order_date", end)
    .order("order_date", { ascending: true })
  if (oErr) throw oErr

  const customerIds = Array.from(
    new Set((orders || []).map((o: any) => o.customer_id).filter(Boolean))
  ) as string[]
  const custMap: Record<string, any> = {}
  if (customerIds.length > 0) {
    const { data: custs } = await supabase
      .from("customers")
      .select("id, first_name, last_name, company_name, gst_number, billing_state, shipping_state")
      .in("id", customerIds)
    for (const c of custs || []) custMap[c.id] = c
  }

  const rows: LedgerRow[] = []
  for (const o of orders || []) {
    const cust = o.customer_id ? custMap[o.customer_id] : null
    const partyName = customerLabel(cust) || o.customer_full_name || o.customer_first_name || ""
    const gstin = o.customer_gst_number || (cust && cust.gst_number) || null
    const stateName = o.shipping_state || (cust && (cust.shipping_state || cust.billing_state)) || ""
    const items = (o.order_items || []) as any[]

    if (items.length === 0) {
      const taxable = Number(o.total_amount || 0) - Number(o.cgst_amount || 0) - Number(o.sgst_amount || 0) - Number(o.igst_amount || 0)
      const cgstAmt = Number(o.cgst_amount || 0)
      const sgstAmt = Number(o.sgst_amount || 0)
      const igstAmt = Number(o.igst_amount || 0)
      const cgstRate = taxable > 0 ? (cgstAmt / taxable) * 100 : 0
      const sgstRate = taxable > 0 ? (sgstAmt / taxable) * 100 : 0
      const igstRate = taxable > 0 ? (igstAmt / taxable) * 100 : 0
      rows.push({
        invoice_number: o.invoice_number_gst || o.order_number || "",
        txn_date: o.order_date,
        txn_type: "sale",
        party_name: partyName,
        gstin,
        state_code: stateName,
        hsn: null,
        taxable_value: taxable,
        cgst_amount: cgstAmt,
        sgst_amount: sgstAmt,
        igst_amount: igstAmt,
        cess_amount: 0,
        cgst_rate: round2(cgstRate),
        sgst_rate: round2(sgstRate),
        igst_rate: round2(igstRate),
        is_b2b: !!gstin,
      })
      continue
    }

    for (const it of items) {
      const taxable = Number(it.subtotal || 0)
      const cgstAmt = Number(it.cgst_amount || 0)
      const sgstAmt = Number(it.sgst_amount || 0)
      const igstAmt = Number(it.igst_amount || 0)
      const cgstRate = taxable > 0 ? (cgstAmt / taxable) * 100 : 0
      const sgstRate = taxable > 0 ? (sgstAmt / taxable) * 100 : 0
      const igstRate = taxable > 0 ? (igstAmt / taxable) * 100 : 0
      rows.push({
        invoice_number: o.invoice_number_gst || o.order_number || "",
        txn_date: o.order_date,
        txn_type: "sale",
        party_name: partyName,
        gstin,
        state_code: stateName,
        hsn: it.hsn_code || null,
        taxable_value: taxable,
        cgst_amount: cgstAmt,
        sgst_amount: sgstAmt,
        igst_amount: igstAmt,
        cess_amount: 0,
        cgst_rate: round2(cgstRate),
        sgst_rate: round2(sgstRate),
        igst_rate: round2(igstRate),
        is_b2b: !!gstin,
      })
    }
  }
  return rows
}

async function loadCreditNotesFallback(start: string, end: string): Promise<LedgerRow[]> {
  const { data: notes, error } = await supabase
    .from("credit_notes")
    .select(`*, credit_note_items(*)`)
    .gte("note_date", start)
    .lt("note_date", end)
    .order("note_date", { ascending: true })
  if (error) return []

  const gstinByName: Record<string, string> = {}
  const partyNames = Array.from(new Set((notes || []).map((n: any) => n.party_name).filter(Boolean))) as string[]
  if (partyNames.length > 0) {
    const { data: custs } = await supabase
      .from("customers")
      .select("first_name, last_name, company_name, gst_number")
      .in("company_name", partyNames)
    for (const c of custs || []) {
      const label = customerLabel(c)
      if (label && c.gst_number) gstinByName[label.toLowerCase()] = c.gst_number
    }
  }

  const rows: LedgerRow[] = []
  for (const n of notes || []) {
    const items = (n.credit_note_items || []) as any[]
    const stateName = n.state_of_supply || ""
    const partyName = n.party_name || ""
    const gstin = gstinByName[partyName.toLowerCase()] || null
    if (items.length === 0) {
      const taxable = Number(n.subtotal || 0) - Number(n.discount_amount || 0)
      const taxTotal = Number(n.tax_amount || 0)
      rows.push({
        invoice_number: n.note_number || "",
        txn_date: n.note_date,
        txn_type: "credit_note",
        party_name: partyName,
        gstin,
        state_code: stateName,
        hsn: null,
        taxable_value: taxable,
        cgst_amount: taxTotal / 2,
        sgst_amount: taxTotal / 2,
        igst_amount: 0,
        cess_amount: 0,
        cgst_rate: 0,
        sgst_rate: 0,
        igst_rate: 0,
        is_b2b: !!gstin,
      })
      continue
    }
    for (const it of items) {
      const taxable = Number(it.amount || 0) - Number(it.tax_amount || 0)
      const rate = Number(it.tax_percent || 0)
      const taxAmt = Number(it.tax_amount || 0)
      rows.push({
        invoice_number: n.note_number || "",
        txn_date: n.note_date,
        txn_type: "credit_note",
        party_name: partyName,
        gstin,
        state_code: stateName,
        hsn: it.hsn_code || null,
        taxable_value: taxable,
        cgst_amount: taxAmt / 2,
        sgst_amount: taxAmt / 2,
        igst_amount: 0,
        cess_amount: 0,
        cgst_rate: rate / 2,
        sgst_rate: rate / 2,
        igst_rate: 0,
        is_b2b: !!gstin,
      })
    }
  }
  return rows
}

function aggregateByInvoice(items: LedgerRow[]): LedgerRow[] {
  const map = new Map<string, LedgerRow>()
  for (const r of items) {
    const key = `${r.txn_type}|${r.invoice_number}|${r.txn_date}`
    const prev = map.get(key)
    if (!prev) {
      map.set(key, { ...r })
      continue
    }
    prev.taxable_value += r.taxable_value
    prev.cgst_amount += r.cgst_amount
    prev.sgst_amount += r.sgst_amount
    prev.igst_amount += r.igst_amount
    prev.cess_amount += r.cess_amount
    prev.cgst_rate = Math.max(prev.cgst_rate, r.cgst_rate)
    prev.sgst_rate = Math.max(prev.sgst_rate, r.sgst_rate)
    prev.igst_rate = Math.max(prev.igst_rate, r.igst_rate)
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.txn_date < b.txn_date) return -1
    if (a.txn_date > b.txn_date) return 1
    return a.invoice_number.localeCompare(b.invoice_number, undefined, { numeric: true })
  })
}

export async function exportGSTR1Excel({ selectedMonth, companyGstin, companyName }: GSTR1ExportParams) {
  const start = `${selectedMonth}-01`
  const end = getNextMonth(selectedMonth)

  let itemRows = await loadRowsFromTaxLedger(start, end)
  if (itemRows.length === 0) {
    const [orderRows, cnRows] = await Promise.all([
      loadRowsFromOrders(start, end),
      loadCreditNotesFallback(start, end),
    ])
    itemRows = [...orderRows, ...cnRows]
  }

  const rows = aggregateByInvoice(itemRows)
  const sales = rows.filter(r => r.txn_type === "sale")
  const creditNotes = rows.filter(r => r.txn_type === "credit_note")
  const itemSales = itemRows.filter(r => r.txn_type === "sale")

  const wb = XLSX.utils.book_new()

  // ---------- Sheet 1: GSTR1 Report (main combined view) ----------
  const periodLabel = `${monthLabel(selectedMonth)} - ${monthLabel(selectedMonth)}`
  const headerMain = [
    "GSTIN/UIN", "Party Name", "Transaction Type", "Invoice No.", "Invoice Date",
    "Invoice Value", "Rate", "Cess Rate", "Taxable value", "Reverse Charge",
    "Integrated Tax Amount", "Central Tax Amount", "State/UT Tax Amount", "Cess Amount",
    "Place of Supply(Name of state)",
  ]
  const mainRows: (string | number)[][] = []
  mainRows.push(["Period", periodLabel, "", "", "", "", "", "", "", "", "", "", "", "", ""])
  mainRows.push(Array(15).fill(""))
  mainRows.push(["1. GSTIN", companyGstin || "", "", "", "", "", "", "", "", "", "", "", "", "", ""])
  mainRows.push(["2.a Legal name of the registered person.", companyName || "", "", "", "", "", "", "", "", "", "", "", "", "", ""])
  mainRows.push(["2.b Trade name, if any", "", "", "", "", "", "", "", "", "", "", "", "", "", ""])
  mainRows.push(["3.a Aggregate turnover of the preceeding Financial Year", "", "", "", "", "", "", "", "", "", "", "", "", "", ""])
  mainRows.push(["3.b Aggregate turnover, April to June 2017", "", "", "", "", "", "", "", "", "", "", "", "", "", ""])
  mainRows.push(Array(15).fill(""))
  mainRows.push(headerMain)
  mainRows.push(Array(15).fill(""))

  let totInvVal = 0, totTaxable = 0, totIgst = 0, totCgst = 0, totSgst = 0, totCess = 0

  for (const r of rows) {
    const rate = Math.max(r.cgst_rate + r.sgst_rate, r.igst_rate)
    const invVal = round2(r.taxable_value + r.cgst_amount + r.sgst_amount + r.igst_amount + r.cess_amount)
    const txnLabel = r.txn_type === "sale" ? "Sale" : r.txn_type === "credit_note" ? "Credit Note" : "Debit Note"
    mainRows.push([
      r.gstin || "",
      r.party_name || "",
      txnLabel,
      r.invoice_number,
      fmtInvDate(r.txn_date),
      invVal,
      rate,
      0,
      round2(r.taxable_value),
      "N",
      round2(r.igst_amount),
      round2(r.cgst_amount),
      round2(r.sgst_amount),
      round2(r.cess_amount),
      r.gstin ? resolveStateName(r.state_code, r.gstin) : "",
    ])
    totInvVal += invVal
    totTaxable += r.taxable_value
    totIgst += r.igst_amount
    totCgst += r.cgst_amount
    totSgst += r.sgst_amount
    totCess += r.cess_amount
  }
  mainRows.push(Array(15).fill(""))
  mainRows.push([
    "Total", "", "", "", "", round2(totInvVal), "", "", round2(totTaxable), "",
    round2(totIgst), round2(totCgst), round2(totSgst), round2(totCess), "",
  ])

  const sheetMain = aoaToSheet(mainRows)
  setColWidths(sheetMain, [22, 40, 14, 14, 12, 14, 8, 9, 14, 9, 14, 14, 14, 12, 24])
  XLSX.utils.book_append_sheet(wb, sheetMain, "GSTR1 Report")

  // ---------- Sheet 2: b2b,sez,de ----------
  const b2bSales = sales.filter(r => !!r.gstin)
  const b2bRecipients = new Set(b2bSales.map(r => r.gstin)).size
  const b2bInvCount = new Set(b2bSales.map(r => r.invoice_number)).size
  const b2bInvValue = b2bSales.reduce((s, r) => s + r.taxable_value + r.cgst_amount + r.sgst_amount + r.igst_amount + r.cess_amount, 0)
  const b2bTaxable = b2bSales.reduce((s, r) => s + r.taxable_value, 0)
  const b2bCess = b2bSales.reduce((s, r) => s + r.cess_amount, 0)

  const b2bHeaders = [
    "GSTIN/UIN of Recipient", "Receiver Name", "Invoice Number", "Invoice date", "Invoice Value",
    "Place Of Supply", "Reverse Charge", "Applicable % of Tax Rate", "Invoice Type",
    "E-Commerce GSTIN", "Rate", "Taxable Value", "Cess Amount",
  ]
  const b2bRows: (string | number)[][] = []
  b2bRows.push(["Summary For B2B, SEZ, DE (4A, 4B, 6B, 6C)", "", "", "", "", "", "", "", "", "", "", "", ""])
  b2bRows.push(["No. of Recipients", "", "No. of Invoices", "", "Total Invoice Value", "", "", "", "", "", "", "Total Taxable Value", "Total Cess"])
  b2bRows.push([b2bRecipients, "", b2bInvCount, "", round2(b2bInvValue), "", "", "", "", "", "", round2(b2bTaxable), round2(b2bCess)])
  b2bRows.push(b2bHeaders)
  for (const r of b2bSales) {
    const rate = Math.max(r.cgst_rate + r.sgst_rate, r.igst_rate)
    const invVal = round2(r.taxable_value + r.cgst_amount + r.sgst_amount + r.igst_amount + r.cess_amount)
    b2bRows.push([
      r.gstin || "",
      r.party_name || "",
      r.invoice_number,
      fmtLongDate(r.txn_date),
      invVal,
      placeOfSupply(r.state_code, r.gstin),
      "N",
      "",
      "Regular B2B",
      "",
      rate,
      round2(r.taxable_value),
      round2(r.cess_amount),
    ])
  }
  const sheetB2B = aoaToSheet(b2bRows)
  setColWidths(sheetB2B, [22, 40, 14, 14, 14, 22, 10, 12, 14, 16, 8, 14, 12])
  XLSX.utils.book_append_sheet(wb, sheetB2B, "b2b,sez,de")

  // ---------- Sheet 3: b2cl (B2C Large: >2.5L inter-state to unreg) ----------
  const b2clRows: (string | number)[][] = []
  const b2cSales = sales.filter(r => !r.gstin)
  const b2clEntries = b2cSales.filter(r => {
    const invVal = r.taxable_value + r.cgst_amount + r.sgst_amount + r.igst_amount + r.cess_amount
    return r.igst_amount > 0 && invVal > 250000
  })
  const b2clInvVal = b2clEntries.reduce((s, r) => s + r.taxable_value + r.igst_amount + r.cess_amount, 0)
  const b2clTaxable = b2clEntries.reduce((s, r) => s + r.taxable_value, 0)
  const b2clCess = b2clEntries.reduce((s, r) => s + r.cess_amount, 0)
  b2clRows.push(["Summary For B2CL(5)", "", "", "", "", "", "", "", ""])
  b2clRows.push(["No. of Invoices", "", "Total Invoice Value", "", "", "", "Total Taxable Value", "Total Cess", ""])
  b2clRows.push([b2clEntries.length, "", round2(b2clInvVal), "", "", "", round2(b2clTaxable), round2(b2clCess), ""])
  b2clRows.push(["Invoice Number", "Invoice date", "Invoice Value", "Place Of Supply", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount", "E-Commerce GSTIN"])
  for (const r of b2clEntries) {
    const rate = r.igst_rate
    const invVal = round2(r.taxable_value + r.igst_amount + r.cess_amount)
    b2clRows.push([
      r.invoice_number,
      fmtLongDate(r.txn_date),
      invVal,
      placeOfSupply(r.state_code, r.gstin),
      "",
      rate,
      round2(r.taxable_value),
      round2(r.cess_amount),
      "",
    ])
  }
  const sheetB2CL = aoaToSheet(b2clRows)
  setColWidths(sheetB2CL, [16, 14, 14, 22, 12, 8, 14, 12, 16])
  XLSX.utils.book_append_sheet(wb, sheetB2CL, "b2cl")

  // ---------- Sheet 4: b2cs (B2C Small: aggregated by state+rate) ----------
  const b2csEntries = b2cSales.filter(r => {
    const invVal = r.taxable_value + r.cgst_amount + r.sgst_amount + r.igst_amount + r.cess_amount
    // B2C small = intra-state always, or inter-state with invoice <= 2.5L
    return r.igst_amount === 0 || invVal <= 250000
  })
  const b2csAgg = new Map<string, { state: string; rate: number; taxable: number; cess: number }>()
  for (const r of b2csEntries) {
    const rate = Math.max(r.cgst_rate + r.sgst_rate, r.igst_rate)
    const state = placeOfSupply(r.state_code, r.gstin)
    const key = `${state}|${rate}`
    const prev = b2csAgg.get(key) || { state, rate, taxable: 0, cess: 0 }
    prev.taxable += r.taxable_value
    prev.cess += r.cess_amount
    b2csAgg.set(key, prev)
  }
  const b2csTotalTaxable = Array.from(b2csAgg.values()).reduce((s, v) => s + v.taxable, 0)
  const b2csTotalCess = Array.from(b2csAgg.values()).reduce((s, v) => s + v.cess, 0)
  const b2csRows: (string | number)[][] = []
  b2csRows.push(["Summary For B2CS(7)", "", "", "", "", "", "", "", ""])
  b2csRows.push(["", "", "", "", "Total Taxable Value", "Total Cess", "", "", ""])
  b2csRows.push(["", "", "", "", round2(b2csTotalTaxable), round2(b2csTotalCess), "", "", ""])
  b2csRows.push(["Type", "Place Of Supply", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount", "E-Commerce GSTIN", "", ""])
  for (const v of b2csAgg.values()) {
    b2csRows.push(["OE", v.state, "", v.rate, round2(v.taxable), round2(v.cess), "", "", ""])
  }
  const sheetB2CS = aoaToSheet(b2csRows)
  setColWidths(sheetB2CS, [8, 22, 14, 8, 14, 12, 16, 10, 10])
  XLSX.utils.book_append_sheet(wb, sheetB2CS, "b2cs")

  // ---------- Sheet 5: cdnr (Credit/Debit Notes - Registered) ----------
  const cdnrEntries = creditNotes.filter(r => !!r.gstin)
  const cdnrRecipients = new Set(cdnrEntries.map(r => r.gstin)).size
  const cdnrNoteValue = cdnrEntries.reduce((s, r) => s + r.taxable_value + r.cgst_amount + r.sgst_amount + r.igst_amount + r.cess_amount, 0)
  const cdnrTaxable = cdnrEntries.reduce((s, r) => s + r.taxable_value, 0)
  const cdnrCess = cdnrEntries.reduce((s, r) => s + r.cess_amount, 0)
  const cdnrRows: (string | number)[][] = []
  cdnrRows.push(["Summary For CDNR(9B)", "", "", "", "", "", "", "", "", "", "", "", "", "", ""])
  cdnrRows.push(["No. of Recipients", "", "No. of Notes", "", "", "", "", "", "Total Note Value", "", "", "Total Taxable Value", "Total Cess", "", ""])
  cdnrRows.push([cdnrRecipients, "", cdnrEntries.length, "", "", "", "", "", round2(cdnrNoteValue), "", "", round2(cdnrTaxable), round2(cdnrCess), "", ""])
  cdnrRows.push(["GSTIN/UIN of Recipient", "Receiver Name", "Note Number", "Note Date", "Note Type", "Place Of Supply", "Reverse Charge", "Note Supply Type", "Note Value", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount", "", ""])
  for (const r of cdnrEntries) {
    const rate = Math.max(r.cgst_rate + r.sgst_rate, r.igst_rate)
    const noteVal = round2(r.taxable_value + r.cgst_amount + r.sgst_amount + r.igst_amount + r.cess_amount)
    cdnrRows.push([
      r.gstin || "",
      r.party_name || "",
      r.invoice_number,
      fmtLongDate(r.txn_date),
      "C",
      placeOfSupply(r.state_code, r.gstin),
      "N",
      "Regular B2B",
      noteVal,
      "",
      rate,
      round2(r.taxable_value),
      round2(r.cess_amount),
      "",
      "",
    ])
  }
  const sheetCDNR = aoaToSheet(cdnrRows)
  setColWidths(sheetCDNR, [22, 40, 14, 14, 10, 22, 10, 16, 14, 14, 8, 14, 12, 10, 10])
  XLSX.utils.book_append_sheet(wb, sheetCDNR, "cdnr")

  // ---------- Sheet 6: cdnur (Credit/Debit Notes - Unregistered) ----------
  const cdnurEntries = creditNotes.filter(r => !r.gstin)
  const cdnurNoteVal = cdnurEntries.reduce((s, r) => s + r.taxable_value + r.cgst_amount + r.sgst_amount + r.igst_amount + r.cess_amount, 0)
  const cdnurTaxable = cdnurEntries.reduce((s, r) => s + r.taxable_value, 0)
  const cdnurCess = cdnurEntries.reduce((s, r) => s + r.cess_amount, 0)
  const cdnurRows: (string | number)[][] = []
  cdnurRows.push(["Summary For CDNUR(9B)", "", "", "", "", "", "", "", "", "", "", "", ""])
  cdnurRows.push(["", "No. of Notes/Vouchers", "", "", "", "Total Note Value", "", "", "Total Taxable Value", "Total Cess", "", "", ""])
  cdnurRows.push(["", cdnurEntries.length, "", "", "", round2(cdnurNoteVal), "", "", round2(cdnurTaxable), round2(cdnurCess), "", "", ""])
  cdnurRows.push(["UR Type", "Note Number", "Note Date", "Note Type", "Place Of Supply", "Note Value", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount", "", "", ""])
  for (const r of cdnurEntries) {
    const rate = Math.max(r.cgst_rate + r.sgst_rate, r.igst_rate)
    const noteVal = round2(r.taxable_value + r.cgst_amount + r.sgst_amount + r.igst_amount + r.cess_amount)
    cdnurRows.push([
      "B2CL",
      r.invoice_number,
      fmtLongDate(r.txn_date),
      "C",
      placeOfSupply(r.state_code, r.gstin),
      noteVal,
      "",
      rate,
      round2(r.taxable_value),
      round2(r.cess_amount),
      "", "", "",
    ])
  }
  const sheetCDNUR = aoaToSheet(cdnurRows)
  setColWidths(sheetCDNUR, [10, 14, 14, 10, 22, 14, 14, 8, 14, 12, 10, 10, 10])
  XLSX.utils.book_append_sheet(wb, sheetCDNUR, "cdnur")

  // ---------- Sheet 7: exp (Exports) ----------
  const expRows: (string | number)[][] = []
  expRows.push(["Summary For EXP(6)", "", "", "", "", "", "", "", ""])
  expRows.push(["", "No. of Invoices", "", "Total Invoice Value", "", "No. of Shipping Bill", "", "", "Total Taxable Value"])
  expRows.push(["", "", "", "", "", "", "", "", ""])
  expRows.push(["Export Type", "Invoice Number", "Invoice date", "Invoice Value", "Port Code", "Shipping Bill Number", "Shipping Bill Date", "Rate", "Taxable Value"])
  const sheetEXP = aoaToSheet(expRows)
  setColWidths(sheetEXP, [12, 14, 14, 14, 12, 16, 16, 8, 14])
  XLSX.utils.book_append_sheet(wb, sheetEXP, "exp")

  // ---------- Sheet 8: at (Advance Received) ----------
  const atRows: (string | number)[][] = []
  atRows.push(["Summary For Advance Received(11B)", "", "", "", ""])
  atRows.push(["", "", "", "Total Advance Received", "Total Cess"])
  atRows.push(["", "", "", "", ""])
  atRows.push(["Place Of Supply", "Applicable % of Tax Rate", "Rate", "Gross Advance Received", "Cess Amount"])
  const sheetAT = aoaToSheet(atRows)
  setColWidths(sheetAT, [22, 14, 8, 18, 12])
  XLSX.utils.book_append_sheet(wb, sheetAT, "at")

  // ---------- Sheet 9: atadj (Advance Adjusted) ----------
  const atadjRows: (string | number)[][] = []
  atadjRows.push(["Summary For Advance Adjusted(11B)", "", "", "", ""])
  atadjRows.push(["", "", "", "Total Advance Adjusted", "Total Cess"])
  atadjRows.push(["", "", "", "", ""])
  atadjRows.push(["Place Of Supply", "Applicable % of Tax Rate", "Rate", "Gross Advance Adjusted", "Cess Amount"])
  const sheetATADJ = aoaToSheet(atadjRows)
  setColWidths(sheetATADJ, [22, 14, 8, 18, 12])
  XLSX.utils.book_append_sheet(wb, sheetATADJ, "atadj")

  // ---------- Sheet 10: exemp (Nil rated, exempted, non GST) ----------
  const exempRows: (string | number)[][] = []
  exempRows.push(["Summary For Nil rated, exempted and non GST outward supplies (8)", "", "", ""])
  exempRows.push(["", "Total Nil Rated Supplies", "Total Exempted Supplies", "Total Non-GST Supplies"])
  exempRows.push(["", 0, 0, 0])
  exempRows.push(["Description", "Nil Rated Supplies", "Exempted(other than nil rated/non GST supply)", "Non-GST Supplies"])
  exempRows.push(["Inter-State supplies to registered persons", 0, 0, 0])
  exempRows.push(["Intra-State supplies to registered persons", 0, 0, 0])
  exempRows.push(["Inter-State supplies to unregistered persons", 0, 0, 0])
  exempRows.push(["Intra-State supplies to unregistered persons", 0, 0, 0])
  const sheetEXEMP = aoaToSheet(exempRows)
  setColWidths(sheetEXEMP, [40, 18, 30, 18])
  XLSX.utils.book_append_sheet(wb, sheetEXEMP, "exemp")

  // ---------- HSN aggregation helper ----------
  type HSNAgg = { hsn: string; rate: number; totalValue: number; taxable: number; igst: number; cgst: number; sgst: number; cess: number }
  const aggHSN = (src: LedgerRow[]): HSNAgg[] => {
    const map = new Map<string, HSNAgg>()
    for (const r of src) {
      const hsn = r.hsn || ""
      const rate = Math.max(r.cgst_rate + r.sgst_rate, r.igst_rate)
      const key = `${hsn}|${rate}`
      const prev = map.get(key) || { hsn, rate, totalValue: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 }
      prev.totalValue += r.taxable_value + r.cgst_amount + r.sgst_amount + r.igst_amount + r.cess_amount
      prev.taxable += r.taxable_value
      prev.igst += r.igst_amount
      prev.cgst += r.cgst_amount
      prev.sgst += r.sgst_amount
      prev.cess += r.cess_amount
      map.set(key, prev)
    }
    return Array.from(map.values())
  }

  const buildHsnSheet = (entries: LedgerRow[], title = "Summary For HSN(12)"): XLSX.WorkSheet => {
    const agg = aggHSN(entries)
    const totals = agg.reduce(
      (s, a) => ({
        totalValue: s.totalValue + a.totalValue,
        taxable: s.taxable + a.taxable,
        igst: s.igst + a.igst,
        cgst: s.cgst + a.cgst,
        sgst: s.sgst + a.sgst,
        cess: s.cess + a.cess,
      }),
      { totalValue: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 }
    )
    const out: (string | number)[][] = []
    out.push([title, "", "", "", "", "", "", "", "", "", "", "", "", ""])
    out.push(["No. of HSN", "", "", "", "Total Value", "", "Total Taxable Value", "Total Integrated Tax", "Total Central Tax", "Total State/UT Tax", "Total Cess", "", "", ""])
    out.push([agg.length, "", "", "", round2(totals.totalValue), "", round2(totals.taxable), round2(totals.igst), round2(totals.cgst), round2(totals.sgst), round2(totals.cess), "", "", ""])
    out.push(["HSN", "Description", "UQC", "Total Quantity", "Total Value", "Rate", "Taxable Value", "Integrated Tax Amount", "Central Tax Amount", "State/UT Tax Amount", "Cess Amount", "", "", ""])
    for (const a of agg) {
      out.push([a.hsn, "", "", "", round2(a.totalValue), a.rate, round2(a.taxable), round2(a.igst), round2(a.cgst), round2(a.sgst), round2(a.cess), "", "", ""])
    }
    const sheet = aoaToSheet(out)
    setColWidths(sheet, [14, 30, 14, 12, 14, 8, 14, 16, 16, 16, 12, 10, 10, 10])
    return sheet
  }

  // ---------- Sheet 11/12/13: hsn(b2b), hsn(b2c), itemSummary ----------
  // Use item-level rows so HSN aggregation is accurate when items have different HSN codes
  const itemB2B = itemSales.filter(r => !!r.gstin)
  const itemB2C = itemSales.filter(r => !r.gstin)
  XLSX.utils.book_append_sheet(wb, buildHsnSheet(itemB2B), "hsn(b2b)")
  XLSX.utils.book_append_sheet(wb, buildHsnSheet(itemB2C), "hsn(b2c)")
  XLSX.utils.book_append_sheet(wb, buildHsnSheet(itemSales), "itemSummary")

  // ---------- Sheet 14: docs ----------
  const invSeries = sales
    .map(r => r.invoice_number)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const cnSeries = creditNotes
    .map(r => r.invoice_number)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  const docsRows: (string | number)[][] = []
  docsRows.push(["Summary of documents issued during the tax period (13)", "", "", "", ""])
  docsRows.push(["", "", "", "Total Number", "Total Cancelled"])
  docsRows.push(["", "", "", invSeries.length + cnSeries.length, 0])
  docsRows.push(["Nature of Document", "Sr. No. From", "Sr. No. To", "Total Number", "Cancelled"])
  if (invSeries.length > 0) {
    docsRows.push(["Invoices for outward supply", invSeries[0], invSeries[invSeries.length - 1], invSeries.length, 0])
  }
  if (cnSeries.length > 0) {
    docsRows.push(["Credit Note", cnSeries[0], cnSeries[cnSeries.length - 1], cnSeries.length, 0])
  }
  const sheetDOCS = aoaToSheet(docsRows)
  setColWidths(sheetDOCS, [40, 14, 14, 14, 14])
  XLSX.utils.book_append_sheet(wb, sheetDOCS, "docs")

  // ---------- Trigger download (browser-safe) ----------
  const filename = `GSTR1 Report_${monthFileLabel(selectedMonth)}_to_${monthFileLabel(selectedMonth)}.xlsx`
  const wbout: ArrayBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" })
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return filename
}
