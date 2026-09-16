"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Plus,
  Minus,
  Trash2,
  ArrowLeft,
  Package,
  AlertCircle,
  CalendarIcon,
  Truck,
  FileText,
  IndianRupee,
  Search,
  Filter,
  ExternalLink,
  Clock,
  ChevronUp,
  ChevronDown,
  Upload,
  Loader2
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { lookupPincode } from "@/lib/pincode-lookup"

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
]

type Distributor = {
  id: string
  first_name: string
  last_name: string
  email: string
  mobile_primary: string
  mobile_secondary_1: string | null
  mobile_secondary_2: string | null
  whatsapp_number: string | null
  whatsapp_same_as_primary: boolean
  company_name: string | null
  gst_number: string | null
  pan_card_number: string | null
  shipping_building_name: string
  shipping_street_area: string
  shipping_city: string
  shipping_state: string
  shipping_pincode: string
  shipping_room_number: string | null
  shipping_floor: string | null
  shipping_wing: string | null
  shipping_flat_number: string | null
  shipping_floor_wing: string | null
  shipping_landmark: string | null
  entity_type: "distributor" | "subdistributor" | "customer"
  parent_distributor_name?: string | null
}

type Product = {
  id: string
  name: string
  customer_price: number
  gst_percentage: number | null
  hsn_code: string | null
  stock: number | null
  factory_stock: number | null // Factory warehouse stock
  brand: string | null
  parent_category_id: string | null
  sub_category_id: string | null
}

type CourierPartner = {
  id: string
  name: string
  code: string
  tracking_url_template: string | null
  default_delivery_days: number | null
  is_active: boolean
}

type Category = {
  id: string
  category_name: string
  parent_category_id: string | null
}

type OrderItem = {
  id: string // Unique ID for each order item (allows duplicate products)
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  discount_amount: number
  discount_percentage: number
  gross_amount: number
  gst_percentage: number
  hsn_code: string
  stock: number | null
  isEditing?: boolean
  description?: string
}

