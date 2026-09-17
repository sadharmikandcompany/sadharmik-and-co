"use client"

import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useUserRole } from "@/hooks/use-user-role"
import { useEntityData } from "@/hooks/use-entity-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  Phone,
  Award,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Check,
  FileText,
  Wallet,
  Warehouse,
  Command as CommandIcon,
  CornerDownLeft,
  UserPlus,
} from "lucide-react"
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type Product = {
  id: string
  name: string
  brand: string | null
  customer_price: number
  customer_sale_price: number | null
  customer_discount_percent: number | null
  retailer_price: number | null
  retailer_sale_price: number | null
  retailer_discount_percent: number | null
  stock: number
  images: string[]
  hsn_code: string | null
  gst_percentage: number | null
  is_active: boolean
  parent_category_id: string | null
  sub_category_id: string | null
}

// POS sells at the retailer price. When a product has no retailer price set
// (NULL or 0), fall back to the customer (retail) pricing block so nothing
// ever shows ₹0 or blocks a sale.
function getPosPricing(product: Product): { regular: number; sale: number | null } {
  const hasRetailer = product.retailer_price != null && product.retailer_price > 0
  const regular = hasRetailer ? product.retailer_price! : product.customer_price
  const saleRaw = hasRetailer ? product.retailer_sale_price : product.customer_sale_price
  const sale = saleRaw != null && saleRaw > 0 ? saleRaw : null
  return { regular, sale }
}

type Category = {
  id: string
  category_name: string
  parent_category_id: string | null
}

type Customer = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  mobile_primary: string
  mobile_secondary_1: string | null
  whatsapp_number: string | null
  vip_number: string | null
  is_vip: boolean
  shipping_building_name: string
  shipping_street_area: string
  shipping_city: string
  shipping_state: string
  shipping_pincode: string
}

type CartItem = {
  product: Product
  quantity: number
  price: number
  discount: number
  gst: number
}

type Warehouse = {
  id: string
  name: string
  godown_code: string
  godown_type: string
  is_active: boolean
}

