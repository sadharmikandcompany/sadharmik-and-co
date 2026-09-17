"use client"

import React, { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  Save,
  Plus,
  Minus,
  Trash2,
  User,
  Building2,
  Package,
  IndianRupee,
  Truck,
  FileText,
  AlertCircle,
  Filter,
  Calendar as CalendarIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

type Order = {
  id: string
  order_number: string
  customer_id: string | null
  distributor_id: string | null
  is_distributor: boolean
  is_subdistributor: boolean
  order_status: string
  payment_status: string
  payment_method: string | null
  transaction_id: string | null
  shipping_method: string | null
  tracking_number: string | null
  courier_partner: string | null
  expected_delivery_date: string | null
  shipped_date: string | null
  delivered_date: string | null
  order_notes: string | null
  customer_notes: string | null
  internal_notes: string | null
  is_priority: boolean
  order_date: string
  source_godown_id: string | null
  retailer_id: string | null

  // Address fields
  shipping_full_address: string | null
  shipping_room_number: string | null
  shipping_floor: string | null
  shipping_wing: string | null
  shipping_flat_number: string | null
  shipping_floor_wing: string | null
  shipping_building_name: string
  shipping_street_area: string
  shipping_landmark: string | null
  shipping_pincode: string
  shipping_city: string
  shipping_state: string
  shipping_country: string | null

  billing_room_number: string | null
  billing_floor: string | null
  billing_wing: string | null
  billing_flat_number: string | null
  billing_floor_wing: string | null
  billing_building_name: string
  billing_street_area: string
  billing_landmark: string | null
  billing_pincode: string
  billing_city: string
  billing_state: string
  billing_country: string | null

  // Financial fields
  subtotal: number
  discount_amount: number
  tax_amount: number
  gst_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  shipping_charges: number
  total_amount: number
}

type OrderItem = {
  id: string
  order_id: string
  product_id: string | null
  product_name: string
  product_sku: string | null
  quantity: number
  unit_price: number
  discount_percent: number
  discount_amount: number
  hsn_code: string | null
  gst_percentage: number
  gst_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  subtotal: number
  total: number
}

type Category = {
  id: string
  category_name: string
  parent_category_id: string | null
}

export default function EditOrderPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [order, setOrder] = useState<Order | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [originalOrderItems, setOriginalOrderItems] = useState<OrderItem[]>([]) // Track original items for stock adjustment
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>("all")
  const [customerInfo, setCustomerInfo] = useState<{
    name: string
    email: string
    phone: string
    company?: string
    type: "customer" | "distributor" | "subdistributor"
  } | null>(null)

  const [formData, setFormData] = useState({
    order_status: "",
    payment_status: "",
    payment_method: "",
    transaction_id: "",
    shipping_method: "",
    tracking_number: "",
    courier_partner: "",
    order_date: "",
    invoice_number_gst: "",
    invoice_number_non_gst: "",
    is_gst_invoice: false,
    expected_delivery_date: "",
    shipped_date: "",
    delivered_date: "",
    order_notes: "",
    customer_notes: "",
    internal_notes: "",
    is_priority: false,

    // Shipping address
    shipping_full_address: "",
    shipping_room_number: "",
    shipping_floor: "",
    shipping_wing: "",
    shipping_flat_number: "",
    shipping_floor_wing: "",
    shipping_building_name: "",
    shipping_street_area: "",
    shipping_landmark: "",
    shipping_pincode: "",
    shipping_city: "",
    shipping_state: "",
    shipping_country: "",

    // Billing address
    billing_room_number: "",
    billing_floor: "",
    billing_wing: "",
    billing_flat_number: "",
    billing_floor_wing: "",
    billing_building_name: "",
    billing_street_area: "",
    billing_landmark: "",
    billing_pincode: "",
    billing_city: "",
    billing_state: "",
    billing_country: "",

    // Financial
    subtotal: 0,
    discount_amount: 0,
    tax_amount: 0,
    gst_amount: 0,
    cgst_amount: 0,
    sgst_amount: 0,
    igst_amount: 0,
    shipping_charges: 0,
    total_amount: 0,
  })

  useEffect(() => {
    if (orderId) {
      fetchOrderData()
      fetchProducts()
    }
  }, [orderId])

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name")

      if (error) throw error
      setProducts(data || [])

      // Fetch categories
      const { data: categoriesData } = await supabase
        .from("categories")
        .select("id, category_name, parent_category_id")
        .order("category_name")

      setCategories(categoriesData || [])
    } catch (error) {
      console.error("Error fetching products:", error)
      toast.error("Failed to fetch products")
    }
  }

  const fetchOrderData = async () => {
    setLoading(true)

    try {
      // Fetch order
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single()

      if (orderError) throw orderError

      setOrder(orderData)
      setFormData({
        order_status: orderData.order_status || "",
        payment_status: orderData.payment_status || "",
        payment_method: orderData.payment_method || "",
        transaction_id: orderData.transaction_id || "",
        shipping_method: orderData.shipping_method || "",
        tracking_number: orderData.tracking_number || "",
        courier_partner: orderData.courier_partner || "",
        order_date: orderData.order_date ? new Date(orderData.order_date).toISOString().split('T')[0] : "",
        invoice_number_gst: orderData.invoice_number_gst || "",
        invoice_number_non_gst: orderData.invoice_number_non_gst || "",
        is_gst_invoice: orderData.is_gst_invoice ?? false,
        expected_delivery_date: orderData.expected_delivery_date ? new Date(orderData.expected_delivery_date).toISOString().split('T')[0] : "",
        shipped_date: orderData.shipped_date ? new Date(orderData.shipped_date).toISOString().split('T')[0] : "",
        delivered_date: orderData.delivered_date ? new Date(orderData.delivered_date).toISOString().split('T')[0] : "",
        order_notes: orderData.order_notes || "",
        customer_notes: orderData.customer_notes || "",
        internal_notes: orderData.internal_notes || "",
        is_priority: orderData.is_priority || false,

        shipping_full_address: orderData.shipping_full_address || "",
        shipping_room_number: orderData.shipping_room_number || "",
        shipping_floor: orderData.shipping_floor || "",
        shipping_wing: orderData.shipping_wing || "",
        shipping_flat_number: orderData.shipping_flat_number || "",
        shipping_floor_wing: orderData.shipping_floor_wing || "",
        shipping_building_name: orderData.shipping_building_name || "",
        shipping_street_area: orderData.shipping_street_area || "",
        shipping_landmark: orderData.shipping_landmark || "",
        shipping_pincode: orderData.shipping_pincode || "",
        shipping_city: orderData.shipping_city || "",
        shipping_state: orderData.shipping_state || "",
        shipping_country: orderData.shipping_country || "",

        billing_room_number: orderData.billing_room_number || "",
        billing_floor: orderData.billing_floor || "",
        billing_wing: orderData.billing_wing || "",
        billing_flat_number: orderData.billing_flat_number || "",
        billing_floor_wing: orderData.billing_floor_wing || "",
        billing_building_name: orderData.billing_building_name || "",
        billing_street_area: orderData.billing_street_area || "",
        billing_landmark: orderData.billing_landmark || "",
        billing_pincode: orderData.billing_pincode || "",
        billing_city: orderData.billing_city || "",
        billing_state: orderData.billing_state || "",
        billing_country: orderData.billing_country || "",

        subtotal: orderData.subtotal || 0,
        discount_amount: orderData.discount_amount || 0,
        tax_amount: orderData.tax_amount || 0,
        gst_amount: orderData.gst_amount || 0,
        cgst_amount: orderData.cgst_amount || 0,
        sgst_amount: orderData.sgst_amount || 0,
        igst_amount: orderData.igst_amount || 0,
        shipping_charges: orderData.shipping_charges || 0,
        total_amount: orderData.total_amount || 0,
      })

      // Fetch order items
      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId)

      if (itemsError) throw itemsError

      setOrderItems(itemsData || [])
      setOriginalOrderItems(itemsData || []) // Store original items for comparison

      // Fetch customer or distributor information
      console.log("Order data:", {
        customer_id: orderData.customer_id,
        distributor_id: orderData.distributor_id,
        is_distributor: orderData.is_distributor,
        is_subdistributor: orderData.is_subdistributor,
        customer_id_type: typeof orderData.customer_id,
        distributor_id_type: typeof orderData.distributor_id
      })

      // Check if customer_id is valid (not null, undefined, or string "null")
      const hasValidCustomerId = orderData.customer_id &&
                                  orderData.customer_id !== "null" &&
                                  orderData.customer_id !== null

      // Check if distributor_id is valid (not null, undefined, or string "null")
      const hasValidDistributorId = orderData.distributor_id &&
                                     orderData.distributor_id !== "null" &&
                                     orderData.distributor_id !== null

      if (hasValidCustomerId) {
        console.log("Fetching customer data for:", orderData.customer_id)
        const { data: customerData, error: customerError } = await supabase
          .from("customers")
          .select("first_name, last_name, email, mobile_primary, company_name")
          .eq("id", orderData.customer_id)
          .single()

        console.log("Customer data:", { customerData, customerError })

        if (!customerError && customerData) {
          setCustomerInfo({
            name: `${customerData.first_name} ${customerData.last_name}`,
            email: customerData.email || "",
            phone: customerData.mobile_primary,
            company: customerData.company_name || undefined,
            type: "customer"
          })
        }
      } else if (hasValidDistributorId) {
        console.log("Fetching distributor data for:", orderData.distributor_id)
        const { data: distributorData, error: distributorError } = await supabase
          .from("distributors")
          .select("name, email, phone_primary, company_name")
          .eq("id", orderData.distributor_id)
          .single()

        console.log("Distributor data:", { distributorData, distributorError })

        if (!distributorError && distributorData) {
          setCustomerInfo({
            name: distributorData.name,
            email: distributorData.email,
            phone: distributorData.phone_primary,
            company: distributorData.company_name,
            type: orderData.is_subdistributor ? "subdistributor" : "distributor"
          })
        }
      }
    } catch (error: unknown) {
      console.error("Error fetching order data:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch order data"
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId)
    if (!product) return

    const updatedItems = [...orderItems]
    const currentQuantity = updatedItems[index].quantity || 1

    // Calculate totals with product details
    const subtotal = currentQuantity * product.customer_price
    const discountAmount = 0
    const netAmount = subtotal - discountAmount
    const gstAmount = (netAmount * (product.gst_percentage || 0)) / 100
    const cgst = gstAmount / 2
    const sgst = gstAmount / 2
    const total = netAmount + gstAmount

    updatedItems[index] = {
      ...updatedItems[index],
      product_id: product.id,
      product_name: product.name,
      product_sku: product.sku || "",
      unit_price: product.customer_price,
      hsn_code: product.hsn_code || "",
      gst_percentage: product.gst_percentage || 0,
      quantity: currentQuantity,
      discount_percent: 0,
      discount_amount: discountAmount,
      gst_amount: gstAmount,
      cgst_amount: cgst,
      sgst_amount: sgst,
      igst_amount: 0,
      subtotal: subtotal,
      total: total,
    }

    setOrderItems(updatedItems)
    recalculateOrderTotals(updatedItems)
  }

  const handleItemChange = (index: number, field: keyof OrderItem, value: string | number) => {
    const updatedItems = [...orderItems]
    updatedItems[index] = { ...updatedItems[index], [field]: value }

    // Recalculate item totals
    const item = updatedItems[index]
    const subtotal = item.quantity * item.unit_price
    const discountAmount = (subtotal * item.discount_percent) / 100
    const netAmount = subtotal - discountAmount
    const gstAmount = (netAmount * item.gst_percentage) / 100
    const cgst = gstAmount / 2
    const sgst = gstAmount / 2

    updatedItems[index].subtotal = subtotal
    updatedItems[index].discount_amount = discountAmount
    updatedItems[index].gst_amount = gstAmount
    updatedItems[index].cgst_amount = cgst
    updatedItems[index].sgst_amount = sgst
    updatedItems[index].total = netAmount + gstAmount

    setOrderItems(updatedItems)
    recalculateOrderTotals(updatedItems)
  }

  const handleItemTotalChange = (index: number, newTotal: number) => {
    if (newTotal < 0) return

    const updatedItems = [...orderItems]
    const item = updatedItems[index]
    const subtotal = item.quantity * item.unit_price

    // Work backwards from total to calculate net amount and discount
    // Total = Net Amount + GST Amount
    // Total = Net Amount + (Net Amount × GST% / 100)
    // Total = Net Amount × (1 + GST% / 100)
    // Net Amount = Total / (1 + GST% / 100)

    const gstMultiplier = 1 + (item.gst_percentage / 100)
    const netAmount = newTotal / gstMultiplier
    const discountAmount = subtotal - netAmount
    const gstAmount = netAmount * (item.gst_percentage / 100)
    const discountPercentage = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0

    updatedItems[index] = {
      ...item,
      discount_amount: discountAmount,
      discount_percent: discountPercentage,
      gst_amount: gstAmount,
      cgst_amount: gstAmount / 2,
      sgst_amount: gstAmount / 2,
      total: newTotal,
    }

    setOrderItems(updatedItems)
    recalculateOrderTotals(updatedItems)
  }

  const recalculateOrderTotals = (items: OrderItem[]) => {
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
    const totalDiscounts = items.reduce((sum, item) => sum + item.discount_amount, 0)
    const totalCgst = items.reduce((sum, item) => sum + item.cgst_amount, 0)
    const totalSgst = items.reduce((sum, item) => sum + item.sgst_amount, 0)
    const totalGst = totalCgst + totalSgst

    // Use actual item totals (which may have been manually edited)
    const itemsTotal = items.reduce((sum, item) => sum + item.total, 0)
    const total = itemsTotal + formData.shipping_charges

    setFormData(prev => ({
      ...prev,
      subtotal,
      discount_amount: totalDiscounts,
      cgst_amount: totalCgst,
      sgst_amount: totalSgst,
      gst_amount: totalGst,
      total_amount: total,
    }))
  }

  // Build full address from structured fields
  const buildFullAddress = (data: typeof formData) => {
    const addressParts = []
    if (data.shipping_room_number) addressParts.push(`Room: ${data.shipping_room_number}`)
    if (data.shipping_floor) addressParts.push(`Floor: ${data.shipping_floor}`)
    if (data.shipping_wing) addressParts.push(`Wing: ${data.shipping_wing}`)
    if (data.shipping_flat_number) addressParts.push(data.shipping_flat_number)
    if (data.shipping_floor_wing) addressParts.push(data.shipping_floor_wing)
    if (data.shipping_building_name) addressParts.push(data.shipping_building_name)
    if (data.shipping_street_area) addressParts.push(data.shipping_street_area)
    if (data.shipping_landmark) addressParts.push(`Near ${data.shipping_landmark}`)
    if (data.shipping_city) addressParts.push(data.shipping_city)
    if (data.shipping_state) addressParts.push(data.shipping_state)
    if (data.shipping_pincode) addressParts.push(data.shipping_pincode)
    return addressParts.join(", ")
  }

  // Update structured shipping field and rebuild full address
  const updateShippingField = (field: string, value: string) => {
    const newFormData = { ...formData, [field]: value }
    const fullAddress = buildFullAddress(newFormData)
    setFormData({ ...newFormData, shipping_full_address: fullAddress })
  }

  // Category filter helpers
  const parentCategories = categories.filter(cat => cat.parent_category_id === null)

  const subCategories = selectedCategory && selectedCategory !== "all"
    ? categories.filter(cat => cat.parent_category_id === selectedCategory)
    : []

  // Reset subcategory when parent category changes
  useEffect(() => {
    setSelectedSubCategory("all")
  }, [selectedCategory])

  // Filter products based on selected category/subcategory
  const filteredProducts = products.filter(product => {
    if (selectedCategory && selectedCategory !== "all" && product.parent_category_id !== selectedCategory) {
      return false
    }
    if (selectedSubCategory && selectedSubCategory !== "all" && product.sub_category_id !== selectedSubCategory) {
      return false
    }
    return true
  })

  const addOrderItem = () => {
    const newItem: OrderItem = {
      id: `temp-${Date.now()}`,
      order_id: orderId,
      product_id: null,
      product_name: "",
      product_sku: "",
      quantity: 1,
      unit_price: 0,
      discount_percent: 0,
      discount_amount: 0,
      hsn_code: "",
      gst_percentage: 0,
      gst_amount: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      subtotal: 0,
      total: 0,
    }
    setOrderItems([...orderItems, newItem])
  }

  const removeOrderItem = (index: number) => {
    const updatedItems = orderItems.filter((_, i) => i !== index)
    setOrderItems(updatedItems)
    recalculateOrderTotals(updatedItems)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      // Update order
      const { error: orderError } = await supabase
        .from("orders")
        .update({
          order_status: formData.order_status,
          payment_status: formData.payment_status,
          payment_method: formData.payment_method || null,
          transaction_id: formData.transaction_id || null,
          shipping_method: formData.shipping_method || null,
          tracking_number: formData.tracking_number || null,
          courier_partner: formData.courier_partner || null,
          order_date: formData.order_date ? new Date(formData.order_date).toISOString() : null,
          invoice_number_gst: formData.invoice_number_gst.trim() || null,
          invoice_number_non_gst: formData.invoice_number_non_gst.trim() || null,
          is_gst_invoice: formData.is_gst_invoice,
          expected_delivery_date: formData.expected_delivery_date || null,
          shipped_date: formData.shipped_date ? new Date(formData.shipped_date).toISOString() : null,
          delivered_date: formData.delivered_date ? new Date(formData.delivered_date).toISOString() : null,
          order_notes: formData.order_notes || null,
          customer_notes: formData.customer_notes || null,
          internal_notes: formData.internal_notes || null,
          is_priority: formData.is_priority,

          shipping_full_address: formData.shipping_full_address || null,
          shipping_room_number: formData.shipping_room_number || null,
          shipping_floor: formData.shipping_floor || null,
          shipping_wing: formData.shipping_wing || null,
          shipping_flat_number: formData.shipping_flat_number || null,
          shipping_floor_wing: formData.shipping_floor_wing || null,
          shipping_building_name: formData.shipping_building_name,
          shipping_street_area: formData.shipping_street_area,
          shipping_landmark: formData.shipping_landmark || null,
          shipping_pincode: formData.shipping_pincode,
          shipping_city: formData.shipping_city,
          shipping_state: formData.shipping_state,
          shipping_country: formData.shipping_country || null,

          billing_room_number: formData.billing_room_number || null,
          billing_floor: formData.billing_floor || null,
          billing_wing: formData.billing_wing || null,
          billing_flat_number: formData.billing_flat_number || null,
          billing_floor_wing: formData.billing_floor_wing || null,
          billing_building_name: formData.billing_building_name,
          billing_street_area: formData.billing_street_area,
          billing_landmark: formData.billing_landmark || null,
          billing_pincode: formData.billing_pincode,
          billing_city: formData.billing_city,
          billing_state: formData.billing_state,
          billing_country: formData.billing_country || null,

          subtotal: formData.subtotal,
          discount_amount: formData.discount_amount,
          tax_amount: formData.tax_amount,
          gst_amount: formData.gst_amount,
          cgst_amount: formData.cgst_amount,
          sgst_amount: formData.sgst_amount,
          igst_amount: formData.igst_amount,
          shipping_charges: formData.shipping_charges,
          total_amount: formData.total_amount,

          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)

      if (orderError) throw orderError

      // Delete items that were removed
      const itemIdsToKeep = orderItems.filter(item => !item.id.startsWith('temp-')).map(item => item.id)

      if (itemIdsToKeep.length > 0) {
        // Only delete if there are items to keep (avoid deleting all items)
        const { error: deleteError } = await supabase
          .from("order_items")
          .delete()
          .eq("order_id", orderId)
          .not("id", "in", `(${itemIdsToKeep.join(',')})`)

        if (deleteError) {
          console.error("Error deleting removed items:", deleteError)
          // Don't throw, continue with updates
        }
      } else {
        // If no existing items to keep, delete all order items
        const { error: deleteError } = await supabase
          .from("order_items")
          .delete()
          .eq("order_id", orderId)

        if (deleteError) {
          console.error("Error deleting all items:", deleteError)
        }
      }

      // Update or insert order items
      for (const item of orderItems) {
        if (item.id.startsWith('temp-')) {
          // Insert new item
          const { id, ...itemData } = item
          const { error: insertError } = await supabase
            .from("order_items")
            .insert({ ...itemData, order_id: orderId })

          if (insertError) throw insertError
        } else {
          // Update existing item
          const { error: updateError } = await supabase
            .from("order_items")
            .update({
              product_name: item.product_name,
              product_sku: item.product_sku,
              quantity: item.quantity,
              unit_price: item.unit_price,
              discount_percent: item.discount_percent,
              discount_amount: item.discount_amount,
              hsn_code: item.hsn_code,
              gst_percentage: item.gst_percentage,
              gst_amount: item.gst_amount,
              cgst_amount: item.cgst_amount,
              sgst_amount: item.sgst_amount,
              igst_amount: item.igst_amount,
              subtotal: item.subtotal,
              total: item.total,
            })
            .eq("id", item.id)

          if (updateError) throw updateError
        }
      }

      // Stock adjustment logic for customer orders only
      if (order) {
        // Determine if this is a customer order (not distributor, subdistributor, or retailer)
        const isDistributorOrder = order.is_distributor || order.distributor_id !== null
        const isSubdistributorOrder = order.is_subdistributor
        const isRetailerOrder = order.retailer_id !== null
        const isCustomerOrder = !isDistributorOrder && !isSubdistributorOrder && !isRetailerOrder && order.customer_id !== null

        console.log("Order type check:", {
          isCustomerOrder,
          isDistributorOrder,
          isSubdistributorOrder,
          isRetailerOrder,
          customer_id: order.customer_id,
          distributor_id: order.distributor_id,
          retailer_id: order.retailer_id,
          source_godown_id: order.source_godown_id
        })

        if (isCustomerOrder && order.source_godown_id) {
          console.log("Adjusting warehouse stock for customer order edits...")

          // Handle removed items - restore stock
          const removedItems = originalOrderItems.filter(
            originalItem => !orderItems.find(item => item.id === originalItem.id)
          )

          for (const removedItem of removedItems) {
            if (!removedItem.product_id) continue

            // Get the stock inventory ID for this product
            const { data: inventoryData, error: inventoryError } = await supabase
              .from("stock_inventory")
              .select("id")
              .eq("product_id", removedItem.product_id)
              .single()

            if (inventoryError) {
              console.error(`Error fetching stock inventory for removed item:`, inventoryError)
              toast.warning(`Failed to restore stock for removed item: ${removedItem.product_name}`)
              continue
            }

            // Restore stock to warehouse
            const { error: incrementError } = await supabase.rpc(
              "increment_warehouse_stock",
              {
                p_inventory_id: inventoryData.id,
                p_warehouse_id: order.source_godown_id,
                p_quantity: removedItem.quantity
              }
            )

            if (incrementError) {
              console.error(`Error restoring stock for ${removedItem.product_name}:`, incrementError)
              toast.warning(`Failed to restore stock for ${removedItem.product_name}`)
            } else {
              console.log(`Restored ${removedItem.quantity} units of ${removedItem.product_name} to warehouse`)
            }
          }

          // Handle quantity changes for existing items
          for (const currentItem of orderItems) {
            if (currentItem.id.startsWith('temp-')) {
              // New item - decrement stock
              if (!currentItem.product_id) continue

              const { data: inventoryData, error: inventoryError } = await supabase
                .from("stock_inventory")
                .select("id")
                .eq("product_id", currentItem.product_id)
                .single()

              if (inventoryError) {
                console.error(`Error fetching stock inventory for new item:`, inventoryError)
                toast.warning(`Failed to update stock for new item: ${currentItem.product_name}`)
                continue
              }

              const { error: decrementError } = await supabase.rpc(
                "decrement_warehouse_stock",
                {
                  p_inventory_id: inventoryData.id,
                  p_warehouse_id: order.source_godown_id,
                  p_quantity: currentItem.quantity
                }
              )

              if (decrementError) {
                console.error(`Error decrementing stock for ${currentItem.product_name}:`, decrementError)
                toast.warning(`Failed to update stock for ${currentItem.product_name}`)
              } else {
                console.log(`Decremented ${currentItem.quantity} units of ${currentItem.product_name} from warehouse`)
              }
            } else {
              // Existing item - check for product change or quantity change
              const originalItem = originalOrderItems.find(item => item.id === currentItem.id)
              if (!originalItem || !currentItem.product_id) continue

              // Check if product was changed
              const productChanged = originalItem.product_id !== currentItem.product_id

              if (productChanged) {
                // Product was changed - restore stock for old product and decrement stock for new product
                console.log(`Product changed from ${originalItem.product_name} to ${currentItem.product_name}`)

                // Restore stock for the old product
                if (originalItem.product_id) {
                  const { data: oldInventoryData, error: oldInventoryError } = await supabase
                    .from("stock_inventory")
                    .select("id")
                    .eq("product_id", originalItem.product_id)
                    .single()

                  if (!oldInventoryError && oldInventoryData) {
                    const { error: incrementError } = await supabase.rpc(
                      "increment_warehouse_stock",
                      {
                        p_inventory_id: oldInventoryData.id,
                        p_warehouse_id: order.source_godown_id,
                        p_quantity: originalItem.quantity
                      }
                    )

                    if (incrementError) {
                      console.error(`Error restoring stock for ${originalItem.product_name}:`, incrementError)
                      toast.warning(`Failed to restore stock for ${originalItem.product_name}`)
                    } else {
                      console.log(`Restored ${originalItem.quantity} units of ${originalItem.product_name} to warehouse`)
                    }
                  }
                }

                // Decrement stock for the new product
                const { data: newInventoryData, error: newInventoryError } = await supabase
                  .from("stock_inventory")
                  .select("id")
                  .eq("product_id", currentItem.product_id)
                  .single()

                if (newInventoryError) {
                  console.error(`Error fetching stock inventory for new product:`, newInventoryError)
                  toast.warning(`Failed to update stock for ${currentItem.product_name}`)
                  continue
                }

                const { error: decrementError } = await supabase.rpc(
                  "decrement_warehouse_stock",
                  {
                    p_inventory_id: newInventoryData.id,
                    p_warehouse_id: order.source_godown_id,
                    p_quantity: currentItem.quantity
                  }
                )

                if (decrementError) {
                  console.error(`Error decrementing stock for ${currentItem.product_name}:`, decrementError)
                  toast.warning(`Failed to update stock for ${currentItem.product_name}`)
                } else {
                  console.log(`Decremented ${currentItem.quantity} units of ${currentItem.product_name} from warehouse`)
                }
              } else {
                // Same product - check for quantity change
                const quantityDiff = currentItem.quantity - originalItem.quantity

                if (quantityDiff !== 0) {
                const { data: inventoryData, error: inventoryError } = await supabase
                  .from("stock_inventory")
                  .select("id")
                  .eq("product_id", currentItem.product_id)
                  .single()

                if (inventoryError) {
                  console.error(`Error fetching stock inventory:`, inventoryError)
                  toast.warning(`Failed to update stock for ${currentItem.product_name}`)
                  continue
                }

                if (quantityDiff > 0) {
                  // Quantity increased - decrement stock
                  const { error: decrementError } = await supabase.rpc(
                    "decrement_warehouse_stock",
                    {
                      p_inventory_id: inventoryData.id,
                      p_warehouse_id: order.source_godown_id,
                      p_quantity: quantityDiff
                    }
                  )

                  if (decrementError) {
                    console.error(`Error decrementing stock for ${currentItem.product_name}:`, decrementError)
                    toast.warning(`Failed to update stock for ${currentItem.product_name}`)
                  } else {
                    console.log(`Decremented ${quantityDiff} units of ${currentItem.product_name} from warehouse`)
                  }
                } else {
                  // Quantity decreased - increment stock
                  const { error: incrementError } = await supabase.rpc(
                    "increment_warehouse_stock",
                    {
                      p_inventory_id: inventoryData.id,
                      p_warehouse_id: order.source_godown_id,
                      p_quantity: Math.abs(quantityDiff)
                    }
                  )

                  if (incrementError) {
                    console.error(`Error incrementing stock for ${currentItem.product_name}:`, incrementError)
                    toast.warning(`Failed to restore stock for ${currentItem.product_name}`)
                  } else {
                    console.log(`Restored ${Math.abs(quantityDiff)} units of ${currentItem.product_name} to warehouse`)
                  }
                }
                }
              }
            }
          }
        }
      }

      toast.success("Order updated successfully")
      router.push(`/dashboard/orders/${orderId}`)
    } catch (error: unknown) {
      console.error("Error updating order:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to update order"
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Edit Order</h1>
        <p>Loading...</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Order Not Found</h1>
        <Button onClick={() => router.push("/dashboard/orders")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Orders
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/dashboard/orders/${orderId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Edit Order {order.order_number}</h1>
            <p className="text-muted-foreground">Update order details, addresses, and items</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/dashboard/orders/${orderId}`)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving} size="lg">
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Customer/Distributor Information */}
      {customerInfo && (
        <div className="rounded-lg border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="text-lg font-semibold">{customerInfo.name}</h3>
                  {customerInfo.company && (
                    <p className="text-sm text-muted-foreground">{customerInfo.company}</p>
                  )}
                </div>
                <Badge variant={customerInfo.type === "customer" ? "default" : customerInfo.type === "distributor" ? "secondary" : "outline"}>
                  {customerInfo.type === "customer" ? "Customer" : customerInfo.type === "distributor" ? "Distributor" : "Subdistributor"}
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-4 text-sm">
                {customerInfo.phone && (
                  <span className="text-muted-foreground">📱 {customerInfo.phone}</span>
                )}
                {customerInfo.email && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">✉️ {customerInfo.email}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle>Order Items</CardTitle>
                    <CardDescription>Manage products in this order</CardDescription>
                  </div>
                </div>
                <Button type="button" onClick={addOrderItem} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Category Filters */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-muted/50 rounded-lg border">
                <div className="space-y-2">
                  <Label htmlFor="categoryFilter" className="flex items-center gap-2 text-sm font-medium">
                    <Filter className="h-4 w-4" />
                    Filter by Category
                  </Label>
                  <Select value={selectedCategory || "all"} onValueChange={setSelectedCategory}>
                    <SelectTrigger id="categoryFilter">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {parentCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.category_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subCategoryFilter" className="flex items-center gap-2 text-sm font-medium">
                    <Filter className="h-4 w-4" />
                    Filter by Sub-Category
                  </Label>
                  <Select
                    value={selectedSubCategory || "all"}
                    onValueChange={setSelectedSubCategory}
                    disabled={!selectedCategory || selectedCategory === "all" || subCategories.length === 0}
                  >
                    <SelectTrigger id="subCategoryFilter">
                      <SelectValue placeholder="All Sub-Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sub-Categories</SelectItem>
                      {subCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.category_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Product</TableHead>
                      <TableHead className="w-[130px] text-center">Quantity</TableHead>
                      <TableHead className="w-[120px] text-right">Unit Price</TableHead>
                      <TableHead className="w-[100px] text-right">Disc %</TableHead>
                      <TableHead className="w-[100px] text-right">GST %</TableHead>
                      <TableHead className="w-[130px] text-right">Total</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          No items in this order. Click &quot;Add Item&quot; to add products.
                        </TableCell>
                      </TableRow>
                    ) : (
                      orderItems.map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Select
                              value={item.product_id || ""}
                              onValueChange={(value) => handleProductSelect(index, value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select product">
                                  {item.product_name || "Select product"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {filteredProducts.map((product) => (
                                  <SelectItem key={product.id} value={product.id}>
                                    {product.name} - ₹{product.customer_price}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                disabled={item.quantity <= 1}
                                onClick={() => handleItemChange(index, 'quantity', Math.max(1, item.quantity - 1))}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                                className="h-8 w-14 text-center"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleItemChange(index, 'quantity', item.quantity + 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              value={item.unit_price}
                              onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              className="h-8 text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              max="100"
                              value={item.discount_percent}
                              onChange={(e) => handleItemChange(index, 'discount_percent', parseFloat(e.target.value) || 0)}
                              className="h-8 text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              max="100"
                              value={item.gst_percentage}
                              onChange={(e) => handleItemChange(index, 'gst_percentage', parseFloat(e.target.value) || 0)}
                              className="h-8 text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              value={item.total}
                              onChange={(e) => handleItemTotalChange(index, parseFloat(e.target.value) || 0)}
                              className="h-8 text-right font-medium"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removeOrderItem(index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Order Details Tabs */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Order Details</CardTitle>
                  <CardDescription>Manage payment, shipping, and notes</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="payment" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="payment">
                    <IndianRupee className="mr-2 h-4 w-4" />
                    Payment
                  </TabsTrigger>
                  <TabsTrigger value="shipping">
                    <Truck className="mr-2 h-4 w-4" />
                    Shipping
                  </TabsTrigger>
                  <TabsTrigger value="notes">
                    <FileText className="mr-2 h-4 w-4" />
                    Notes
                  </TabsTrigger>
                </TabsList>

                {/* Payment Tab */}
                <TabsContent value="payment" className="space-y-4 mt-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="order_status">Order Status *</Label>
                      <Select
                        value={formData.order_status}
                        onValueChange={(value) =>
                          setFormData({ ...formData, order_status: value })
                        }
                        required
                      >
                        <SelectTrigger id="order_status">
                          <SelectValue placeholder="Select order status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">📋 Pending</SelectItem>
                          <SelectItem value="processing">⚙️ Processing</SelectItem>
                          <SelectItem value="delivered">🚚 Delivered</SelectItem>
                          <SelectItem value="cancelled">❌ Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="payment_status">Payment Status *</Label>
                      <Select
                        value={formData.payment_status}
                        onValueChange={(value) =>
                          setFormData({ ...formData, payment_status: value })
                        }
                        required
                      >
                        <SelectTrigger id="payment_status">
                          <SelectValue placeholder="Select payment status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">⏳ Pending</SelectItem>
                          <SelectItem value="completed">✅ Completed</SelectItem>
                          <SelectItem value="failed">❌ Failed</SelectItem>
                          <SelectItem value="refunded">🔄 Refunded</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="payment_method">Payment Method</Label>
                      <Select
                        value={formData.payment_method || ""}
                        onValueChange={(value) =>
                          setFormData({ ...formData, payment_method: value })
                        }
                      >
                        <SelectTrigger id="payment_method">
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">💵 Cash</SelectItem>
                          <SelectItem value="card">💳 Card</SelectItem>
                          <SelectItem value="upi">📱 UPI</SelectItem>
                          <SelectItem value="bank_transfer">🏦 Bank Transfer</SelectItem>
                          <SelectItem value="cheque">📝 Cheque</SelectItem>
                          <SelectItem value="cod">🚚 COD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Order Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !formData.order_date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.order_date ? format(new Date(formData.order_date), "dd MMM yyyy") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={formData.order_date ? new Date(formData.order_date) : undefined}
                            onSelect={(date) =>
                              setFormData({ ...formData, order_date: date ? format(date, "yyyy-MM-dd") : "" })
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="transaction_id">Transaction ID</Label>
                      <Input
                        id="transaction_id"
                        value={formData.transaction_id}
                        onChange={(e) =>
                          setFormData({ ...formData, transaction_id: e.target.value })
                        }
                        placeholder="Enter transaction ID"
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shipping_charges">Shipping Charges</Label>
                      <Input
                        id="shipping_charges"
                        type="number"
                        step="any"
                        min="0"
                        value={formData.shipping_charges}
                        onChange={(e) => {
                          const newShipping = parseFloat(e.target.value) || 0
                          setFormData(prev => ({
                            ...prev,
                            shipping_charges: newShipping,
                            total_amount: prev.subtotal - prev.discount_amount + prev.gst_amount + newShipping
                          }))
                        }}
                      />
                    </div>
                  </div>

                  <div className="rounded-md border p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="is_gst_invoice" className="cursor-pointer font-medium">
                          GST Invoice
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Toggle between GST and non-GST invoice numbering
                        </p>
                      </div>
                      <Switch
                        id="is_gst_invoice"
                        checked={formData.is_gst_invoice}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, is_gst_invoice: checked })
                        }
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="invoice_number_gst">GST Invoice Number</Label>
                        <Input
                          id="invoice_number_gst"
                          value={formData.invoice_number_gst}
                          onChange={(e) =>
                            setFormData({ ...formData, invoice_number_gst: e.target.value })
                          }
                          placeholder="e.g., KP001/2025-26"
                          className="font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="invoice_number_non_gst">Non-GST Invoice Number</Label>
                        <Input
                          id="invoice_number_non_gst"
                          value={formData.invoice_number_non_gst}
                          onChange={(e) =>
                            setFormData({ ...formData, invoice_number_non_gst: e.target.value })
                          }
                          placeholder="e.g., A123"
                          className="font-mono"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Invoice numbers are auto-generated on order creation. Edit manually only when necessary — ensure uniqueness.
                    </p>
                  </div>

                  <div className="rounded-md border p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      <Label htmlFor="is_priority" className="cursor-pointer font-medium">
                        Priority Order
                      </Label>
                    </div>
                    <Switch
                      id="is_priority"
                      checked={formData.is_priority}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, is_priority: checked })
                      }
                    />
                  </div>
                </TabsContent>

                {/* Shipping Tab */}
                <TabsContent value="shipping" className="space-y-4 mt-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="shipping_method">Shipping Method</Label>
                      <Input
                        id="shipping_method"
                        value={formData.shipping_method}
                        onChange={(e) =>
                          setFormData({ ...formData, shipping_method: e.target.value })
                        }
                        placeholder="e.g., Standard, Express"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="courier_partner">Courier Partner</Label>
                      <Input
                        id="courier_partner"
                        value={formData.courier_partner}
                        onChange={(e) =>
                          setFormData({ ...formData, courier_partner: e.target.value })
                        }
                        placeholder="e.g., BlueDart, Delhivery"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tracking_number">Tracking Number</Label>
                      <Input
                        id="tracking_number"
                        value={formData.tracking_number}
                        onChange={(e) =>
                          setFormData({ ...formData, tracking_number: e.target.value })
                        }
                        placeholder="Enter tracking number"
                        className="font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Expected Delivery Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !formData.expected_delivery_date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.expected_delivery_date ? format(new Date(formData.expected_delivery_date), "dd MMM yyyy") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={formData.expected_delivery_date ? new Date(formData.expected_delivery_date) : undefined}
                            onSelect={(date) =>
                              setFormData({ ...formData, expected_delivery_date: date ? format(date, "yyyy-MM-dd") : "" })
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label>Shipped Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !formData.shipped_date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.shipped_date ? format(new Date(formData.shipped_date), "dd MMM yyyy") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={formData.shipped_date ? new Date(formData.shipped_date) : undefined}
                            onSelect={(date) =>
                              setFormData({ ...formData, shipped_date: date ? format(date, "yyyy-MM-dd") : "" })
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label>Delivered Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !formData.delivered_date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.delivered_date ? format(new Date(formData.delivered_date), "dd MMM yyyy") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={formData.delivered_date ? new Date(formData.delivered_date) : undefined}
                            onSelect={(date) =>
                              setFormData({ ...formData, delivered_date: date ? format(date, "yyyy-MM-dd") : "" })
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </TabsContent>

                {/* Notes Tab */}
                <TabsContent value="notes" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer_notes">Customer Notes</Label>
                    <Textarea
                      id="customer_notes"
                      value={formData.customer_notes}
                      onChange={(e) =>
                        setFormData({ ...formData, customer_notes: e.target.value })
                      }
                      placeholder="Notes from the customer"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="order_notes">Order Notes</Label>
                    <Textarea
                      id="order_notes"
                      value={formData.order_notes}
                      onChange={(e) => setFormData({ ...formData, order_notes: e.target.value })}
                      placeholder="General notes about the order (visible to all)"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="internal_notes">Internal Notes</Label>
                    <Textarea
                      id="internal_notes"
                      value={formData.internal_notes}
                      onChange={(e) =>
                        setFormData({ ...formData, internal_notes: e.target.value })
                      }
                      placeholder="Internal notes (not visible to customers)"
                      rows={3}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Shipping Address */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Shipping Address</CardTitle>
                  <CardDescription>Update shipping address details</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Full Address Display/Edit */}
              <div className="space-y-2">
                <Label htmlFor="shipping_full_address">Full Shipping Address</Label>
                <Textarea
                  id="shipping_full_address"
                  value={formData.shipping_full_address}
                  onChange={(e) => setFormData({ ...formData, shipping_full_address: e.target.value })}
                  placeholder="Complete shipping address in one line"
                  rows={3}
                  className="font-medium"
                />
                <p className="text-xs text-muted-foreground">
                  This is the complete address that will be used for delivery. You can edit it directly or use the structured fields below.
                </p>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or edit structured fields
                  </span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="shipping_room_number">Room Number</Label>
                  <Input
                    id="shipping_room_number"
                    value={formData.shipping_room_number}
                    onChange={(e) => updateShippingField('shipping_room_number', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipping_floor">Floor</Label>
                  <Input
                    id="shipping_floor"
                    value={formData.shipping_floor}
                    onChange={(e) => updateShippingField('shipping_floor', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipping_wing">Wing</Label>
                  <Input
                    id="shipping_wing"
                    value={formData.shipping_wing}
                    onChange={(e) => updateShippingField('shipping_wing', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="shipping_building_name">Building Name</Label>
                  <Input
                    id="shipping_building_name"
                    value={formData.shipping_building_name}
                    onChange={(e) => updateShippingField('shipping_building_name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipping_street_area">Street/Area</Label>
                  <Input
                    id="shipping_street_area"
                    value={formData.shipping_street_area}
                    onChange={(e) => updateShippingField('shipping_street_area', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="shipping_landmark">Landmark</Label>
                  <Input
                    id="shipping_landmark"
                    value={formData.shipping_landmark}
                    onChange={(e) => updateShippingField('shipping_landmark', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipping_pincode">Pincode</Label>
                  <Input
                    id="shipping_pincode"
                    value={formData.shipping_pincode}
                    onChange={(e) => updateShippingField('shipping_pincode', e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="shipping_city">City</Label>
                  <Input
                    id="shipping_city"
                    value={formData.shipping_city}
                    onChange={(e) => updateShippingField('shipping_city', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipping_state">State</Label>
                  <Input
                    id="shipping_state"
                    value={formData.shipping_state}
                    onChange={(e) => updateShippingField('shipping_state', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipping_country">Country</Label>
                  <Input
                    id="shipping_country"
                    value={formData.shipping_country}
                    onChange={(e) => updateShippingField('shipping_country', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Billing Address */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Billing Address</CardTitle>
                  <CardDescription>Update billing address details</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="billing_room_number">Room Number</Label>
                  <Input
                    id="billing_room_number"
                    value={formData.billing_room_number}
                    onChange={(e) => setFormData({ ...formData, billing_room_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billing_floor">Floor</Label>
                  <Input
                    id="billing_floor"
                    value={formData.billing_floor}
                    onChange={(e) => setFormData({ ...formData, billing_floor: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billing_wing">Wing</Label>
                  <Input
                    id="billing_wing"
                    value={formData.billing_wing}
                    onChange={(e) => setFormData({ ...formData, billing_wing: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="billing_building_name">Building Name</Label>
                  <Input
                    id="billing_building_name"
                    value={formData.billing_building_name}
                    onChange={(e) => setFormData({ ...formData, billing_building_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billing_street_area">Street/Area</Label>
                  <Input
                    id="billing_street_area"
                    value={formData.billing_street_area}
                    onChange={(e) => setFormData({ ...formData, billing_street_area: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="billing_landmark">Landmark</Label>
                  <Input
                    id="billing_landmark"
                    value={formData.billing_landmark}
                    onChange={(e) => setFormData({ ...formData, billing_landmark: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billing_pincode">Pincode</Label>
                  <Input
                    id="billing_pincode"
                    value={formData.billing_pincode}
                    onChange={(e) => setFormData({ ...formData, billing_pincode: e.target.value })}
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="billing_city">City</Label>
                  <Input
                    id="billing_city"
                    value={formData.billing_city}
                    onChange={(e) => setFormData({ ...formData, billing_city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billing_state">State</Label>
                  <Input
                    id="billing_state"
                    value={formData.billing_state}
                    onChange={(e) => setFormData({ ...formData, billing_state: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billing_country">Country</Label>
                  <Input
                    id="billing_country"
                    value={formData.billing_country}
                    onChange={(e) => setFormData({ ...formData, billing_country: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <IndianRupee className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Order Summary</CardTitle>
                  <CardDescription>Financial breakdown of the order</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Items ({orderItems.length})</span>
                  <span className="text-base font-medium">₹{formData.subtotal.toFixed(2)}</span>
                </div>
                {formData.discount_amount > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Item Discounts</span>
                    <span>-₹{formData.discount_amount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">CGST</span>
                  <span>₹{formData.cgst_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">SGST</span>
                  <span>₹{formData.sgst_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total GST</span>
                  <span>₹{formData.gst_amount.toFixed(2)}</span>
                </div>
                {formData.shipping_charges > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping Charges</span>
                    <span>₹{formData.shipping_charges.toFixed(2)}</span>
                  </div>
                )}

                <Separator />

                <div className="flex justify-between items-center pt-1">
                  <span className="text-base font-bold">Total Amount</span>
                  <span className="font-bold text-2xl text-primary">₹{formData.total_amount.toFixed(2)}</span>
                </div>

                {/* Status Badges */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {formData.is_priority && (
                    <Badge variant="destructive">
                      <AlertCircle className="mr-1 h-3 w-3" />
                      Priority Order
                    </Badge>
                  )}
                  <Badge variant="outline">
                    Order: {formData.order_status || "N/A"}
                  </Badge>
                  <Badge variant="outline">
                    Payment: {formData.payment_status || "N/A"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bottom Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/dashboard/orders/${orderId}`)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving} size="lg">
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