export default function OrderFromFactoryPage() {
  const router = useRouter()
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [courierPartners, setCourierPartners] = useState<CourierPartner[]>([])
  const [selectedDistributor, setSelectedDistributor] = useState<string>("")
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [selectedProduct, setSelectedProduct] = useState<string>("")
  const [quantity, setQuantity] = useState<number>(1)
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>("all")
  const [paymentMethod, setPaymentMethod] = useState<string>("cash")
  const [paymentStatus, setPaymentStatus] = useState<string>("pending")
  const [orderStatus, setOrderStatus] = useState<string>("pending")
  const [isPriority, setIsPriority] = useState<boolean>(false)
  const [isGstInvoice, setIsGstInvoice] = useState<boolean>(false)
  const [tempGstNumber, setTempGstNumber] = useState<string>("")
  const [tempPanNumber, setTempPanNumber] = useState<string>("")
  const [shippingCharges, setShippingCharges] = useState<number>(0)
  const [discountAmount, setDiscountAmount] = useState<number>(0)
  const [saving, setSaving] = useState(false)

  // Tally invoice PDF auto-fill
  const [uploadingInvoice, setUploadingInvoice] = useState(false)
  const [invoiceOrderDate, setInvoiceOrderDate] = useState<Date | undefined>(undefined)
  const [invoiceNumberParsed, setInvoiceNumberParsed] = useState<string | null>(null)
  const [invoiceWarnings, setInvoiceWarnings] = useState<string[]>([])
  // Learned Tally-description -> product_id mappings (public.tally_product_mappings),
  // keyed by normalizeTallyDescription(description). Lets repeat invoices for the
  // same Tally item resolve exactly instead of re-running the fuzzy matcher.
  const [tallyMappings, setTallyMappings] = useState<Record<string, string>>({})
  const [unmatchedInvoiceItems, setUnmatchedInvoiceItems] = useState<
    { id: string; description: string; hsnCode: string; quantity: number; ratePerUnitInclTax: number; pickedProductId: string }[]
  >([])

  // New fields
  const [courierPartner, setCourierPartner] = useState<string>("")
  const [trackingNumber, setTrackingNumber] = useState<string>("")
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<Date>()
  const [orderNotes, setOrderNotes] = useState<string>("")
  const [customerNotes, setCustomerNotes] = useState<string>("")
  const [internalNotes, setInternalNotes] = useState<string>("")
  const [distributorSearch, setDistributorSearch] = useState<string>("")
  const [searchResults, setSearchResults] = useState<Distributor[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [entityTypeFilter, setEntityTypeFilter] = useState<"all" | "distributor" | "subdistributor" | "customer">("all")

  // Agent tracking fields
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null)
  const [currentAgentName, setCurrentAgentName] = useState<string | null>(null)

  // Shipping address fields
  const [shippingAddressOption, setShippingAddressOption] = useState<"customer_structured" | "custom">("customer_structured")
  const [shippingPincode, setShippingPincode] = useState<string>("")

  // Custom address structured fields
  const [customAddressFields, setCustomAddressFields] = useState({
    room_number: "",
    floor: "",
    wing: "",
    building_name: "",
    street_area: "",
    landmark: "",
    city: "",
    state: "",
    pincode: "",
  })

  // Distributor destination warehouse
  const [destinationWarehouseId, setDestinationWarehouseId] = useState<string | null>(null)
  const [destinationWarehouseName, setDestinationWarehouseName] = useState<string | null>(null)
  const [distributorGodowns, setDistributorGodowns] = useState<{ id: string; name: string; godown_code: string; is_primary: boolean }[]>([])
  const [noDestinationWarning, setNoDestinationWarning] = useState(false)

  // Previous orders for reorder functionality
  const [previousOrders, setPreviousOrders] = useState<any[]>([])
  const [loadingPreviousOrders, setLoadingPreviousOrders] = useState(false)
  const [showPreviousOrders, setShowPreviousOrders] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      await fetchProductsAndData()

      // Fetch current user and agent information
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setCurrentUserId(session.user.id)

        // Fetch agent configuration for the current user
        const { data: agentConfig } = await supabase
          .from("user_agent_config")
          .select("agent_id, agent_name")
          .eq("user_id", session.user.id)
          .eq("is_active", true)
          .single()

        if (agentConfig) {
          setCurrentAgentId(agentConfig.agent_id)
          setCurrentAgentName(agentConfig.agent_name)
        }
      }

      // Handle reorder from URL parameter
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search)
        const reorderId = urlParams.get('reorder')
        if (reorderId) {
          await loadOrderForReorder(reorderId)
        }
      }
    }

    loadData()
  }, [])

  // Fetch factory warehouse stock on mount
  useEffect(() => {
    fetchFactoryStock()
  }, [])

  // Fetch previous orders when distributor is selected
  useEffect(() => {
    const fetchPreviousOrders = async () => {
      if (!selectedDistributor) {
        setPreviousOrders([])
        return
      }

      setLoadingPreviousOrders(true)
      try {
        const entity = distributors.find(c => c.id === selectedDistributor)
        const idColumn = entity?.entity_type === "customer" ? "customer_id" : "distributor_id"
        const { data } = await supabase
          .from("orders")
          .select(`
            id, order_number, order_date, total_amount,
            order_items(product_name, quantity)
          `)
          .eq(idColumn, selectedDistributor)
          .order("order_date", { ascending: false })
          .limit(5)

        setPreviousOrders(data || [])
      } catch (error) {
        console.error("Error fetching previous orders:", error)
      }
      setLoadingPreviousOrders(false)
    }

    fetchPreviousOrders()
  }, [selectedDistributor, distributors])

  // Keyboard hotkeys for GST invoice toggle
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return
      }

      // "1" key for GST invoice
      if (event.key === '1') {
        setIsGstInvoice(true)
        toast.success('GST Invoice enabled', { duration: 1500 })
      }

      // "2" key for Non-GST invoice
      if (event.key === '2') {
        setIsGstInvoice(false)
        toast.success('Non-GST Invoice enabled', { duration: 1500 })
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  const fetchProductsAndData = async () => {
    // Fetch products
    const { data: productsData } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("name")

    // Fetch categories
    const { data: categoriesData } = await supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("category_name")

    // Fetch active courier partners
    const { data: courierPartnersData } = await supabase
      .from("courier_partners")
      .select("*")
      .eq("is_active", true)
      .order("name")

    // Fetch learned Tally-description -> product mappings (for PDF auto-fill)
    const { data: tallyMappingsData } = await supabase
      .from("tally_product_mappings")
      .select("tally_description, product_id")

    // Initialize products with null factory_stock
    const productsWithStock = (productsData || []).map(p => ({
      ...p,
      factory_stock: null
    }))

    setProducts(productsWithStock)
    setCategories(categoriesData || [])
    setCourierPartners(courierPartnersData || [])
    setTallyMappings(
      Object.fromEntries((tallyMappingsData || []).map((m) => [m.tally_description, m.product_id]))
    )
    return []
  }

  // Fetch factory warehouse stock for all products
  const fetchFactoryStock = async () => {
    try {
      const { data: stockData, error } = await supabase
        .from("factory_warehouse_stock")
        .select(`
          product_id,
          available_quantity
        `)

      if (error) {
        console.error("Error fetching factory stock:", error)
        return
      }

      // Create a map of product_id -> available_quantity
      const stockMap = new Map<string, number>()
      if (stockData) {
        stockData.forEach((item: any) => {
          if (item.product_id) {
            stockMap.set(item.product_id, item.available_quantity || 0)
          }
        })
      }

      // Update products with factory stock
      setProducts(prevProducts => prevProducts.map(p => ({
        ...p,
        factory_stock: stockMap.get(p.id) ?? 0
      })))
    } catch (error) {
      console.error("Error fetching factory stock:", error)
    }
  }

  // Load order items from a previous order for reordering
  const loadOrderForReorder = async (orderId: string) => {
    try {
      // Fetch the order
      const { data: orderData } = await supabase
        .from("orders")
        .select("order_number")
        .eq("id", orderId)
        .single()

      // Fetch order items with product details
      const { data: itemsData } = await supabase
        .from("order_items")
        .select("product_id, product_name, quantity, unit_price, discount_amount, discount_percent, gst_percentage, hsn_code")
        .eq("order_id", orderId)

      if (!itemsData || itemsData.length === 0) {
        toast.error("No items found in the previous order")
        return
      }

      // Fetch current product data (for stock and current prices)
      const productIds = itemsData.map(item => item.product_id).filter(Boolean)
      const { data: currentProducts } = await supabase
        .from("products")
        .select("id, customer_price, stock, gst_percentage, hsn_code")
        .in("id", productIds)

      const productMap = new Map(currentProducts?.map(p => [p.id, p]) || [])

      // Map to OrderItem structure - use original order prices so totals match
      const mappedItems: OrderItem[] = itemsData.map(item => {
        const currentProduct = productMap.get(item.product_id)
        const unitPrice = item.unit_price
        const quantity = item.quantity
        const discountAmount = item.discount_amount || 0
        const discountPercentage = item.discount_percent || 0
        const gstPercentage = currentProduct?.gst_percentage ?? item.gst_percentage
        const subtotal = quantity * unitPrice
        const netAmount = subtotal - discountAmount

        return {
          id: crypto.randomUUID(),
          product_id: item.product_id,
          product_name: item.product_name,
          quantity,
          unit_price: unitPrice,
          discount_amount: discountAmount,
          discount_percentage: discountPercentage,
          gross_amount: netAmount,
          gst_percentage: gstPercentage,
          hsn_code: currentProduct?.hsn_code ?? item.hsn_code ?? "",
          stock: currentProduct?.stock ?? null
        }
      })

      setOrderItems(mappedItems)
      toast.success(`Loaded ${mappedItems.length} items from Order ${orderData?.order_number}`)
    } catch (error) {
      console.error("Error loading order for reorder:", error)
      toast.error("Failed to load order items")
    }
  }

  const transformDistributorRow = async (dist: any): Promise<Distributor> => {
    let parentName = null
    if (dist.parent_id) {
      const { data: parentData } = await supabase
        .from("distributors")
        .select("name")
        .eq("id", dist.parent_id)
        .single()
      parentName = parentData?.name || null
    }

    return {
      id: dist.id,
      first_name: dist.name.split(" ")[0] || dist.name,
      last_name: dist.name.split(" ").slice(1).join(" ") || "",
      email: dist.email,
      mobile_primary: dist.phone_primary,
      mobile_secondary_1: dist.phone_secondary,
      mobile_secondary_2: dist.phone_tertiary,
      whatsapp_number: dist.phone_primary,
      whatsapp_same_as_primary: true,
      company_name: dist.company_name,
      gst_number: dist.gst_number,
      pan_card_number: dist.pan_number || null,
      shipping_building_name: dist.shipping_address_line1,
      shipping_street_area: dist.shipping_address_line2 || "",
      shipping_city: dist.shipping_city,
      shipping_state: dist.shipping_state,
      shipping_pincode: dist.shipping_pincode,
      shipping_room_number: null,
      shipping_floor: null,
      shipping_wing: null,
      shipping_flat_number: null,
      shipping_floor_wing: null,
      shipping_landmark: null,
      entity_type: dist.parent_id ? "subdistributor" as const : "distributor" as const,
      parent_distributor_name: parentName,
    }
  }

  const transformCustomerRow = (cust: any): Distributor => ({
    id: cust.id,
    first_name: cust.first_name,
    last_name: cust.last_name,
    email: cust.email,
    mobile_primary: cust.mobile_primary,
    mobile_secondary_1: cust.mobile_secondary_1,
    mobile_secondary_2: cust.mobile_secondary_2,
    whatsapp_number: cust.whatsapp_number,
    whatsapp_same_as_primary: cust.whatsapp_same_as_primary,
    company_name: cust.company_name,
    gst_number: cust.gst_number,
    pan_card_number: cust.pan_card_number,
    shipping_building_name: cust.shipping_building_name,
    shipping_street_area: cust.shipping_street_area,
    shipping_city: cust.shipping_city,
    shipping_state: cust.shipping_state,
    shipping_pincode: cust.shipping_pincode,
    shipping_room_number: cust.shipping_room_number,
    shipping_floor: cust.shipping_floor,
    shipping_wing: cust.shipping_wing,
    shipping_flat_number: cust.shipping_flat_number,
    shipping_floor_wing: cust.shipping_floor_wing,
    shipping_landmark: cust.shipping_landmark,
    entity_type: "customer" as const,
    parent_distributor_name: null,
  })

  // The page's `distributors` state only ever holds the one currently
  // selected buyer (set on manual pick) — it is NOT a full directory, so it
  // can't be used to look up the Tally invoice's buyer by GSTIN/name. Query
  // distributors + customers directly instead.
  const findBuyerByGstinOrName = async (gstin: string | null, name: string | null): Promise<Distributor | null> => {
    if (gstin) {
      const { data: distMatch } = await supabase
        .from("distributors")
        .select("*")
        .ilike("gst_number", gstin)
        .limit(1)
        .maybeSingle()
      if (distMatch) return transformDistributorRow(distMatch)

      const { data: custMatch } = await supabase
        .from("customers")
        .select("*")
        .ilike("gst_number", gstin)
        .limit(1)
        .maybeSingle()
      if (custMatch) return transformCustomerRow(custMatch)
    }

    if (name) {
      const { data: distMatch } = await supabase
        .from("distributors")
        .select("*")
        .or(`name.ilike.${name},company_name.ilike.${name}`)
        .limit(1)
        .maybeSingle()
      if (distMatch) return transformDistributorRow(distMatch)

      const nameParts = name.trim().split(/\s+/)
      const { data: custMatch } = await supabase
        .from("customers")
        .select("*")
        .or(`first_name.ilike.${nameParts[0]},company_name.ilike.${name}`)
        .limit(1)
        .maybeSingle()
      if (custMatch) return transformCustomerRow(custMatch)
    }

    return null
  }

  const searchDistributors = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      // Create alternate phone number search (with/without leading 0)
      const phoneWithoutCountryCode = searchTerm.replace(/^\+91/, '').replace(/^91/, '')
      const cleanPhone = phoneWithoutCountryCode.replace(/^0/, '')
      const phoneWithZero = '0' + cleanPhone
      const phoneAlternate = phoneWithoutCountryCode.startsWith('0') ? cleanPhone : phoneWithZero

      // Search distributors
      const { data: distributorsData, error: distributorsError } = await supabase
        .from("distributors")
        .select("*")
        .eq("is_active", true)
        .or(`name.ilike.%${searchTerm}%,company_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone_primary.ilike.%${searchTerm}%,phone_secondary.ilike.%${searchTerm}%,phone_tertiary.ilike.%${searchTerm}%,gst_number.ilike.%${searchTerm}%,phone_primary.ilike.%${phoneAlternate}%,phone_secondary.ilike.%${phoneAlternate}%,phone_tertiary.ilike.%${phoneAlternate}%`)
        .limit(50)
        .order("name")

      // Search customers
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("*")
        .eq("is_active", true)
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,mobile_primary.ilike.%${searchTerm}%,mobile_secondary_1.ilike.%${searchTerm}%,mobile_secondary_2.ilike.%${searchTerm}%,whatsapp_number.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,vip_number.ilike.%${searchTerm}%,gst_number.ilike.%${searchTerm}%,pan_card_number.ilike.%${searchTerm}%,mobile_primary.ilike.%${phoneAlternate}%,mobile_secondary_1.ilike.%${phoneAlternate}%,mobile_secondary_2.ilike.%${phoneAlternate}%,whatsapp_number.ilike.%${phoneAlternate}%`)
        .limit(50)
        .order("first_name")

      if (distributorsError || customersError) {
        console.error("Search error:", distributorsError || customersError)
        toast.error("Error searching")
        setSearchResults([])
        setIsSearching(false)
        return
      }

      // Transform distributors to Distributor type
      const transformedDistributors: Distributor[] = await Promise.all(
        (distributorsData || []).map((dist) => transformDistributorRow(dist))
      )

      // Transform customers to Distributor (entity) type
      const transformedCustomers: Distributor[] = (customersData || []).map(transformCustomerRow)

      // Sort combined results
      const sortedResults = [...transformedDistributors, ...transformedCustomers].sort((a, b) => {
        const aName = `${a.first_name} ${a.last_name}`.toLowerCase()
        const bName = `${b.first_name} ${b.last_name}`.toLowerCase()
        return aName.localeCompare(bName)
      })

      setSearchResults(sortedResults)
    } catch (error) {
      console.error("Search error:", error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchDistributors(distributorSearch)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [distributorSearch])

  // Category filter helpers
  const parentCategories = categories.filter(cat => cat.parent_category_id === null)

  const subCategories = selectedCategory && selectedCategory !== "all"
    ? categories.filter(cat => cat.parent_category_id === selectedCategory)
    : []

  // Reset subcategory when parent category changes
  useEffect(() => {
    setSelectedSubCategory("all")
  }, [selectedCategory])

  // Auto-select best address option when distributor changes
  useEffect(() => {
    if (!selectedDistributor) return
    const distributor = distributors.find(c => c.id === selectedDistributor)
    if (!distributor) return

    if (distributor.shipping_building_name || distributor.shipping_street_area || distributor.shipping_city || distributor.shipping_pincode) {
      setShippingAddressOption("customer_structured")
    } else {
      setShippingAddressOption("custom")
    }
  }, [selectedDistributor, distributors])

  // Fetch distributor/subdistributor godowns when entity is selected
  useEffect(() => {
    const fetchDistributorGodowns = async () => {
      // Reset state
      setDistributorGodowns([])
      setDestinationWarehouseId(null)
      setDestinationWarehouseName(null)
      setNoDestinationWarning(false)

      if (!selectedDistributor) return
      const distributor = distributors.find(c => c.id === selectedDistributor)
      if (!distributor) return

      // Customers don't have godowns — destination is the customer directly
      if (distributor.entity_type === "customer") return

      // Fetch this entity's godowns
      const { data: godowns } = await supabase
        .from("godowns")
        .select("id, name, godown_code, is_primary")
        .eq("distributor_id", distributor.id)
        .eq("is_active", true)
        .order("is_primary", { ascending: false })

      const entityGodowns = godowns || []
      setDistributorGodowns(entityGodowns)

      if (entityGodowns.length > 0) {
        // Auto-select primary godown, or the first one
        const primary = entityGodowns.find(g => g.is_primary) || entityGodowns[0]
        setDestinationWarehouseId(primary.id)
        setDestinationWarehouseName(primary.name)
        setNoDestinationWarning(false)
      } else {
        setNoDestinationWarning(true)
      }
    }

    fetchDistributorGodowns()
  }, [selectedDistributor, distributors])

  // Auto-detect and set pincode based on selected address option
  useEffect(() => {
    if (!selectedDistributor) {
      setShippingPincode("")
      return
    }

    const distributor = distributors.find((c) => c.id === selectedDistributor)
    if (!distributor) return

    if (distributor.shipping_pincode) {
      setShippingPincode(distributor.shipping_pincode)
    }
  }, [selectedDistributor, shippingAddressOption, distributors])

  // Reset custom address fields when switching away from custom option
  useEffect(() => {
    if (shippingAddressOption !== "custom") {
      setCustomAddressFields({
        room_number: "",
        floor: "",
        wing: "",
        building_name: "",
        street_area: "",
        landmark: "",
        city: "",
        state: "",
        pincode: "",
      })
    }
  }, [shippingAddressOption])

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

  // Same Tally item can print with slightly different spacing across
  // invoices; normalize before using as a lookup/storage key.
  const normalizeTallyDescription = (description: string) => description.trim().replace(/\s+/g, " ").toUpperCase()

  // Best-effort match of a Tally invoice line description (e.g. "08 COW GHEE
  // 15 LTR BUK") to a catalog product. Requires HSN to line up and a single
  // clear top scorer — ties or low confidence return null so the caller
  // surfaces it for manual selection rather than guessing wrong.
  const matchProductFromDescription = (description: string, hsnCode: string): Product | null => {
    const descUpper = description.toUpperCase()
    const hsnCandidates = products.filter((p) => p.hsn_code === hsnCode)
    const pool = hsnCandidates.length > 0 ? hsnCandidates : products

    const sizeMatch = descUpper.match(/(\d+(?:\.\d+)?)\s*(LTR|ML|L)\b/)
    const sizeNum = sizeMatch ? sizeMatch[1] : null
    const typeKeywords = ["BILONA", "COW", "BUFFALO", "GROUND NUT", "GROUNDNUT"]
    const matchedType = typeKeywords.find((k) => descUpper.includes(k))

    let bestScore = 0
    let bestProducts: Product[] = []
    for (const p of pool) {
      const nameUpper = p.name.toUpperCase()
      let score = 0
      if (hsnCandidates.includes(p)) score += 1
      if (matchedType && nameUpper.includes(matchedType)) score += 2
      if (sizeNum && new RegExp(`\\b${sizeNum}\\s*(LTR|ML|L)\\b`).test(nameUpper)) score += 2

      if (score > bestScore) {
        bestScore = score
        bestProducts = [p]
      } else if (score === bestScore && score > 0) {
        bestProducts.push(p)
      }
    }

    if (bestScore >= 4 && bestProducts.length === 1) return bestProducts[0]
    return null
  }

  const handleInvoiceUpload = async (file: File) => {
    setUploadingInvoice(true)
    setInvoiceWarnings([])
    setUnmatchedInvoiceItems([])
    try {
      const body = new FormData()
      body.append("file", file)
      const res = await fetch("/api/order-from-factory/parse-invoice", { method: "POST", body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to parse PDF")

      const invoice = data.invoice as {
        invoiceNumber: string | null
        invoiceDate: string | null
        buyerName: string | null
        buyerGstin: string | null
        items: { description: string; hsnCode: string; quantity: number; ratePerUnitInclTax: number }[]
      }

      const warnings: string[] = []

      // Match buyer: GSTIN first (authoritative), then exact name fallback.
      // Looks the buyer up directly in the DB — `distributors`/`searchResults`
      // state only ever holds whatever the user has manually searched/picked,
      // never a full directory to match against.
      const matched = await findBuyerByGstinOrName(invoice.buyerGstin, invoice.buyerName)
      if (matched) {
        setSelectedDistributor(matched.id)
        setDistributors([matched])
        if (matched.gst_number || matched.pan_card_number) {
          setIsGstInvoice(true)
        }
      } else {
        warnings.push(
          `Couldn't find a matching distributor/customer for "${invoice.buyerName || "unknown buyer"}"${invoice.buyerGstin ? ` (GSTIN: ${invoice.buyerGstin})` : ""} — select the buyer manually.`
        )
      }

      if (invoice.invoiceDate) {
        const [y, m, d] = invoice.invoiceDate.split("-").map(Number)
        setInvoiceOrderDate(new Date(y, m - 1, d))
      }
      if (invoice.invoiceNumber) {
        setInvoiceNumberParsed(invoice.invoiceNumber)
        setIsGstInvoice(true)
      }

      const newItems: OrderItem[] = []
      const stillUnmatched: typeof unmatchedInvoiceItems = []
      for (const item of invoice.items) {
        // A previously confirmed mapping for this exact Tally description is
        // authoritative — skip the fuzzy scorer entirely.
        const mappedProductId = tallyMappings[normalizeTallyDescription(item.description)]
        const product = mappedProductId
          ? products.find((p) => p.id === mappedProductId) || null
          : matchProductFromDescription(item.description, item.hsnCode)

        if (!product) {
          stillUnmatched.push({
            id: crypto.randomUUID(),
            description: item.description,
            hsnCode: item.hsnCode,
            quantity: item.quantity,
            ratePerUnitInclTax: item.ratePerUnitInclTax,
            pickedProductId: "",
          })
          continue
        }
        const unitPrice = item.ratePerUnitInclTax || product.customer_price
        newItems.push({
          id: crypto.randomUUID(),
          product_id: product.id,
          product_name: product.name,
          quantity: item.quantity,
          unit_price: unitPrice,
          discount_amount: 0,
          discount_percentage: 0,
          gross_amount: item.quantity * unitPrice,
          gst_percentage: product.gst_percentage || 0,
          hsn_code: product.hsn_code || item.hsnCode,
          stock: product.factory_stock ?? product.stock,
        })
      }

      if (newItems.length > 0) {
        setOrderItems((prev) => [...prev, ...newItems])
        toast.success(
          `Added ${newItems.length} item${newItems.length === 1 ? "" : "s"} from invoice ${invoice.invoiceNumber || ""}`
        )
      }
      if (stillUnmatched.length > 0) {
        setUnmatchedInvoiceItems(stillUnmatched)
        warnings.push(
          `${stillUnmatched.length} item(s) couldn't be confidently matched to a product — pick them below. This is remembered for next time.`
        )
      }
      setInvoiceWarnings(warnings)
      if (warnings.length > 0) {
        toast.warning(`${warnings.length} item(s)/fields need manual review — see the notice below.`)
      }
    } catch (err: any) {
      console.error("Error uploading Tally invoice:", err)
      toast.error(err.message || "Failed to parse invoice PDF")
    } finally {
      setUploadingInvoice(false)
    }
  }

  // Lets you paste a screenshot (Ctrl+V, e.g. straight from Snipping Tool)
  // instead of having to save it and use the file picker. Only triggers when
  // the clipboard actually contains an image — a normal text paste into any
  // field has no image items, so this never interferes with typing.
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (uploadingInvoice) return
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            handleInvoiceUpload(file)
          }
          break
        }
      }
    }
    document.addEventListener("paste", handlePaste)
    return () => document.removeEventListener("paste", handlePaste)
  }, [uploadingInvoice, handleInvoiceUpload])

  // User manually resolves an item the auto-matcher couldn't confidently
  // place. Adds it to the order and remembers the mapping (keyed on the
  // normalized Tally description) so the same item auto-matches next time.
  const resolveUnmatchedInvoiceItem = async (itemId: string) => {
    const item = unmatchedInvoiceItems.find((i) => i.id === itemId)
    if (!item || !item.pickedProductId) return
    const product = products.find((p) => p.id === item.pickedProductId)
    if (!product) return

    const unitPrice = item.ratePerUnitInclTax || product.customer_price
    setOrderItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: unitPrice,
        discount_amount: 0,
        discount_percentage: 0,
        gross_amount: item.quantity * unitPrice,
        gst_percentage: product.gst_percentage || 0,
        hsn_code: product.hsn_code || item.hsnCode,
        stock: product.factory_stock ?? product.stock,
      },
    ])
    setUnmatchedInvoiceItems((prev) => prev.filter((i) => i.id !== itemId))

    const normalized = normalizeTallyDescription(item.description)
    const { error } = await supabase
      .from("tally_product_mappings")
      .upsert(
        { tally_description: normalized, product_id: product.id, hsn_code: item.hsnCode },
        { onConflict: "tally_description" }
      )
    if (!error) {
      setTallyMappings((prev) => ({ ...prev, [normalized]: product.id }))
      toast.success(`Added "${product.name}" — remembered for future invoices with this description`)
    } else {
      console.error("Error saving Tally product mapping:", error)
      toast.warning(`Added "${product.name}" to the order, but couldn't save the mapping (${error.message}) — it'll ask again next time.`)
    }
  }

  const handleAddProduct = () => {
    if (!selectedProduct || quantity <= 0) {
      toast.error("Please select a product and enter valid quantity")
      return
    }

    const product = products.find((p) => p.id === selectedProduct)
    if (!product) return

    // Check if same product already exists - show info but allow adding
    const existingItem = orderItems.find((item) => item.product_id === selectedProduct)
    if (existingItem) {
      toast.info("Same product added again as separate line item")
    }

    const itemSubtotal = quantity * product.customer_price
    const discountAmount = 0
    const netAmount = itemSubtotal - discountAmount

    const newItem: OrderItem = {
      id: crypto.randomUUID(),
      product_id: product.id,
      product_name: product.name,
      quantity: quantity,
      unit_price: product.customer_price,
      discount_amount: discountAmount,
      discount_percentage: 0,
      gross_amount: netAmount,
      gst_percentage: product.gst_percentage || 0,
      hsn_code: product.hsn_code || "",
      stock: product.factory_stock ?? product.stock,
    }

    setOrderItems([...orderItems, newItem])
    setSelectedProduct("")
    setQuantity(1)
    toast.success("Product added to order")
  }

  // Remove item by unique ID
  const handleRemoveProduct = (itemId: string) => {
    setOrderItems(orderItems.filter((item) => item.id !== itemId))
    toast.success("Product removed from order")
  }

  const handleUpdateItemUnitPrice = (itemId: string, newUnitPrice: number) => {
    if (newUnitPrice < 0) return
    setOrderItems(orderItems.map(item => {
      if (item.id === itemId) {
        const itemSubtotal = item.quantity * newUnitPrice
        const discountAmount = Math.min(item.discount_amount, itemSubtotal)
        const netAmount = itemSubtotal - discountAmount
        const discountPercentage = itemSubtotal > 0 ? (discountAmount / itemSubtotal) * 100 : 0

        return {
          ...item,
          unit_price: newUnitPrice,
          discount_amount: discountAmount,
          discount_percentage: discountPercentage,
          gross_amount: netAmount
        }
      }
      return item
    }))
  }

  const handleUpdateItemQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) return
    setOrderItems(orderItems.map(item => {
      if (item.id === itemId) {
        const itemSubtotal = newQuantity * item.unit_price
        const netAmount = itemSubtotal - item.discount_amount
        const discountPercentage = itemSubtotal > 0 ? (item.discount_amount / itemSubtotal) * 100 : 0

        return {
          ...item,
          quantity: newQuantity,
          discount_percentage: discountPercentage,
          gross_amount: netAmount
        }
      }
      return item
    }))
  }

  const handleUpdateItemDiscountAmount = (itemId: string, discountAmount: number) => {
    if (discountAmount < 0) return
    setOrderItems(orderItems.map(item => {
      if (item.id === itemId) {
        const itemSubtotal = item.quantity * item.unit_price
        if (discountAmount > itemSubtotal) {
          toast.error("Discount cannot exceed item subtotal")
          return item
        }

        const netAmount = itemSubtotal - discountAmount
        const discountPercentage = itemSubtotal > 0 ? (discountAmount / itemSubtotal) * 100 : 0

        return {
          ...item,
          discount_amount: discountAmount,
          discount_percentage: discountPercentage,
          gross_amount: netAmount
        }
      }
      return item
    }))
  }

  const handleUpdateItemGrossAmount = (itemId: string, grossAmount: number) => {
    if (grossAmount < 0) return
    setOrderItems(orderItems.map(item => {
      if (item.id === itemId) {
        const newUnitPrice = item.quantity > 0 ? (grossAmount + item.discount_amount) / item.quantity : 0
        const itemSubtotal = item.quantity * newUnitPrice
        const discountPercentage = itemSubtotal > 0 ? (item.discount_amount / itemSubtotal) * 100 : 0

        return {
          ...item,
          unit_price: newUnitPrice,
          discount_percentage: discountPercentage,
          gross_amount: grossAmount
        }
      }
      return item
    }))
  }

  const handleUpdateItemDescription = (itemId: string, description: string) => {
    setOrderItems(orderItems.map((item) => (item.id === itemId ? { ...item, description } : item)))
  }

  const calculateOrderTotals = () => {
    // Factory-direct sales are invoiced under the Gujarat factory's GSTIN.
    const companyState = "Gujarat"
    const buyer = distributors.find((d) => d.id === selectedDistributor)
    const customerState = (buyer?.shipping_state || "").trim()
    // Don't silently assume intra-state when we don't actually know the buyer's
    // state — flag it instead so it can be corrected before the sale is recorded.
    const customerStateMissing = !customerState
    const isInterState =
      !customerStateMissing && customerState.toLowerCase() !== companyState.toLowerCase()

    let subtotal = 0
    let totalItemDiscount = 0
    let totalGst = 0
    let cgstAmount = 0
    let sgstAmount = 0
    let igstAmount = 0

    orderItems.forEach((item) => {
      const itemSubtotal = item.quantity * item.unit_price
      const netAmount = itemSubtotal - item.discount_amount
      const itemGst = (netAmount * item.gst_percentage) / (100 + item.gst_percentage)

      subtotal += itemSubtotal
      totalItemDiscount += item.discount_amount
      totalGst += itemGst

      if (isInterState) {
        igstAmount += itemGst
      } else {
        cgstAmount += itemGst / 2
        sgstAmount += itemGst / 2
      }
    })

    const itemsTotal = orderItems.reduce((sum, item) => sum + item.gross_amount, 0)
    const total = itemsTotal + shippingCharges - discountAmount

    return { subtotal, totalItemDiscount, totalGst, total, cgstAmount, sgstAmount, igstAmount, isInterState, customerStateMissing }
  }

  // Handler for pincode auto-population
  const handlePincodeChange = async (pincode: string, addressType: 'custom') => {
    if (pincode.length === 6) {
      const result = await lookupPincode(pincode)
      if (result) {
        setCustomAddressFields({
          ...customAddressFields,
          pincode: pincode,
          city: result.city,
          state: result.state,
        })
        setShippingPincode(pincode)
        toast.success(`Auto-filled: ${result.city}, ${result.state}`, { duration: 2000 })
      } else {
        setCustomAddressFields({ ...customAddressFields, pincode: pincode })
        setShippingPincode(pincode)
        toast.warning('Pincode not found in database. Please enter city and state manually.', { duration: 3000 })
      }
    } else {
      setCustomAddressFields({ ...customAddressFields, pincode: pincode })
      setShippingPincode(pincode)
    }
  }

  const handleCreateOrder = async () => {
    if (!selectedDistributor) {
      toast.error("Please select a distributor")
      return
    }

    if (orderItems.length === 0) {
      toast.error("Please add at least one product")
      return
    }

    if (!shippingPincode || shippingPincode.length !== 6) {
      toast.error("Please enter a valid 6-digit delivery pincode")
      return
    }

    setSaving(true)

    try {
      const distributor = distributors.find((c) => c.id === selectedDistributor)
      if (!distributor) throw new Error("Distributor not found")

      const { subtotal, totalGst, total, cgstAmount, sgstAmount, igstAmount } = calculateOrderTotals()

      const orderNumber = `ORD-${Date.now()}`

      // Determine shipping address based on selection
      let shippingFullAddress = ""

      if (shippingAddressOption === "customer_structured") {
        // Build full address from distributor's existing structured shipping fields
        const addressParts = []
        if (distributor.shipping_building_name) addressParts.push(distributor.shipping_building_name)
        if (distributor.shipping_street_area) addressParts.push(distributor.shipping_street_area)
        if (distributor.shipping_city) addressParts.push(distributor.shipping_city)
        if (distributor.shipping_state) addressParts.push(distributor.shipping_state)
        if (distributor.shipping_pincode) addressParts.push(distributor.shipping_pincode)

        shippingFullAddress = addressParts.join(", ")
      } else if (shippingAddressOption === "custom") {
        // Build full address from structured custom fields
        const addressParts = []
        if (customAddressFields.room_number) addressParts.push(`Room: ${customAddressFields.room_number}`)
        if (customAddressFields.floor) addressParts.push(`Floor: ${customAddressFields.floor}`)
        if (customAddressFields.wing) addressParts.push(`Wing: ${customAddressFields.wing}`)
        if (customAddressFields.building_name) addressParts.push(customAddressFields.building_name)
        if (customAddressFields.street_area) addressParts.push(customAddressFields.street_area)
        if (customAddressFields.landmark) addressParts.push(`Near ${customAddressFields.landmark}`)
        if (customAddressFields.city) addressParts.push(customAddressFields.city)
        if (customAddressFields.state) addressParts.push(customAddressFields.state)
        if (customAddressFields.pincode) addressParts.push(customAddressFields.pincode)

        shippingFullAddress = addressParts.join(", ")
      }

      // shipping_state specifically is NOT cosmetic: GSTR-1, the GST-orders
      // report, and Tally export all read it directly to tell interstate
      // from intrastate supply, so leaving it null silently broke those for
      // every order. Mirrors the same per-mode source used to build
      // shippingFullAddress above (see app/dashboard/orders/new/page.tsx for
      // the identical fix on the other order-creation page).
      const shippingState =
        shippingAddressOption === "custom"
          ? (customAddressFields.state || "").trim()
          : (distributor.shipping_state || "").trim()

      // Always store in shipping_full_address
      const shippingData = {
        shipping_full_address: shippingFullAddress,
        shipping_pincode: shippingPincode,
        shipping_room_number: null,
        shipping_floor: null,
        shipping_wing: null,
        shipping_flat_number: null,
        shipping_floor_wing: null,
        shipping_building_name: null,
        shipping_street_area: null,
        shipping_landmark: null,
        shipping_city: null,
        shipping_state: shippingState || null,
      }

      const isSubdistributorOrder = distributor.entity_type === "subdistributor"
      const isCustomerOrder = distributor.entity_type === "customer"
      const isDistributorOrder = distributor.entity_type === "distributor"

      const orderData = {
        order_number: orderNumber,
        customer_id: isCustomerOrder ? selectedDistributor : null,
        distributor_id: isCustomerOrder ? null : selectedDistributor,
        retailer_id: null,
        is_distributor: isDistributorOrder,
        is_subdistributor: isSubdistributorOrder,
        is_gst_invoice: isGstInvoice,
        customer_gst_number: distributor.gst_number || tempGstNumber || null,
        customer_pan_number: distributor.pan_card_number || tempPanNumber || null,
        order_status: orderStatus,
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        source: "backend",
        ...shippingData,
        billing_building_name: distributor.shipping_building_name,
        billing_street_area: distributor.shipping_street_area,
        billing_city: distributor.shipping_city,
        billing_state: distributor.shipping_state,
        billing_pincode: distributor.shipping_pincode,
        subtotal: subtotal,
        discount_amount: discountAmount,
        gst_amount: totalGst,
        cgst_amount: cgstAmount,
        sgst_amount: sgstAmount,
        igst_amount: igstAmount,
        shipping_charges: shippingCharges,
        total_amount: total,
        is_priority: isPriority,
        courier_partner: courierPartner || null,
        tracking_number: trackingNumber || null,
        expected_delivery_date: expectedDeliveryDate || null,
        order_notes: orderNotes || null,
        customer_notes: customerNotes || null,
        internal_notes: internalNotes || null,
        order_date: (invoiceOrderDate || new Date()).toISOString(),
        created_by_user_id: currentUserId,
        created_by_agent_id: currentAgentId,
        created_by_agent_name: currentAgentName,
        source_godown_id: null, // Source is factory, not a godown
        destination_godown_id: destinationWarehouseId,
        is_factory_order: true,
        delivery_partner_id: null,
        assigned_to_delivery_at: null,
        delivery_status: null,
      }

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert([orderData])
        .select()
        .single()

      if (orderError) throw orderError

      const orderItemsData = orderItems.map((item) => {
        const itemSubtotal = item.quantity * item.unit_price
        const netAmount = itemSubtotal - item.discount_amount
        const itemGst = (netAmount * item.gst_percentage) / (100 + item.gst_percentage)

        return {
          order_id: order.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percentage,
          discount_amount: item.discount_amount,
          hsn_code: item.hsn_code,
          gst_percentage: item.gst_percentage,
          gst_amount: itemGst,
          subtotal: itemSubtotal,
          total: item.gross_amount,
          item_description: item.description || null,
        }
      })

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItemsData)

      if (itemsError) throw itemsError

      // Customer orders: deduct factory stock immediately.
      // Distributor/subdistributor orders defer deduction to invoice conversion in /distributor-orders.
      if (isCustomerOrder) {
        for (const item of orderItems) {
          const { data: factoryStock } = await supabase
            .from("factory_warehouse_stock")
            .select("id, quantity")
            .eq("product_id", item.product_id)
            .maybeSingle()

          if (factoryStock) {
            const currentQty = factoryStock.quantity || 0
            const newQty = Math.max(0, currentQty - item.quantity)
            if (currentQty < item.quantity) {
              toast.warning(`${item.product_name}: Factory stock insufficient — set to 0.`)
            }
            await supabase
              .from("factory_warehouse_stock")
              .update({ quantity: newQty })
              .eq("id", factoryStock.id)
          }
        }
        toast.success("Order created and factory stock deducted.")
      } else {
        toast.success("Order created. Stock will be deducted when invoice is generated.")
      }

      router.push("/dashboard/orders")
    } catch (error: unknown) {
      console.error("Error creating order:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to create order"
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const { subtotal, totalItemDiscount, totalGst, total, cgstAmount, sgstAmount, igstAmount, isInterState, customerStateMissing } = useMemo(() => {
    return calculateOrderTotals()
  }, [orderItems, shippingCharges, discountAmount, distributors, selectedDistributor])

  const selectedDistributorData = distributors.find((c) => c.id === selectedDistributor)

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/orders")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Order from Factory</h1>
          <p className="text-muted-foreground">Select a distributor or customer and add products from factory warehouse</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/dashboard/orders")}>
            Cancel
          </Button>
          <Button onClick={handleCreateOrder} disabled={saving || orderItems.length === 0}>
            {saving ? "Creating..." : "Create Order"}
          </Button>
        </div>
      </div>

      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="tally-invoice-upload" className="text-sm font-medium">
                Auto-fill from Tally Sales PDF or Screenshot
              </Label>
              <p className="text-sm text-muted-foreground">
                Upload — or just paste (Ctrl+V) — a Tally-generated Sales invoice PDF or screenshot to automatically fill in the buyer, date, and items.
                Review everything before saving.
              </p>
            </div>
            <div>
              <input
                id="tally-invoice-upload"
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                disabled={uploadingInvoice}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleInvoiceUpload(file)
                  e.target.value = ""
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={uploadingInvoice}
                onClick={() => document.getElementById("tally-invoice-upload")?.click()}
              >
                {uploadingInvoice ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Reading invoice...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload PDF/Screenshot
                  </>
                )}
              </Button>
            </div>
          </div>
          {invoiceNumberParsed && (
            <p className="text-sm text-muted-foreground mt-3">
              Loaded from invoice <span className="font-medium">{invoiceNumberParsed}</span>
              {invoiceOrderDate ? ` dated ${invoiceOrderDate.toLocaleDateString()}` : ""}.
            </p>
          )}
          {invoiceWarnings.length > 0 && (
            <Alert variant="destructive" className="mt-3">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc pl-4 space-y-1">
                  {invoiceWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          {unmatchedInvoiceItems.length > 0 && (
            <div className="mt-3 space-y-2">
              {unmatchedInvoiceItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-md border p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      HSN {item.hsnCode} · Qty {item.quantity} · Rate ₹{item.ratePerUnitInclTax}
                    </p>
                  </div>
                  <Select
                    value={item.pickedProductId}
                    onValueChange={(value) =>
                      setUnmatchedInvoiceItems((prev) =>
                        prev.map((i) => (i.id === item.id ? { ...i, pickedProductId: value } : i))
                      )
                    }
                  >
                    <SelectTrigger className="w-[280px]">
                      <SelectValue placeholder="Select the matching product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!item.pickedProductId}
                    onClick={() => resolveUnmatchedInvoiceItem(item.id)}
                  >
                    Add
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        {/* Main Form */}
        <div className="space-y-6">
          {/* Distributor Selection */}
          <Card>
            <CardContent className="space-y-5 pt-0">
              {/* Search Input - Full Width */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="distributor-search" className="text-sm font-medium">
                    Search & Select Distributor <span className="text-destructive">*</span>
                  </Label>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="distributor-search"
                    placeholder="Search distributors by name, phone, email, company, GST..."
                    value={distributorSearch}
                    onChange={(e) => setDistributorSearch(e.target.value)}
                    className="pl-9 h-11"
                  />
                </div>
              </div>

              {/* Search Results */}
              {distributorSearch && (
                <div className="space-y-3">
                  {/* Filter Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-muted-foreground">Filter by:</span>
                    <Button
                      type="button"
                      variant={entityTypeFilter === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setEntityTypeFilter("all")}
                      className="h-7 text-xs"
                    >
                      All
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEntityTypeFilter("distributor")}
                      className={cn(
                        "h-7 text-xs",
                        entityTypeFilter === "distributor"
                          ? "bg-purple-500 text-white border-purple-600 hover:bg-purple-600 hover:text-white"
                          : "hover:bg-purple-50"
                      )}
                    >
                      Distributors
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEntityTypeFilter("subdistributor")}
                      className={cn(
                        "h-7 text-xs",
                        entityTypeFilter === "subdistributor"
                          ? "bg-indigo-500 text-white border-indigo-600 hover:bg-indigo-600 hover:text-white"
                          : "hover:bg-indigo-50"
                      )}
                    >
                      Subdistributors
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEntityTypeFilter("customer")}
                      className={cn(
                        "h-7 text-xs",
                        entityTypeFilter === "customer"
                          ? "bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600 hover:text-white"
                          : "hover:bg-emerald-50"
                      )}
                    >
                      Customers
                    </Button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {isSearching ? "Searching..." : `Found ${searchResults.filter(r => entityTypeFilter === "all" || r.entity_type === entityTypeFilter).length} result${searchResults.filter(r => entityTypeFilter === "all" || r.entity_type === entityTypeFilter).length !== 1 ? 's' : ''}`}
                    </span>
                  </div>

                  {!isSearching && searchResults.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No results found matching &quot;{distributorSearch}&quot;
                      </AlertDescription>
                    </Alert>
                  ) : !isSearching && searchResults.filter(r => entityTypeFilter === "all" || r.entity_type === entityTypeFilter).length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No {entityTypeFilter === "all" ? "results" : entityTypeFilter === "distributor" ? "distributors" : entityTypeFilter === "subdistributor" ? "subdistributors" : "customers"} found matching &quot;{distributorSearch}&quot;
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
                      {searchResults.filter(r => entityTypeFilter === "all" || r.entity_type === entityTypeFilter).map((dist) => (
                        <div
                          key={dist.id}
                          onClick={() => {
                            setSelectedDistributor(dist.id)
                            setDistributors([dist])
                            setDistributorSearch("")
                            setSearchResults([])
                            // Clear temporary GST/PAN values when switching
                            setTempGstNumber("")
                            setTempPanNumber("")
                            // Auto-enable GST invoice if distributor has GST number or PAN card
                            if (dist.gst_number || dist.pan_card_number) {
                              setIsGstInvoice(true)
                            }
                          }}
                          className={cn(
                            "p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md",
                            selectedDistributor === dist.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h4 className="font-semibold text-sm">
                                  {dist.first_name} {dist.last_name}
                                </h4>
                                {dist.entity_type === "distributor" && (
                                  <Badge variant="default" className="text-xs bg-purple-500">Distributor</Badge>
                                )}
                                {dist.entity_type === "subdistributor" && (
                                  <Badge variant="default" className="text-xs bg-indigo-500">Subdistributor</Badge>
                                )}
                                {dist.entity_type === "customer" && (
                                  <Badge variant="default" className="text-xs bg-emerald-500">Customer</Badge>
                                )}
                                {dist.parent_distributor_name && (
                                  <Badge variant="outline" className="text-xs">
                                    Parent: {dist.parent_distributor_name}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <span className="font-medium">Phone:</span>
                                  {dist.mobile_primary}
                                </span>
                                {dist.email && (
                                  <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      <span className="font-medium">Email:</span>
                                      {dist.email}
                                    </span>
                                  </>
                                )}
                                {dist.company_name && (
                                  <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      <span className="font-medium">Company:</span>
                                      {dist.company_name}
                                    </span>
                                  </>
                                )}
                                {dist.gst_number && (
                                  <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      <span className="font-medium">GST:</span>
                                      <span className="font-mono">{dist.gst_number}</span>
                                    </span>
                                  </>
                                )}
                                {!dist.gst_number && dist.pan_card_number && (
                                  <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      <span className="font-medium">PAN:</span>
                                      <span className="font-mono">{dist.pan_card_number}</span>
                                    </span>
                                  </>
                                )}
                              </div>
                              <div className="text-sm font-medium text-muted-foreground mt-1.5">
                                {dist.shipping_city}, {dist.shipping_state} - {dist.shipping_pincode}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Previous Orders Section */}
              {selectedDistributor && previousOrders.length > 0 && (
                <div className="mt-4">
                  <div
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted/70 transition-colors"
                    onClick={() => setShowPreviousOrders(!showPreviousOrders)}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Previous Orders ({previousOrders.length})</span>
                    </div>
                    {showPreviousOrders ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  {showPreviousOrders && (
                    <div className="mt-2 space-y-2">
                      {previousOrders.map((order) => (
                        <div
                          key={order.id}
                          className="flex items-center justify-between p-3 bg-background border rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{order.order_number}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(order.order_date), "dd MMM yyyy")} •{" "}
                              ₹{order.total_amount?.toLocaleString("en-IN")} •{" "}
                              {order.order_items?.length || 0} items
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              loadOrderForReorder(order.id)
                            }}
                          >
                            Use
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedDistributorData && (
                <>
                  <Separator className="my-5" />

                  {/* Shipping Address Selection */}
                  <div className="grid grid-cols-6 gap-4">
                    {/* Shipping Address - 2/3 width (4 columns) */}
                    <div className="col-span-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Shipping Address</Label>
                      </div>

                      <div className="space-y-3">
                      {/* Distributor Structured Address Option */}
                      {(selectedDistributorData.shipping_building_name || selectedDistributorData.shipping_street_area || selectedDistributorData.shipping_city || selectedDistributorData.shipping_pincode) && (
                        <div
                          onClick={() => setShippingAddressOption("customer_structured")}
                          className={cn(
                            "p-4 rounded-lg border-2 cursor-pointer transition-all",
                            shippingAddressOption === "customer_structured"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center",
                              shippingAddressOption === "customer_structured" ? "border-primary" : "border-muted-foreground"
                            )}>
                              {shippingAddressOption === "customer_structured" && (
                                <div className="w-3 h-3 rounded-full bg-primary" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold text-sm">Use Distributor Shipping Address</h4>
                                <Badge variant="secondary" className="text-xs">Saved Fields</Badge>
                              </div>
                              <div className="p-3 rounded-md bg-muted/50 border border-border text-sm leading-relaxed text-foreground">
                                {[
                                  selectedDistributorData.shipping_building_name,
                                  selectedDistributorData.shipping_street_area,
                                  selectedDistributorData.shipping_city,
                                  selectedDistributorData.shipping_state,
                                  selectedDistributorData.shipping_pincode,
                                ].filter(Boolean).join(", ")}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Custom Address Option */}
                      <div
                        onClick={() => setShippingAddressOption("custom")}
                        className={cn(
                          "p-4 rounded-lg border-2 cursor-pointer transition-all",
                          shippingAddressOption === "custom"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center",
                            shippingAddressOption === "custom" ? "border-primary" : "border-muted-foreground"
                          )}>
                            {shippingAddressOption === "custom" && (
                              <div className="w-3 h-3 rounded-full bg-primary" />
                            )}
                          </div>
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-sm">Use Custom Address</h4>
                              <Badge variant="outline" className="text-xs">Custom</Badge>
                            </div>
                            {shippingAddressOption === "custom" && (
                              <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
                                <div className="space-y-2">
                                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Fill Complete Address Details
                                  </Label>
                                  <p className="text-xs text-muted-foreground">
                                    All fields will be combined into a single address for the order
                                  </p>
                                </div>

                                {/* Address Fields Grid */}
                                <div className="grid grid-cols-3 gap-3">
                                  <div className="space-y-1">
                                    <Label htmlFor="custom_room" className="text-xs">Room Number</Label>
                                    <Input
                                      id="custom_room"
                                      placeholder="e.g., 501"
                                      value={customAddressFields.room_number}
                                      onChange={(e) => setCustomAddressFields({ ...customAddressFields, room_number: e.target.value })}
                                      className="h-9 text-sm"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label htmlFor="custom_floor" className="text-xs">Floor</Label>
                                    <Input
                                      id="custom_floor"
                                      placeholder="e.g., 5th"
                                      value={customAddressFields.floor}
                                      onChange={(e) => setCustomAddressFields({ ...customAddressFields, floor: e.target.value })}
                                      className="h-9 text-sm"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label htmlFor="custom_wing" className="text-xs">Wing</Label>
                                    <Input
                                      id="custom_wing"
                                      placeholder="e.g., A"
                                      value={customAddressFields.wing}
                                      onChange={(e) => setCustomAddressFields({ ...customAddressFields, wing: e.target.value })}
                                      className="h-9 text-sm"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <Label htmlFor="custom_building" className="text-xs">
                                    Building Name
                                  </Label>
                                  <Input
                                    id="custom_building"
                                    placeholder="e.g., Ocean View Apartments"
                                    value={customAddressFields.building_name}
                                    onChange={(e) => setCustomAddressFields({ ...customAddressFields, building_name: e.target.value })}
                                    className="h-9 text-sm"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <Label htmlFor="custom_street" className="text-xs">
                                    Street/Area
                                  </Label>
                                  <Input
                                    id="custom_street"
                                    placeholder="e.g., MG Road, Andheri West"
                                    value={customAddressFields.street_area}
                                    onChange={(e) => setCustomAddressFields({ ...customAddressFields, street_area: e.target.value })}
                                    className="h-9 text-sm"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <Label htmlFor="custom_landmark" className="text-xs">Landmark</Label>
                                  <Input
                                    id="custom_landmark"
                                    placeholder="e.g., Near City Mall"
                                    value={customAddressFields.landmark}
                                    onChange={(e) => setCustomAddressFields({ ...customAddressFields, landmark: e.target.value })}
                                    className="h-9 text-sm"
                                  />
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                  <div className="space-y-1">
                                    <Label htmlFor="custom_city" className="text-xs">
                                      City
                                    </Label>
                                    <Input
                                      id="custom_city"
                                      placeholder="e.g., Mumbai"
                                      value={customAddressFields.city}
                                      onChange={(e) => setCustomAddressFields({ ...customAddressFields, city: e.target.value })}
                                      className="h-9 text-sm"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label htmlFor="custom_state" className="text-xs">
                                      State
                                    </Label>
                                    <Input
                                      id="custom_state"
                                      placeholder="e.g., Maharashtra"
                                      value={customAddressFields.state}
                                      onChange={(e) => setCustomAddressFields({ ...customAddressFields, state: e.target.value })}
                                      className="h-9 text-sm"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label htmlFor="custom_pincode_field" className="text-xs">
                                      Pincode
                                    </Label>
                                    <Input
                                      id="custom_pincode_field"
                                      placeholder="6 digits"
                                      value={customAddressFields.pincode}
                                      onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, "").slice(0, 6)
                                        handlePincodeChange(value, 'custom')
                                      }}
                                      maxLength={6}
                                      className="h-9 text-sm font-mono"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    </div>

                    {/* Pincode Field - Always Required - 1/3 width */}
                    <div className="col-span-1 space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Delivery Pincode</Label>
                      </div>
                      <div className="space-y-2 p-4 bg-amber-50 border-2 border-amber-200 rounded-lg h-fit">
                        <Label htmlFor="shippingPincode" className="text-sm font-semibold flex items-center gap-2">
                          Pincode <span className="text-destructive">*</span>
                          {shippingPincode && (
                            <Badge variant="secondary" className="text-xs">Detected</Badge>
                          )}
                        </Label>
                        <Input
                          id="shippingPincode"
                          type="text"
                          placeholder="6 digits"
                          value={shippingPincode}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, "").slice(0, 6)
                            setShippingPincode(value)
                          }}
                          maxLength={6}
                          className="font-mono text-base"
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Required for delivery.
                        </p>
                      </div>
                    </div>

                    {/* Payment Method - 1/3 width */}
                    <div className="col-span-1 space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Payment Method</Label>
                      </div>
                      <div className="space-y-2 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg h-fit">
                        <Label htmlFor="paymentMethodTop" className="text-sm font-semibold flex items-center gap-2">
                          Payment Method <span className="text-destructive">*</span>
                        </Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                          <SelectTrigger id="paymentMethodTop" className="bg-white h-11 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="card">Card</SelectItem>
                            <SelectItem value="upi">UPI</SelectItem>
                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                            <SelectItem value="cheque">Cheque</SelectItem>
                            <SelectItem value="balance">Balance</SelectItem>
                            <SelectItem value="cod">Cash on Delivery</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Select payment method
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator className="my-5" />

                  <div className="rounded-lg border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-5 space-y-4">
                    {/* Header with Name */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-lg leading-none mb-1">
                          {selectedDistributorData.first_name} {selectedDistributorData.last_name}
                        </h3>
                        {selectedDistributorData.company_name && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {selectedDistributorData.company_name}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 justify-end">
                        {selectedDistributorData.entity_type === "distributor" && (
                          <Badge variant="default" className="shadow-sm bg-purple-500">Distributor</Badge>
                        )}
                        {selectedDistributorData.entity_type === "subdistributor" && (
                          <Badge variant="default" className="shadow-sm bg-indigo-500">Subdistributor</Badge>
                        )}
                        {selectedDistributorData.entity_type === "customer" && (
                          <Badge variant="default" className="shadow-sm bg-emerald-500">Customer</Badge>
                        )}
                        {selectedDistributorData.parent_distributor_name && (
                          <Badge variant="outline" className="shadow-sm text-xs">
                            Parent: {selectedDistributorData.parent_distributor_name}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* GST Number or PAN Card */}
                    {selectedDistributorData.gst_number && (
                      <div className="flex items-center gap-2 text-sm bg-white/50 rounded-md px-3 py-2">
                        <span className="text-muted-foreground font-medium">GST:</span>
                        <span className="font-mono">{selectedDistributorData.gst_number}</span>
                      </div>
                    )}
                    {!selectedDistributorData.gst_number && selectedDistributorData.pan_card_number && (
                      <div className="flex items-center gap-2 text-sm bg-white/50 rounded-md px-3 py-2">
                        <span className="text-muted-foreground font-medium">PAN:</span>
                        <span className="font-mono">{selectedDistributorData.pan_card_number}</span>
                      </div>
                    )}

                    <Separator className="bg-primary/20" />

                    {/* Contact and Address Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Contact Information */}
                      <div className="space-y-2.5">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                          Contact Details
                        </h4>
                        <div className="space-y-2">
                          <div className="flex items-start gap-2.5">
                            <span className="text-muted-foreground text-sm min-w-[80px]">Mobile:</span>
                            <span className="font-medium text-sm">{selectedDistributorData.mobile_primary}</span>
                          </div>
                          {selectedDistributorData.email && (
                            <div className="flex items-start gap-2.5">
                              <span className="text-muted-foreground text-sm min-w-[80px]">Email:</span>
                              <span className="text-sm break-all">{selectedDistributorData.email}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Shipping Address */}
                      <div className="space-y-2.5">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                          Shipping Address
                        </h4>
                        <div className="text-base leading-relaxed font-medium">
                          <div>{selectedDistributorData.shipping_building_name}</div>
                          <div>{selectedDistributorData.shipping_street_area}</div>
                          <div className="mt-1.5 font-semibold">
                            {selectedDistributorData.shipping_city}, {selectedDistributorData.shipping_state} - {selectedDistributorData.shipping_pincode}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Factory Stock Info Banner */}
          <Alert className="border-blue-200 bg-blue-50">
            <Package className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-800">
              <strong>Source: Factory Warehouse</strong> — {selectedDistributorData?.entity_type === "customer" ? "Factory stock will be deducted immediately on order creation." : "Stock will be deducted from factory warehouse and added to the distributor's godown when the invoice is generated."}
            </AlertDescription>
          </Alert>

          {/* Products */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Items
              </CardTitle>
              <CardDescription>Add products from factory warehouse</CardDescription>
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

              {/* Product Selection */}
              <div className="flex gap-2">
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={`Select a product (${filteredProducts.length} available)`} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{product.name}</span>
                          <div className="flex items-center gap-2 ml-4">
                            <span className="text-sm">₹{product.customer_price}</span>
                            {product.factory_stock !== null && (
                              <Badge variant={product.factory_stock > 10 ? "secondary" : product.factory_stock > 0 ? "outline" : "destructive"} className="text-xs">
                                Factory: {product.factory_stock}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Label htmlFor="quantity" className="text-sm font-medium whitespace-nowrap">
                    Qty:
                  </Label>
                  <div className="flex items-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-8 rounded-r-none border-r-0"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                      className="w-16 rounded-none text-center"
                      placeholder="Qty"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-8 rounded-l-none border-l-0"
                      onClick={() => setQuantity(quantity + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <Button type="button" onClick={handleAddProduct} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>

              {orderItems.length > 0 && (
                <div className="rounded-md border overflow-x-auto [&_th]:border-r [&_th:last-child]:border-r-0 [&_td]:border-r [&_td:last-child]:border-r-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-center">Quantity</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-center">Disc %</TableHead>
                        <TableHead className="text-right">Disc Amt</TableHead>
                        <TableHead className="text-right">Net Amount</TableHead>
                        <TableHead className="text-center">GST %</TableHead>
                        <TableHead className="text-right">GST Amt</TableHead>
                        <TableHead className="text-right">Gross Amt</TableHead>
                        <TableHead className="w-20 text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderItems.map((item) => {
                        const itemSubtotal = item.quantity * item.unit_price
                        const netAmount = itemSubtotal - item.discount_amount
                        const itemGst = (netAmount * item.gst_percentage) / (100 + item.gst_percentage)

                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              <div>
                                {item.product_name}
                                {item.stock !== null && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Factory Stock: {item.stock}
                                  </div>
                                )}
                                <Input
                                  value={item.description || ""}
                                  onChange={(e) => handleUpdateItemDescription(item.id, e.target.value)}
                                  placeholder="Add description (optional)"
                                  className="h-7 text-xs mt-1.5 font-normal"
                                />
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-7 rounded-r-none border-r-0"
                                  onClick={() => handleUpdateItemQuantity(item.id, Math.max(1, item.quantity - 1))}
                                  disabled={item.quantity <= 1}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const newQty = parseInt(e.target.value) || 1
                                    handleUpdateItemQuantity(item.id, newQty)
                                  }}
                                  className="w-14 h-8 text-center rounded-none"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-7 rounded-l-none border-l-0"
                                  onClick={() => handleUpdateItemQuantity(item.id, item.quantity + 1)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unit_price}
                                onChange={(e) => handleUpdateItemUnitPrice(item.id, parseFloat(e.target.value) || 0)}
                                className="w-24 h-8 text-right ml-auto"
                              />
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground">
                              {item.discount_percentage.toFixed(2)}%
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.discount_amount}
                                onChange={(e) => handleUpdateItemDiscountAmount(item.id, parseFloat(e.target.value) || 0)}
                                className="w-24 h-8 text-right ml-auto"
                              />
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ₹{netAmount.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center">{item.gst_percentage}%</TableCell>
                            <TableCell className="text-right">₹{itemGst.toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.gross_amount}
                                onChange={(e) => handleUpdateItemGrossAmount(item.id, parseFloat(e.target.value) || 0)}
                                className="w-28 h-8 text-right ml-auto font-medium"
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleRemoveProduct(item.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Details with Tabs */}
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
              <CardDescription>Configure payment, shipping, and additional details</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Agent Information Display */}
              {(currentAgentId || currentAgentName) && (
                <>
                  <div className="rounded-lg border bg-muted/50 p-4 mb-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Created By
                        </Label>
                        <div className="flex items-center gap-3">
                          {currentAgentName && (
                            <p className="font-semibold text-base">
                              {currentAgentName}
                            </p>
                          )}
                          {currentAgentId && (
                            <Badge variant="secondary" className="font-mono text-xs">
                              ID: {currentAgentId}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        Auto-detected
                      </Badge>
                    </div>
                  </div>
                  <Separator className="mb-6" />
                </>
              )}

              <Tabs defaultValue="payment" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="payment" className="flex items-center gap-2">
                    <IndianRupee className="h-4 w-4" />
                    Payment
                  </TabsTrigger>
                  <TabsTrigger value="shipping" className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Shipping
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Notes
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="payment" className="space-y-4 mt-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="shipping">Shipping Charges (₹)</Label>
                      <Input
                        id="shipping"
                        type="number"
                        min="0"
                        step="0.01"
                        value={shippingCharges}
                        onChange={(e) => setShippingCharges(parseFloat(e.target.value) || 0)}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paymentStatus">Payment Status</Label>
                      <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                        <SelectTrigger id="paymentStatus" className="h-11 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="orderStatus">Order Status</Label>
                      <Select value={orderStatus} onValueChange={setOrderStatus}>
                        <SelectTrigger id="orderStatus" className="h-11 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="packed">Packed</SelectItem>
                          <SelectItem value="shipped">Shipped</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="priority">Priority Order</Label>
                      <div className="text-sm text-muted-foreground">
                        Mark this order for priority processing
                      </div>
                    </div>
                    <Switch
                      id="priority"
                      checked={isPriority}
                      onCheckedChange={setIsPriority}
                    />
                  </div>

                  <div className="rounded-lg border bg-muted/20">
                    <div className="flex items-center justify-between p-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="gstInvoice" className="font-semibold">GST Invoice</Label>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs font-mono px-1.5 py-0.5">1</Badge>
                            <span className="text-xs text-muted-foreground">GST</span>
                            <Badge variant="outline" className="text-xs font-mono px-1.5 py-0.5 ml-2">2</Badge>
                            <span className="text-xs text-muted-foreground">Non-GST</span>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Enable for GST invoice generation (with tax invoice number)
                          {selectedDistributorData && (selectedDistributorData.gst_number || selectedDistributorData.pan_card_number) && (
                            <span className="block mt-1 text-xs text-primary font-medium">
                              Auto-enabled: Distributor has {selectedDistributorData.gst_number ? 'GST' : 'PAN'}
                            </span>
                          )}
                        </div>
                      </div>
                      <Switch
                        id="gstInvoice"
                        checked={isGstInvoice}
                        onCheckedChange={setIsGstInvoice}
                      />
                    </div>
                    {selectedDistributorData && (
                      <div className="px-4 pb-4 pt-2 border-t bg-white/50">
                        {(selectedDistributorData.gst_number || selectedDistributorData.pan_card_number) ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              {selectedDistributorData.gst_number ? 'GST Number:' : 'PAN Card:'}
                            </span>
                            <span className="text-sm font-mono font-semibold">
                              {selectedDistributorData.gst_number || selectedDistributorData.pan_card_number}
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-xs text-muted-foreground">
                              Distributor doesn&apos;t have GST or PAN saved. Add for this order:
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label htmlFor="tempGst" className="text-xs font-medium">GST Number (Optional)</Label>
                                <Input
                                  id="tempGst"
                                  placeholder="e.g., 22AAAAA0000A1Z5"
                                  value={tempGstNumber}
                                  onChange={(e) => {
                                    const value = e.target.value.toUpperCase()
                                    setTempGstNumber(value)
                                    if (value) setTempPanNumber("")
                                  }}
                                  className="h-9 text-sm font-mono"
                                  maxLength={15}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor="tempPan" className="text-xs font-medium">PAN Card (Optional)</Label>
                                <Input
                                  id="tempPan"
                                  placeholder="e.g., ABCDE1234F"
                                  value={tempPanNumber}
                                  onChange={(e) => {
                                    const value = e.target.value.toUpperCase()
                                    setTempPanNumber(value)
                                    if (value) setTempGstNumber("")
                                  }}
                                  className="h-9 text-sm font-mono"
                                  maxLength={10}
                                  disabled={!!tempGstNumber}
                                />
                              </div>
                            </div>
                            <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                              Note: These values will only be used for this order and won&apos;t update the distributor&apos;s profile.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="shipping" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="courierPartner">Courier Partner</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open("/dashboard/courier-partners", "_blank")}
                          className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
                        >
                          Manage Partners
                        </Button>
                      </div>
                      <Select value={courierPartner} onValueChange={(value) => {
                        setCourierPartner(value)
                        const selectedCourier = courierPartners.find(cp => cp.code === value)
                        if (selectedCourier?.default_delivery_days) {
                          const deliveryDate = new Date()
                          deliveryDate.setDate(deliveryDate.getDate() + selectedCourier.default_delivery_days)
                          setExpectedDeliveryDate(deliveryDate)
                        }
                      }}>
                        <SelectTrigger id="courierPartner">
                          <SelectValue placeholder="Select courier" />
                        </SelectTrigger>
                        <SelectContent>
                          {courierPartners.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground text-center">
                              No active courier partners
                            </div>
                          ) : (
                            courierPartners.map((courier) => (
                              <SelectItem key={courier.id} value={courier.code}>
                                <div className="flex items-center justify-between w-full">
                                  <span>{courier.name}</span>
                                  {courier.default_delivery_days && (
                                    <span className="text-xs text-muted-foreground ml-2">
                                      {courier.default_delivery_days} days
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {(() => {
                        const selectedCourier = courierPartners.find(cp => cp.code === courierPartner)
                        if (selectedCourier?.tracking_url_template) {
                          return (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <ExternalLink className="h-3 w-3" />
                              Tracking available
                            </p>
                          )
                        }
                        return null
                      })()}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="trackingNumber">Tracking Number</Label>
                      <Input
                        id="trackingNumber"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder="Enter tracking number"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Expected Delivery Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !expectedDeliveryDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {expectedDeliveryDate ? format(expectedDeliveryDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={expectedDeliveryDate}
                          onSelect={setExpectedDeliveryDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </TabsContent>

                <TabsContent value="notes" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="orderNotes">Order Notes</Label>
                    <Textarea
                      id="orderNotes"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="Add notes about the order (visible to all)"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customerNotes">Distributor Notes</Label>
                    <Textarea
                      id="customerNotes"
                      value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value)}
                      placeholder="Add notes for the distributor"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="internalNotes">Internal Notes</Label>
                    <Textarea
                      id="internalNotes"
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      placeholder="Add internal notes (not visible to distributor)"
                      rows={3}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Order Summary - Full Width at Bottom */}
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {orderItems.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No items added yet. Add products to see the order summary.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-muted-foreground">Items:</span>
                      <span className="font-medium text-base">{orderItems.length}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="font-medium">₹{subtotal.toFixed(2)}</span>
                    </div>

                    {totalItemDiscount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Item Discounts:</span>
                        <span className="font-medium text-destructive">-₹{totalItemDiscount.toFixed(2)}</span>
                      </div>
                    )}

                    {customerStateMissing && selectedDistributor && (
                      <Alert variant="destructive" className="py-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          This buyer has no state on file — GST split below defaults to
                          CGST+SGST, which may be wrong if this is an inter-state sale.
                          Add their state to get an accurate split.
                        </AlertDescription>
                      </Alert>
                    )}

                    {isInterState ? (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">IGST:</span>
                        <span className="font-medium">₹{igstAmount.toFixed(2)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">CGST:</span>
                          <span className="font-medium">₹{cgstAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">SGST:</span>
                          <span className="font-medium">₹{sgstAmount.toFixed(2)}</span>
                        </div>
                      </>
                    )}

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total GST:</span>
                      <span className="font-medium">₹{totalGst.toFixed(2)}</span>
                    </div>

                    {shippingCharges > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Shipping:</span>
                        <span className="font-medium">₹{shippingCharges.toFixed(2)}</span>
                      </div>
                    )}

                    {discountAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Order Discount:</span>
                        <span className="font-medium text-destructive">-₹{discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center pt-2">
                    <span className="font-semibold text-lg">Total Amount:</span>
                    <span className="font-bold text-2xl text-primary">₹{total.toFixed(2)}</span>
                  </div>

                  {isInterState && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Inter-state transaction: IGST applicable
                      </AlertDescription>
                    </Alert>
                  )}

                  {isPriority && (
                    <Badge variant="default" className="w-full justify-center py-2">
                      Priority Order
                    </Badge>
                  )}

                  {isGstInvoice ? (
                    <Badge variant="outline" className="w-full justify-center py-2 border-green-500 text-green-700">
                      <FileText className="h-3 w-3 mr-1" />
                      GST Invoice will be generated
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="w-full justify-center py-2 border-blue-500 text-blue-700">
                      <FileText className="h-3 w-3 mr-1" />
                      Non-GST Invoice will be generated
                    </Badge>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Destination Warehouse - for distributor/subdistributor orders only */}
          {selectedDistributor && selectedDistributorData?.entity_type !== "customer" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Destination Warehouse
                </CardTitle>
                <CardDescription>
                  Stock will be added to the distributor&apos;s warehouse
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {noDestinationWarning && (
                  <div className="p-3 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-700">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                      <p className="text-sm text-red-800 dark:text-red-300">
                        <span className="font-semibold">This distributor has no warehouse/godown.</span>{" "}
                        Stock will be deducted from factory but not tracked at the distributor&apos;s end. You can still create the order.
                      </p>
                    </div>
                  </div>
                )}

                {distributorGodowns.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      {selectedDistributorData?.first_name} {selectedDistributorData?.last_name}&apos;s Warehouse
                    </Label>
                    {distributorGodowns.length === 1 ? (
                      <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-950 border-green-200">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">Auto-selected</Badge>
                          <span className="font-medium text-sm">{distributorGodowns[0].name}</span>
                          <span className="text-xs text-muted-foreground">({distributorGodowns[0].godown_code})</span>
                        </div>
                      </div>
                    ) : (
                      <Select
                        value={destinationWarehouseId || ""}
                        onValueChange={(value) => {
                          setDestinationWarehouseId(value)
                          const g = distributorGodowns.find(g => g.id === value)
                          setDestinationWarehouseName(g?.name || null)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select destination warehouse" />
                        </SelectTrigger>
                        <SelectContent>
                          {distributorGodowns.map(g => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.name} ({g.godown_code}) {g.is_primary ? " -- Primary" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Bottom Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => router.push("/dashboard/orders")}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrder} disabled={saving || orderItems.length === 0} size="lg">
              {saving ? "Creating..." : "Create Order"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