export default function POSPage() {
  const { role, loading: roleLoading } = useUserRole()
  const { entityId, entityType, loading: entityLoading } = useEntityData()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [factoryWarehouse, setFactoryWarehouse] = useState<Warehouse | null>(null)
  const [retailerWarehouse, setRetailerWarehouse] = useState<Warehouse | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)
  const [customerSearchTerm, setCustomerSearchTerm] = useState("")
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<string>("cash")
  const [processingOrder, setProcessingOrder] = useState(false)
  const [productSearchRef, setProductSearchRef] = useState<HTMLInputElement | null>(null)
  const [newCustomerDialogOpen, setNewCustomerDialogOpen] = useState(false)
  const [savingCustomer, setSavingCustomer] = useState(false)
  const [customerFormData, setCustomerFormData] = useState({
    first_name: "",
    last_name: "",
    mobile_primary: "",
    whatsapp_number: "",
    whatsapp_same_as_primary: true,
    shipping_building_name: "",
    shipping_street_area: "",
    shipping_city: "",
    shipping_state: "",
    shipping_pincode: "",
  })

  useEffect(() => {
    if (!roleLoading && !entityLoading) {
      fetchData()
    }
  }, [role, roleLoading, entityId, entityLoading])

  // Load saved warehouse from localStorage (only if no auto-select)
  useEffect(() => {
    if (role !== 'admin' && role !== 'retailer' && !selectedWarehouse) {
      const savedWarehouse = localStorage.getItem("pos_selected_warehouse")
      if (savedWarehouse) {
        setSelectedWarehouse(savedWarehouse)
      }
    }
  }, [role, selectedWarehouse])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchCustomers(customerSearchTerm)
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [customerSearchTerm])

  // Auto-focus on product search field when page loads
  useEffect(() => {
    if (productSearchRef) {
      productSearchRef.focus()
    }
  }, [productSearchRef])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl/Cmd modifier key
      const isMod = e.ctrlKey || e.metaKey

      // Ctrl+K / Cmd+K - Open customer search
      if (isMod && e.key === "k") {
        e.preventDefault()
        if (cart.length > 0) {
          setCustomerSearchOpen(true)
        }
      }

      // Ctrl+Enter / Cmd+Enter - Proceed to checkout
      if (isMod && e.key === "Enter") {
        e.preventDefault()
        if (selectedCustomer && cart.length > 0 && !checkoutDialogOpen) {
          setCheckoutDialogOpen(true)
        }
      }

      // Escape - Close customer search popover
      if (e.key === "Escape" && customerSearchOpen) {
        setCustomerSearchOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [cart, selectedCustomer, checkoutDialogOpen, customerSearchOpen])

  // Save selected warehouse to localStorage
  useEffect(() => {
    if (selectedWarehouse) {
      localStorage.setItem("pos_selected_warehouse", selectedWarehouse)
    }
  }, [selectedWarehouse])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .gt("stock", 0)
        .order("name")

      if (productsError) throw productsError

      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("category_name")

      if (categoriesError) throw categoriesError

      // Fetch warehouses/godowns based on user role
      if (role === 'admin') {
        // For admin, fetch company (factory) warehouse and auto-select it
        const { data: factoryData, error: factoryError } = await supabase
          .from("godowns")
          .select("id, name, godown_code, godown_type, is_active")
          .eq("is_active", true)
          .eq("godown_type", "company")
          .order("name")

        if (!factoryError && factoryData && factoryData.length > 0) {
          // Auto-select the first company warehouse
          setFactoryWarehouse(factoryData[0])
          setSelectedWarehouse(factoryData[0].id)
          setWarehouses(factoryData)
        } else {
          console.log("No company warehouse found for admin")
          // Fallback: fetch all warehouses if no company warehouse
          const { data: allWarehouses } = await supabase
            .from("godowns")
            .select("id, name, godown_code, godown_type, is_active")
            .eq("is_active", true)
            .order("name")
          setWarehouses(allWarehouses || [])
        }
      } else if (role === 'retailer' && entityId) {
        // For retailer, fetch their linked warehouse and auto-select it
        const { data: retailerWarehouseData, error: retailerWarehouseError } = await supabase
          .from("godowns")
          .select("id, name, godown_code, godown_type, is_active")
          .eq("is_active", true)
          .eq("retailer_id", entityId)
          .order("name")

        if (!retailerWarehouseError && retailerWarehouseData && retailerWarehouseData.length > 0) {
          // Auto-select retailer's warehouse
          setRetailerWarehouse(retailerWarehouseData[0])
          setSelectedWarehouse(retailerWarehouseData[0].id)
          setWarehouses(retailerWarehouseData)
        } else {
          console.log("No warehouse found for retailer, fetching all retailer warehouses")
          // Fallback: fetch all retailer type warehouses
          const { data: warehousesData } = await supabase
            .from("godowns")
            .select("id, name, godown_code, godown_type, is_active")
            .eq("is_active", true)
            .eq("godown_type", "retailer")
            .order("name")
          setWarehouses(warehousesData || [])
        }
      } else {
        // For other roles, fetch retailer type warehouses
        const { data: warehousesData, error: warehousesError } = await supabase
          .from("godowns")
          .select("id, name, godown_code, godown_type, is_active")
          .eq("is_active", true)
          .eq("godown_type", "retailer")
          .order("name")

        if (warehousesError) throw warehousesError
        setWarehouses(warehousesData || [])
      }

      setProducts(productsData || [])
      setCategories(categoriesData || [])
    } catch (error) {
      console.error("Error fetching data:", error)
      toast.error("Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  const searchCustomers = async (term: string) => {
    if (!term || term.length < 2) {
      setFilteredCustomers([])
      return
    }

    try {
      const searchTerm = `%${term.trim()}%`
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},mobile_primary.ilike.${searchTerm},mobile_secondary_1.ilike.${searchTerm},whatsapp_number.ilike.${searchTerm},vip_number.ilike.${searchTerm}`)
        .eq("is_active", true)
        .order("first_name")
        .limit(20)

      if (error) throw error
      setFilteredCustomers(data || [])
    } catch (error) {
      console.error("Error searching customers:", error)
      setFilteredCustomers([])
    }
  }

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer)
    setCustomerSearchOpen(false)
    setCustomerSearchTerm("")
    toast.success(`Customer selected: ${customer.first_name} ${customer.last_name}`)
  }

  const handleSaveNewCustomer = async () => {
    // Validate required fields
    if (!customerFormData.first_name.trim() || !customerFormData.last_name.trim()) {
      toast.error("First name and last name are required")
      return
    }

    if (customerFormData.mobile_primary.length !== 10) {
      toast.error("Mobile number must be exactly 10 digits")
      return
    }

    setSavingCustomer(true)
    try {
      const { data, error } = await supabase
        .from("customers")
        .insert([{
          first_name: customerFormData.first_name.trim(),
          last_name: customerFormData.last_name.trim(),
          mobile_primary: customerFormData.mobile_primary,
          whatsapp_number: customerFormData.whatsapp_same_as_primary
            ? customerFormData.mobile_primary
            : (customerFormData.whatsapp_number || null),
          whatsapp_same_as_primary: customerFormData.whatsapp_same_as_primary,
          shipping_building_name: customerFormData.shipping_building_name.trim(),
          shipping_street_area: customerFormData.shipping_street_area.trim(),
          shipping_city: customerFormData.shipping_city.trim(),
          shipping_state: customerFormData.shipping_state.trim(),
          shipping_pincode: customerFormData.shipping_pincode,
          shipping_country: "India",
          billing_same_as_shipping: true,
          billing_building_name: customerFormData.shipping_building_name.trim(),
          billing_street_area: customerFormData.shipping_street_area.trim(),
          billing_city: customerFormData.shipping_city.trim(),
          billing_state: customerFormData.shipping_state.trim(),
          billing_pincode: customerFormData.shipping_pincode,
          billing_country: "India",
          is_active: true,
        }])
        .select()
        .single()

      if (error) throw error

      toast.success("Customer created successfully!")

      // Select the new customer
      setSelectedCustomer(data)

      // Close dialog and reset form
      setNewCustomerDialogOpen(false)
      setCustomerFormData({
        first_name: "",
        last_name: "",
        mobile_primary: "",
        whatsapp_number: "",
        whatsapp_same_as_primary: true,
        shipping_building_name: "",
        shipping_street_area: "",
        shipping_city: "",
        shipping_state: "",
        shipping_pincode: "",
      })
    } catch (error) {
      console.error("Error creating customer:", error)
      toast.error("Failed to create customer")
    } finally {
      setSavingCustomer(false)
    }
  }

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.brand && product.brand.toLowerCase().includes(searchTerm.toLowerCase()))

    return matchesSearch
  })

  // Group products by category
  const groupedProducts = filteredProducts.reduce((acc, product) => {
    // Use parent category if available, otherwise use sub category, otherwise "Uncategorized"
    const categoryId = product.parent_category_id || product.sub_category_id || "uncategorized"

    if (!acc[categoryId]) {
      acc[categoryId] = []
    }
    acc[categoryId].push(product)
    return acc
  }, {} as Record<string, Product[]>)

  // Get category name helper
  const getCategoryName = (categoryId: string) => {
    if (categoryId === "uncategorized") return "Uncategorized"
    const category = categories.find(c => c.id === categoryId)
    return category?.category_name || "Unknown Category"
  }

  const addToCart = (product: Product) => {
    const existingItem = cart.find((item) => item.product.id === product.id)

    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        toast.error("Not enough stock available")
        return
      }
      updateQuantity(product.id, existingItem.quantity + 1)
    } else {
      // POS sells at the retailer price (falls back to customer price when unset).
      // Use sale price if available, otherwise the regular price.
      // discount_percent is NOT applied here - it represents the discount
      // already built into sale_price (from MRP).
      const { regular, sale } = getPosPricing(product)
      const price = sale || regular
      const discount = 0 // No additional discount by default in POS
      const gst = product.gst_percentage || 0

      setCart([
        ...cart,
        {
          product,
          quantity: 1,
          price,
          discount,
          gst,
        },
      ])
      toast.success(`${product.name} added to cart`)
    }
  }

  const updatePrice = (productId: string, newPrice: number) => {
    if (newPrice < 0) return
    setCart(cart.map((item) =>
      item.product.id === productId
        ? { ...item, price: newPrice }
        : item
    ))
  }

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId)
      return
    }

    const item = cart.find((i) => i.product.id === productId)
    if (item && newQuantity > item.product.stock) {
      toast.error("Not enough stock available")
      return
    }

    setCart(cart.map((item) =>
      item.product.id === productId
        ? { ...item, quantity: newQuantity }
        : item
    ))
  }

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId))
    toast.info("Item removed from cart")
  }

  // GST is INCLUDED in price, not added on top
  // Formula: GST Amount = (price * GST%) / (100 + GST%)
  const calculateItemTotal = (item: CartItem) => {
    const grossAmount = item.price * item.quantity
    const discountAmount = (grossAmount * item.discount) / 100
    const netAmount = grossAmount - discountAmount
    // GST is already included in price, so total = netAmount (no GST added)
    return netAmount
  }

  const calculateCartTotals = () => {
    let subtotal = 0
    let totalDiscount = 0
    let totalGST = 0

    cart.forEach((item) => {
      const grossAmount = item.price * item.quantity
      const discountAmount = (grossAmount * item.discount) / 100
      const netAmount = grossAmount - discountAmount

      // Extract GST from inclusive price: GST = (netAmount * GST%) / (100 + GST%)
      const gstAmount = item.gst > 0 ? (netAmount * item.gst) / (100 + item.gst) : 0

      subtotal += grossAmount
      totalDiscount += discountAmount
      totalGST += gstAmount
    })

    // Total = subtotal - discount (GST is already included)
    const total = subtotal - totalDiscount

    return { subtotal, totalDiscount, totalGST, total }
  }

  const handleCheckout = async () => {
    if (!selectedCustomer) {
      toast.error("Please select a customer")
      return
    }

    if (cart.length === 0) {
      toast.error("Cart is empty")
      return
    }

    if (!selectedWarehouse) {
      toast.error("Please select a warehouse")
      return
    }

    setProcessingOrder(true)
    try {
      const { subtotal, totalDiscount, totalGST, total } = calculateCartTotals()

      // Generate order number
      const orderNumber = `ORD-${Date.now()}`

      // Store address for POS orders (in-store pickup)
      const storeAddress = {
        building_name: "G2, Mahadev Nagar - A CHS Ltd, Nr Bank of Maharashtra, B P Road, Nr Mahadev Mandir",
        street_area: "Bhayandar (East)",
        city: "Bhayandar (East)",
        state: "Maharashtra",
        pincode: "101105",
      }

      // Create order and items via API route (handles retailer invoice prefix)
      const orderItems = cart.map((item) => {
        const itemSubtotal = item.price * item.quantity
        const discountAmount = (itemSubtotal * item.discount) / 100
        const taxableAmount = itemSubtotal - discountAmount
        const gstAmount = (taxableAmount * item.gst) / 100
        const itemTotal = taxableAmount + gstAmount

        return {
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: item.quantity,
          unit_price: item.price,
          discount_percent: item.discount,
          discount_amount: discountAmount,
          hsn_code: item.product.hsn_code,
          gst_percentage: item.gst,
          gst_amount: gstAmount,
          subtotal: itemSubtotal,
          total: itemTotal,
        }
      })

      const posResponse = await fetch("/api/orders/pos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: {
            order_number: orderNumber,
            customer_id: selectedCustomer.id,
            order_status: "confirmed",
            // Only "balance" is pending; cash, upi, card, cheque are all completed
            payment_status: paymentMethod === "balance" ? "pending" : "completed",
            payment_method: paymentMethod,
            source_godown_id: selectedWarehouse,
            source: "backend",
            shipping_building_name: storeAddress.building_name,
            shipping_street_area: storeAddress.street_area,
            shipping_city: storeAddress.city,
            shipping_state: storeAddress.state,
            shipping_pincode: storeAddress.pincode,
            billing_building_name: storeAddress.building_name,
            billing_street_area: storeAddress.street_area,
            billing_city: storeAddress.city,
            billing_state: storeAddress.state,
            billing_pincode: storeAddress.pincode,
            subtotal,
            discount_amount: totalDiscount,
            gst_amount: totalGST,
            total_amount: total,
          },
          items: orderItems,
          retailer_id: role === 'retailer' && entityId ? entityId : null,
        }),
      })

      const posResult = await posResponse.json()
      if (!posResponse.ok) throw new Error(posResult.error)
      const orderData = posResult.order

      // Update product stock
      for (const item of cart) {
        const { error: stockError } = await supabase
          .from("products")
          .update({ stock: item.product.stock - item.quantity })
          .eq("id", item.product.id)

        if (stockError) throw stockError
      }

      // For a retailer sale, also deduct from the retailer's own warehouse stock
      // (godown_stock) so /dashboard/my-stock reflects the sale.
      if (role === 'retailer' && entityId && selectedWarehouse) {
        for (const item of cart) {
          // Map the product to its stock_inventory row
          const { data: inventoryData, error: inventoryError } = await supabase
            .from("stock_inventory")
            .select("id")
            .eq("product_id", item.product.id)
            .maybeSingle()

          if (inventoryError || !inventoryData) {
            console.error(`No stock inventory for ${item.product.name}, warehouse stock not updated`, inventoryError)
            toast.warning(`Warehouse stock not updated for ${item.product.name}`)
            continue
          }

          // Read current warehouse stock for this retailer's godown
          const { data: warehouseStock } = await supabase
            .from("godown_stock")
            .select("quantity, reserved_quantity")
            .eq("godown_id", selectedWarehouse)
            .eq("stock_inventory_id", inventoryData.id)
            .maybeSingle()

          const currentQuantity = warehouseStock?.quantity || 0
          const currentReserved = warehouseStock?.reserved_quantity || 0
          const newQuantity = currentQuantity - item.quantity
          // reserved_quantity must be 0 when quantity is negative (reserved_logical constraint)
          const newReserved = newQuantity < 0 ? 0 : currentReserved

          // Upsert handles both existing and new stock records
          const { error: warehouseStockError } = await supabase
            .from("godown_stock")
            .upsert({
              godown_id: selectedWarehouse,
              stock_inventory_id: inventoryData.id,
              quantity: newQuantity,
              reserved_quantity: newReserved,
            }, {
              onConflict: 'godown_id,stock_inventory_id'
            })

          if (warehouseStockError) {
            console.error(`Error updating warehouse stock for ${item.product.name}:`, warehouseStockError)
            toast.warning(`Failed to update warehouse stock for ${item.product.name}`)
          }
        }
      }

      // Send WhatsApp notification to customer
      let whatsappSent = false
      try {
        const phoneNumber = selectedCustomer.whatsapp_number || selectedCustomer.mobile_primary
        const customerName = selectedCustomer.first_name || "Customer"

        const whatsappResponse = await fetch("/api/whatsapp/send-order-confirmation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customerName: customerName,
            orderNumber: orderNumber,
            mobileNumber: phoneNumber,
          }),
        })

        const whatsappResult = await whatsappResponse.json()

        if (whatsappResult.success) {
          console.log("WhatsApp notification sent successfully:", whatsappResult.messageId)
          whatsappSent = true
        } else {
          console.error("Failed to send WhatsApp notification:", whatsappResult.error)
        }
      } catch (whatsappError) {
        console.error("Error sending WhatsApp notification:", whatsappError)
      }

      // Show success message with WhatsApp status
      if (whatsappSent) {
        toast.success(`Order ${orderNumber} created successfully!`, {
          description: "WhatsApp notification sent to customer",
        })
      } else {
        toast.success(`Order ${orderNumber} created successfully!`, {
          description: "Order created (WhatsApp notification failed)",
        })
      }

      // Reset cart and close dialog
      setCart([])
      setSelectedCustomer(null)
      setCheckoutDialogOpen(false)
      setPaymentMethod("cash")

      // Refresh products to show updated stock
      fetchData()
    } catch (error) {
      console.error("Error creating order:", error)
      toast.error("Failed to create order")
    } finally {
      setProcessingOrder(false)
    }
  }

  const { subtotal, totalDiscount, totalGST, total } = calculateCartTotals()

  if (loading || roleLoading || entityLoading) {
    return (
      <div className="flex flex-col -m-6 h-[calc(100vh-4rem)] p-4">
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-3 md:gap-4 h-full overflow-hidden">
          <div className="lg:col-span-2 flex flex-col min-h-0 order-2 lg:order-1">
            <Card className="flex-1 flex flex-col overflow-hidden">
              <CardContent className="px-3 md:px-4 py-2 flex flex-col flex-1 space-y-3 md:space-y-4 overflow-hidden">
                <Skeleton className="h-10 md:h-11 w-full" />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3">
                  {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className="aspect-[3/4] w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-1 flex flex-col order-1 lg:order-2 max-h-[40vh] lg:max-h-none min-h-0">
            <Card className="flex-1 flex flex-col h-full overflow-hidden">
              <CardContent className="px-3 md:px-4 py-2 flex-1 flex flex-col gap-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          [data-sonner-toaster][data-y-position="bottom"] {
            display: none !important;
          }
          [data-sonner-toast] [data-content] {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 300px;
          }
          [data-sonner-toast] [data-title] {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        `
      }} />
      <div className="flex flex-col -m-6 h-[calc(100vh-4rem)] p-4">
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-3 md:gap-4 h-full p-0.5 -m-0.5">
        {/* Products Section */}
        <div className="lg:col-span-2 flex flex-col min-h-0 order-2 lg:order-1">
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardContent className="px-3 md:px-4 py-2 flex flex-col flex-1 space-y-3 md:space-y-4 overflow-hidden">
              <div className="flex flex-col sm:flex-row gap-2 md:gap-3 shrink-0">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={setProductSearchRef}
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10 md:h-11"
                  />
                </div>
              </div>

              {/* Product Grid - Grouped by Category */}
              <ScrollArea className="flex-1 min-h-0">
                <div className="pl-1 pt-1 pr-2 md:pr-4 pb-4">
                  {Object.entries(groupedProducts).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <Search className="h-5 w-5 opacity-50" />
                      </div>
                      <p className="text-sm font-medium text-foreground">No products found</p>
                      <p className="mt-1 text-xs">Try a different search term</p>
                    </div>
                  ) : (
                    Object.entries(groupedProducts).map(([categoryId, categoryProducts]) => (
                      <div key={categoryId} className="mb-6">
                        {/* Category Header */}
                        <div className="flex items-center gap-2 mb-3">
                          <h3 className="text-sm md:text-base font-semibold text-foreground">
                            {getCategoryName(categoryId)}
                          </h3>
                          <Badge variant="secondary" className="text-xs">
                            {categoryProducts.length}
                          </Badge>
                          <div className="flex-1 h-px bg-border" />
                        </div>

                        {/* Products Grid for this Category */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3">
                          {categoryProducts.map((product) => {
                            const { regular: posRegular, sale: posSale } = getPosPricing(product)
                            const discountPct = posSale && posRegular
                              ? Math.round(((posRegular - posSale) / posRegular) * 100)
                              : 0
                            const lowStock = product.stock < 10
                            return (
                              <Card
                                key={product.id}
                                className="group relative cursor-pointer gap-0 py-0 overflow-hidden ring-1 ring-foreground/10 transition-all hover:ring-2 hover:ring-primary/50 hover:shadow-md"
                                onClick={() => addToCart(product)}
                              >
                                <div className="relative aspect-square bg-muted overflow-hidden">
                                  {product.images && product.images.length > 0 ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={product.images[0]}
                                      alt={product.name}
                                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <span className="text-2xl md:text-3xl text-muted-foreground">📦</span>
                                    </div>
                                  )}
                                  {discountPct > 0 && (
                                    <Badge
                                      variant="default"
                                      className="absolute left-1.5 top-1.5 h-5 px-1.5 text-[0.625rem] font-semibold border-emerald-200 bg-emerald-500 text-white shadow-sm"
                                    >
                                      −{discountPct}%
                                    </Badge>
                                  )}
                                  <Badge
                                    variant="outline"
                                    className={`absolute right-1.5 top-1.5 h-5 px-1.5 text-[0.625rem] font-semibold backdrop-blur ${
                                      lowStock
                                        ? "border-rose-200 bg-rose-50/90 text-rose-700 dark:border-rose-900 dark:bg-rose-950/70 dark:text-rose-400"
                                        : "border-border bg-background/80 text-foreground"
                                    }`}
                                  >
                                    {product.stock}
                                  </Badge>
                                </div>
                                <CardContent className="p-2 space-y-1">
                                  <h3 className="font-semibold text-xs md:text-sm leading-snug line-clamp-2 min-h-[1.75rem] md:min-h-[2rem]">
                                    {product.name}
                                  </h3>
                                  {product.brand && (
                                    <p className="text-[0.6875rem] text-muted-foreground truncate">
                                      {product.brand}
                                    </p>
                                  )}
                                  <div className="flex items-baseline justify-between gap-1 pt-0.5">
                                    <div className="flex items-baseline gap-1.5 min-w-0">
                                      {posSale ? (
                                        <>
                                          <span className="font-bold text-sm md:text-base text-emerald-600 tabular-nums">
                                            ₹{posSale}
                                          </span>
                                          <span className="text-[0.6875rem] text-muted-foreground line-through tabular-nums">
                                            ₹{posRegular}
                                          </span>
                                        </>
                                      ) : (
                                        <span className="font-bold text-sm md:text-base tabular-nums">
                                          ₹{posRegular}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary opacity-0 transition-opacity group-hover:opacity-100">
                                      <Plus className="h-3.5 w-3.5" />
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            )
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Cart Section */}
        <div className="lg:col-span-1 flex flex-col order-1 lg:order-2 max-h-[40vh] lg:max-h-none min-h-0">
          <Card className="flex-1 flex flex-col h-full overflow-hidden">
            <CardContent className="px-3 md:px-4 py-2 flex-1 flex flex-col min-h-0 h-full">
              {/* Customer Badge */}
              {selectedCustomer && (
                <div className="flex items-center justify-between gap-2 p-2 md:p-3 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20 mb-2 shrink-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[0.6875rem] font-semibold text-primary ring-1 ring-primary/20">
                      {(
                        (selectedCustomer.first_name?.trim()?.[0] || "") +
                        (selectedCustomer.last_name?.trim()?.[0] || "")
                      ).toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-xs md:text-sm truncate">
                          {selectedCustomer.first_name} {selectedCustomer.last_name}
                        </p>
                        {selectedCustomer.is_vip && (
                          <Badge variant="default" className="h-4 px-1 text-[0.625rem] shrink-0">
                            <Award className="h-2.5 w-2.5 mr-0.5" />
                            Sd
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate tabular-nums">
                        {selectedCustomer.mobile_primary}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 md:h-8 md:w-8 shrink-0"
                    onClick={() => setSelectedCustomer(null)}
                  >
                    <X className="h-3 w-3 md:h-4 md:w-4" />
                  </Button>
                </div>
              )}

              {/* Warehouse Selection */}
              <div className="mb-2 shrink-0">
                <Label className="text-xs mb-1.5 flex items-center gap-1">
                  <Warehouse className="h-3 w-3" />
                  {role === 'admin' ? 'Company Warehouse' : role === 'retailer' ? 'Your Warehouse' : 'Select Warehouse'}
                </Label>
                {role === 'admin' && factoryWarehouse && warehouses.length === 1 ? (
                  // Admin with single company warehouse - show highlighted box
                  <div className="min-h-9 px-3 py-1.5 flex items-center border rounded-md bg-primary/10 border-primary/30">
                    <span className="text-xs font-medium text-primary leading-snug">
                      {factoryWarehouse.name} {factoryWarehouse.godown_code ? `(${factoryWarehouse.godown_code})` : ''}
                    </span>
                  </div>
                ) : role === 'retailer' && retailerWarehouse && warehouses.length === 1 ? (
                  // Retailer with single auto-selected warehouse - show highlighted box
                  <div className="min-h-9 px-3 py-1.5 flex items-center border rounded-md bg-primary/10 border-primary/30">
                    <span className="text-xs font-medium text-primary leading-snug">
                      {retailerWarehouse.name} {retailerWarehouse.godown_code ? `(${retailerWarehouse.godown_code})` : ''}
                    </span>
                  </div>
                ) : (
                  // Show dropdown (for other roles OR when multiple warehouses)
                  <Select value={selectedWarehouse || ""} onValueChange={setSelectedWarehouse}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Choose warehouse..." />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.length === 0 ? (
                        <SelectItem value="none" disabled className="text-xs text-muted-foreground">
                          No warehouses available
                        </SelectItem>
                      ) : (
                        warehouses.map((warehouse) => (
                          <SelectItem key={warehouse.id} value={warehouse.id} className="text-xs">
                            {warehouse.name} {warehouse.godown_code ? `(${warehouse.godown_code})` : ''}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Totals Section - Now at Top */}
              {cart.length > 0 && (
                <div className="border-b pb-2 mb-2 shrink-0">
                  <div className="space-y-0.5 mb-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">₹{subtotal.toFixed(2)}</span>
                    </div>
                    {totalDiscount > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Discount</span>
                        <span className="font-medium text-green-600">
                          -₹{totalDiscount.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">GST</span>
                      <span className="font-medium">₹{totalGST.toFixed(2)}</span>
                    </div>
                  </div>
                  <Separator className="mb-2" />
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-sm">Total</span>
                    <span className="font-bold text-lg md:text-xl">₹{total.toFixed(2)}</span>
                  </div>

                  {!selectedCustomer ? (
                    <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button className="w-full h-9 text-xs md:text-sm relative" variant="default">
                          <User className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                          Select Customer to Checkout
                          <span className="hidden md:flex items-center gap-0.5 ml-auto pl-2 text-xs opacity-70">
                            <CommandIcon className="h-3 w-3" />
                            <span>K</span>
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[500px] p-0" align="end">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Search by name, phone, Sd number..."
                            onValueChange={setCustomerSearchTerm}
                          />
                          <CommandList>
                            <CommandEmpty>
                              <div className="py-6 text-center">
                                <p className="text-sm text-muted-foreground mb-3">
                                  {customerSearchTerm.length < 2
                                    ? "Type at least 2 characters to search..."
                                    : "No customers found."}
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setCustomerSearchOpen(false)
                                    setNewCustomerDialogOpen(true)
                                  }}
                                >
                                  <UserPlus className="mr-2 h-4 w-4" />
                                  Add New Customer
                                </Button>
                              </div>
                            </CommandEmpty>
                            {filteredCustomers.length > 0 && (
                              <CommandGroup>
                                {filteredCustomers.map((customer) => (
                                  <CommandItem
                                    key={customer.id}
                                    onSelect={() => handleCustomerSelect(customer)}
                                    className="flex flex-col items-start gap-1 py-3"
                                  >
                                    <div className="flex items-center gap-2 w-full">
                                      <User className="h-4 w-4" />
                                      <span className="font-medium text-sm">
                                        {customer.first_name} {customer.last_name}
                                      </span>
                                      {customer.is_vip && (
                                        <Badge variant="default" className="ml-auto text-xs">
                                          <Award className="h-3 w-3 mr-1" />
                                          Sd {customer.vip_number}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex gap-2 text-xs text-muted-foreground ml-6">
                                      <span className="flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        {customer.mobile_primary}
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Button
                      className="w-full h-9 text-xs md:text-sm relative"
                      onClick={() => setCheckoutDialogOpen(true)}
                    >
                      <CreditCard className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                      Proceed to Checkout
                      <span className="hidden md:flex items-center gap-0.5 ml-auto pl-2 text-xs opacity-70">
                        <CommandIcon className="h-3 w-3" />
                        <CornerDownLeft className="h-3 w-3" />
                      </span>
                    </Button>
                  )}
                </div>
              )}

              {/* Cart Items - Now Below Totals and Scrollable */}
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                  {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <ShoppingCart className="h-5 w-5 opacity-50" />
                      </div>
                      <p className="text-sm font-medium text-foreground">Cart is empty</p>
                      <p className="mt-1 text-xs">Tap a product to add it</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 md:space-y-3 pr-2 pb-2">
                    {cart.map((item) => (
                      <div
                        key={item.product.id}
                        className="p-2.5 border rounded-lg bg-card ring-1 ring-foreground/5 hover:ring-primary/30 hover:bg-accent/40 transition-all"
                      >
                        <div className="flex items-start justify-between mb-1 pb-2 border-b border-border/50">
                          <div className="flex-1 pr-2 min-w-0">
                            <h4 className="font-medium text-xs md:text-sm line-clamp-1">
                              {item.product.name}
                            </h4>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs text-muted-foreground">₹</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.price}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  updatePrice(item.product.id, parseFloat(e.target.value) || 0)
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-20 text-xs bg-transparent border-b border-dashed border-muted-foreground/40 focus:border-primary focus:outline-none px-0.5 py-0"
                              />
                              <span className="text-xs text-muted-foreground">each</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 md:h-7 md:w-7 -mt-1 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeFromCart(item.product.id)
                            }}
                          >
                            <Trash2 className="h-3 w-3 md:h-3.5 md:w-3.5 text-destructive" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1 md:gap-1.5">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-6 w-6 md:h-7 md:w-7"
                              onClick={(e) => {
                                e.stopPropagation()
                                updateQuantity(item.product.id, item.quantity - 1)
                              }}
                            >
                              <Minus className="h-2.5 w-2.5 md:h-3 md:w-3" />
                            </Button>
                            <span className="font-semibold w-8 md:w-10 text-center text-xs md:text-sm">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-6 w-6 md:h-7 md:w-7"
                              onClick={(e) => {
                                e.stopPropagation()
                                updateQuantity(item.product.id, item.quantity + 1)
                              }}
                            >
                              <Plus className="h-2.5 w-2.5 md:h-3 md:w-3" />
                            </Button>
                          </div>
                          <span className="font-bold text-xs md:text-sm shrink-0">
                            ₹{calculateItemTotal(item).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={checkoutDialogOpen} onOpenChange={setCheckoutDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl">Complete Order</DialogTitle>
            <DialogDescription className="text-xs md:text-sm">
              Review order details and select payment method
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 md:space-y-4">
            {selectedCustomer && (
              <>
                <div className="rounded-lg border bg-muted/40 p-3 md:p-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary ring-1 ring-primary/20">
                      {(
                        (selectedCustomer.first_name?.trim()?.[0] || "") +
                        (selectedCustomer.last_name?.trim()?.[0] || "")
                      ).toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-sm truncate">
                          {selectedCustomer.first_name} {selectedCustomer.last_name}
                        </p>
                        {selectedCustomer.is_vip && (
                          <Badge variant="default" className="h-4 px-1 text-[0.625rem] shrink-0">
                            <Award className="h-2.5 w-2.5 mr-0.5" />
                            Sd
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground tabular-nums flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {selectedCustomer.mobile_primary}
                      </p>
                    </div>
                  </div>
                </div>

              </>
            )}

            <div className="space-y-2">
              <Label className="text-sm md:text-base">Payment Method</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={paymentMethod === "cash" ? "default" : "outline"}
                  onClick={() => setPaymentMethod("cash")}
                  className="flex flex-col h-auto py-3 md:py-4 gap-1"
                >
                  <Banknote className="h-5 w-5 md:h-6 md:w-6" />
                  <span className="text-xs font-medium">Cash</span>
                </Button>
                <Button
                  variant={paymentMethod === "upi" ? "default" : "outline"}
                  onClick={() => setPaymentMethod("upi")}
                  className="flex flex-col h-auto py-3 md:py-4 gap-1"
                >
                  <Smartphone className="h-5 w-5 md:h-6 md:w-6" />
                  <span className="text-xs font-medium">UPI</span>
                </Button>
                <Button
                  variant={paymentMethod === "card" ? "default" : "outline"}
                  onClick={() => setPaymentMethod("card")}
                  className="flex flex-col h-auto py-3 md:py-4 gap-1"
                >
                  <CreditCard className="h-5 w-5 md:h-6 md:w-6" />
                  <span className="text-xs font-medium">Card</span>
                </Button>
                <Button
                  variant={paymentMethod === "cheque" ? "default" : "outline"}
                  onClick={() => setPaymentMethod("cheque")}
                  className="flex flex-col h-auto py-3 md:py-4 gap-1"
                >
                  <FileText className="h-5 w-5 md:h-6 md:w-6" />
                  <span className="text-xs font-medium">Cheque</span>
                </Button>
                <Button
                  variant={paymentMethod === "balance" ? "default" : "outline"}
                  onClick={() => setPaymentMethod("balance")}
                  className="flex flex-col h-auto py-3 md:py-4 gap-1"
                >
                  <Wallet className="h-5 w-5 md:h-6 md:w-6" />
                  <span className="text-xs font-medium">Balance</span>
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-1.5 md:space-y-2">
              <div className="flex justify-between text-xs md:text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-muted-foreground">Discount:</span>
                  <span className="text-green-600">-₹{totalDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs md:text-sm">
                <span className="text-muted-foreground">GST:</span>
                <span>₹{totalGST.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-base md:text-lg">
                <span>Total Amount:</span>
                <span>₹{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setCheckoutDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCheckout}
              disabled={processingOrder}
              className="w-full sm:w-auto"
            >
              {processingOrder ? (
                "Processing..."
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Complete Order
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Customer Dialog */}
      <Dialog open={newCustomerDialogOpen} onOpenChange={setNewCustomerDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>
              Create a new customer for quick checkout
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Basic Information */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="new_first_name">First Name *</Label>
                <Input
                  id="new_first_name"
                  value={customerFormData.first_name}
                  onChange={(e) =>
                    setCustomerFormData({ ...customerFormData, first_name: e.target.value })
                  }
                  placeholder="John"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_last_name">Last Name *</Label>
                <Input
                  id="new_last_name"
                  value={customerFormData.last_name}
                  onChange={(e) =>
                    setCustomerFormData({ ...customerFormData, last_name: e.target.value })
                  }
                  placeholder="Doe"
                  required
                />
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-2">
              <Label htmlFor="new_mobile">Mobile Number *</Label>
              <Input
                id="new_mobile"
                value={customerFormData.mobile_primary}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '')
                  setCustomerFormData({ ...customerFormData, mobile_primary: value })
                }}
                maxLength={10}
                placeholder="10 digit mobile number"
                required
              />
              <p className="text-xs text-muted-foreground">
                {customerFormData.mobile_primary.length}/10 digits
              </p>
            </div>

            <div className="space-y-2">
              <Label>WhatsApp Number</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="whatsapp_same"
                  checked={customerFormData.whatsapp_same_as_primary}
                  onCheckedChange={(checked) => {
                    const isChecked = checked === true
                    setCustomerFormData({
                      ...customerFormData,
                      whatsapp_same_as_primary: isChecked,
                      whatsapp_number: isChecked ? customerFormData.mobile_primary : customerFormData.whatsapp_number
                    })
                  }}
                />
                <Label htmlFor="whatsapp_same" className="text-sm font-normal cursor-pointer">
                  Same as Primary Mobile
                </Label>
              </div>
            </div>

            <Separator />

            {/* Address (Optional for POS) */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Address <span className="text-xs text-muted-foreground font-normal">(Optional)</span></Label>

              <Input
                placeholder="Building Name"
                value={customerFormData.shipping_building_name}
                onChange={(e) =>
                  setCustomerFormData({ ...customerFormData, shipping_building_name: e.target.value })
                }
              />

              <Input
                placeholder="Street/Area"
                value={customerFormData.shipping_street_area}
                onChange={(e) =>
                  setCustomerFormData({ ...customerFormData, shipping_street_area: e.target.value })
                }
              />

              <div className="grid grid-cols-3 gap-3">
                <Input
                  placeholder="City"
                  value={customerFormData.shipping_city}
                  onChange={(e) =>
                    setCustomerFormData({ ...customerFormData, shipping_city: e.target.value })
                  }
                />
                <Input
                  placeholder="State"
                  value={customerFormData.shipping_state}
                  onChange={(e) =>
                    setCustomerFormData({ ...customerFormData, shipping_state: e.target.value })
                  }
                />
                <Input
                  placeholder="Pincode"
                  value={customerFormData.shipping_pincode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '')
                    setCustomerFormData({ ...customerFormData, shipping_pincode: value })
                  }}
                  maxLength={6}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewCustomerDialogOpen(false)}
              disabled={savingCustomer}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveNewCustomer} disabled={savingCustomer}>
              {savingCustomer ? "Saving..." : "Save Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </>
  )
}
