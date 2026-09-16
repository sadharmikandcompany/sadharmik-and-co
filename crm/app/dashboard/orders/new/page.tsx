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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  UserPlus,
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
  ShoppingCart,
  Save,
  User,
  X
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { lookupPincode } from "@/lib/pincode-lookup"
import { WarehouseSelector } from "@/components/orders/warehouse-selector"
import { DeliveryPartnerSuggestions } from "@/components/orders/delivery-partner-suggestions"
import { useEntityData } from "@/hooks/use-entity-data"
import { useSaveShortcut } from "@/hooks/use-save-shortcut"

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

type Customer = {
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
  full_address: string | null
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
  // Not previously declared here even though `.select("*")` always returns
  // it — used as the customer-state fallback when shipping_state is blank.
  billing_state: string | null
  is_vip: boolean
  is_mandir: boolean
  is_defaulter: boolean
  vip_number: string | null
  entity_type?: "customer" | "distributor" | "subdistributor" | "retailer"
  parent_distributor_name?: string | null
}

type Product = {
  id: string
  name: string
  customer_price: number
  gst_percentage: number | null
  hsn_code: string | null
  stock: number | null
  warehouse_stock: number | null // Warehouse-specific stock
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

type CustomerFormData = {
  first_name: string
  last_name: string
  email: string
  mobile_primary: string
  whatsapp_number: string
  whatsapp_same_as_primary: boolean
  mobile_secondary_1: string
  mobile_secondary_2: string
  company_name: string
  gst_number: string
  pan_card_number: string
  full_address: string
  shipping_room_number: string
  shipping_floor: string
  shipping_wing: string
  shipping_flat_number: string
  shipping_floor_wing: string
  shipping_building_name: string
  shipping_street_area: string
  shipping_landmark: string
  shipping_city: string
  shipping_state: string
  shipping_pincode: string
  shipping_country: string
  billing_same_as_shipping: boolean
  billing_room_number: string
  billing_floor: string
  billing_wing: string
  billing_flat_number: string
  billing_floor_wing: string
  billing_building_name: string
  billing_street_area: string
  billing_landmark: string
  billing_city: string
  billing_state: string
  billing_pincode: string
  billing_country: string
  is_vip: boolean
  vip_number: string
  is_mandir: boolean
  is_defaulter: boolean
  is_active: boolean
}

export default function NewOrderPage() {
  const router = useRouter()
  const { entityType: sellerEntityType, entityDetails: sellerEntityDetails } = useEntityData()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [courierPartners, setCourierPartners] = useState<CourierPartner[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<string>("")
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
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false)
  const [savingCustomer, setSavingCustomer] = useState(false)
  const [useSameAddress, setUseSameAddress] = useState(true)
  const [customerFormErrors, setCustomerFormErrors] = useState<Record<string, string>>({})
  const [generatingVipNumber, setGeneratingVipNumber] = useState(false)

  // New fields
  const [courierPartner, setCourierPartner] = useState<string>("")
  const [trackingNumber, setTrackingNumber] = useState<string>("")
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<Date>()
  const [orderDate, setOrderDate] = useState<Date>()
  const [orderNotes, setOrderNotes] = useState<string>("")
  const [customerNotes, setCustomerNotes] = useState<string>("")
  const [internalNotes, setInternalNotes] = useState<string>("")
  const [customerSearch, setCustomerSearch] = useState<string>("")
  const [searchResults, setSearchResults] = useState<Customer[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [entityTypeFilter, setEntityTypeFilter] = useState<"all" | "customer" | "distributor" | "subdistributor" | "retailer">("all")

  // Agent tracking fields
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null)
  const [currentAgentName, setCurrentAgentName] = useState<string | null>(null)

  // Shipping address fields
  const [shippingAddressOption, setShippingAddressOption] = useState<"full_address" | "customer_structured" | "custom">("full_address")
  const [customShippingAddress, setCustomShippingAddress] = useState<string>("")
  const [saveAsCustomerAddress, setSaveAsCustomerAddress] = useState<boolean>(false)
  const [shippingPincode, setShippingPincode] = useState<string>("")
  const [isEditingFullAddress, setIsEditingFullAddress] = useState<boolean>(false)
  const [editedFullAddress, setEditedFullAddress] = useState<string>("")
  const [savingAddress, setSavingAddress] = useState<boolean>(false)

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

  // Warehouse and delivery partner selection
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null)
  const [selectedDeliveryPartnerId, setSelectedDeliveryPartnerId] = useState<string | null>(null)

  // Distributor destination warehouse
  const [destinationWarehouseId, setDestinationWarehouseId] = useState<string | null>(null)
  const [destinationWarehouseName, setDestinationWarehouseName] = useState<string | null>(null)
  const [distributorGodowns, setDistributorGodowns] = useState<{ id: string; name: string; godown_code: string; is_primary: boolean }[]>([])
  const [parentDistributorGodowns, setParentDistributorGodowns] = useState<{ id: string; name: string; godown_code: string; distributor_name: string }[]>([])
  const [noDestinationWarning, setNoDestinationWarning] = useState(false)

  // Previous orders for reorder functionality
  const [previousOrders, setPreviousOrders] = useState<any[]>([])
  const [loadingPreviousOrders, setLoadingPreviousOrders] = useState(false)
  const [showPreviousOrders, setShowPreviousOrders] = useState(false)

  const [customerFormData, setCustomerFormData] = useState<CustomerFormData>({
    first_name: "",
    last_name: "",
    email: "",
    mobile_primary: "",
    whatsapp_number: "",
    whatsapp_same_as_primary: false,
    mobile_secondary_1: "",
    mobile_secondary_2: "",
    company_name: "",
    gst_number: "",
    pan_card_number: "",
    full_address: "",
    shipping_room_number: "",
    shipping_floor: "",
    shipping_wing: "",
    shipping_flat_number: "",
    shipping_floor_wing: "",
    shipping_building_name: "",
    shipping_street_area: "",
    shipping_landmark: "",
    shipping_city: "",
    shipping_state: "",
    shipping_pincode: "",
    shipping_country: "India",
    billing_same_as_shipping: true,
    billing_room_number: "",
    billing_floor: "",
    billing_wing: "",
    billing_flat_number: "",
    billing_floor_wing: "",
    billing_building_name: "",
    billing_street_area: "",
    billing_landmark: "",
    billing_city: "",
    billing_state: "",
    billing_pincode: "",
    billing_country: "India",
    is_vip: false,
    vip_number: "",
    is_mandir: false,
    is_defaulter: false,
    is_active: true,
  })

  useEffect(() => {
    const loadData = async () => {
      await fetchCustomersAndProducts()

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

      // Handle auto-selection from URL parameter
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search)
        const phoneNumber = urlParams.get('phone')

        if (phoneNumber) {
          // Remove +91, 91 prefix from phone number
          const phoneWithoutCountryCode = phoneNumber.replace(/^\+91/, '').replace(/^91/, '')

          // Create two versions: with and without leading 0
          const cleanPhone = phoneWithoutCountryCode.replace(/^0/, '')
          const phoneWithZero = '0' + cleanPhone

          // Search for customer by phone number (search both with and without leading 0)
          // This will match if database has 8433804507 OR 08433804507, regardless of search input
          const { data: matchingCustomers } = await supabase
            .from("customers")
            .select("*")
            .eq("is_active", true)
            .or(`mobile_primary.eq.${cleanPhone},mobile_primary.eq.${phoneWithZero},mobile_secondary_1.eq.${cleanPhone},mobile_secondary_1.eq.${phoneWithZero},mobile_secondary_2.eq.${cleanPhone},mobile_secondary_2.eq.${phoneWithZero},whatsapp_number.eq.${cleanPhone},whatsapp_number.eq.${phoneWithZero}`)
            .limit(10)

          if (matchingCustomers && matchingCustomers.length > 0) {
            const selectedCustomer = matchingCustomers[0]
            if (matchingCustomers.length > 1) {
              toast.warning(`Multiple customers found with this number. Selected: ${selectedCustomer.first_name} ${selectedCustomer.last_name}`, {
                duration: 5000
              })
            } else {
              toast.success(`Customer auto-selected: ${selectedCustomer.first_name} ${selectedCustomer.last_name}`)
            }
            setSelectedCustomer(selectedCustomer.id)
            setCustomers([selectedCustomer])
          } else {
            toast.error(`Customer with phone ${phoneNumber} not found`)
          }
        }

        // Handle reorder from URL parameter
        const reorderId = urlParams.get('reorder')
        if (reorderId) {
          await loadOrderForReorder(reorderId)
        }
      }
    }

    loadData()
  }, [])

  // Fetch warehouse-specific stock when warehouse changes
  useEffect(() => {
    if (selectedWarehouseId) {
      fetchWarehouseStock(selectedWarehouseId)
    }
  }, [selectedWarehouseId])

  // Fetch previous orders when customer is selected
  useEffect(() => {
    const fetchPreviousOrders = async () => {
      if (!selectedCustomer) {
        setPreviousOrders([])
        return
      }

      setLoadingPreviousOrders(true)
      try {
        const customer = customers.find(c => c.id === selectedCustomer)
        if (!customer) {
          setLoadingPreviousOrders(false)
          return
        }

        // Build query based on entity type
        let query = supabase
          .from("orders")
          .select(`
            id, order_number, order_date, total_amount,
            order_items(product_name, quantity)
          `)
          .order("order_date", { ascending: false })
          .limit(5)

        if (customer.entity_type === 'distributor' || customer.entity_type === 'subdistributor') {
          query = query.eq("distributor_id", customer.id)
        } else {
          query = query.eq("customer_id", customer.id)
        }

        const { data } = await query
        setPreviousOrders(data || [])
      } catch (error) {
        console.error("Error fetching previous orders:", error)
      }
      setLoadingPreviousOrders(false)
    }

    fetchPreviousOrders()
  }, [selectedCustomer, customers])

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

  const fetchCustomersAndProducts = async () => {
    // Only fetch products, customers will be searched on-demand
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

    // Initialize products with null warehouse_stock
    const productsWithStock = (productsData || []).map(p => ({
      ...p,
      warehouse_stock: null
    }))

    setProducts(productsWithStock)
    setCategories(categoriesData || [])
    setCourierPartners(courierPartnersData || [])
    return []
  }

  // Fetch warehouse-specific stock for all products
  const fetchWarehouseStock = async (warehouseId: string) => {
    if (!warehouseId) {
      // Reset to null if no warehouse selected
      setProducts(prevProducts => prevProducts.map(p => ({
        ...p,
        warehouse_stock: null
      })))
      return
    }

    try {
      // Fetch stock for all products from the selected warehouse
      const { data: stockData, error } = await supabase
        .from("godown_stock")
        .select(`
          stock_inventory_id,
          available_quantity,
          stock_inventory!inner(product_id)
        `)
        .eq("godown_id", warehouseId)

      if (error) {
        console.error("Error fetching warehouse stock:", error)
        return
      }

      // Create a map of product_id -> available_quantity
      const stockMap = new Map<string, number>()
      if (stockData) {
        stockData.forEach((item: any) => {
          const productId = item.stock_inventory?.product_id
          if (productId) {
            stockMap.set(productId, item.available_quantity || 0)
          }
        })
      }

      // Update products with warehouse-specific stock
      setProducts(prevProducts => prevProducts.map(p => ({
        ...p,
        warehouse_stock: stockMap.get(p.id) ?? 0 // Use 0 if no stock record exists
      })))
    } catch (error) {
      console.error("Error fetching warehouse stock:", error)
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
          id: crypto.randomUUID(), // Unique ID for each line item
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

  const searchCustomers = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const searchLower = searchTerm.toLowerCase()

      // Create alternate phone number search (with/without leading 0)
      const phoneWithoutCountryCode = searchTerm.replace(/^\+91/, '').replace(/^91/, '')
      const cleanPhone = phoneWithoutCountryCode.replace(/^0/, '')
      const phoneWithZero = '0' + cleanPhone
      const phoneAlternate = phoneWithoutCountryCode.startsWith('0') ? cleanPhone : phoneWithZero

      // Search customers
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("*")
        .eq("is_active", true)
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,mobile_primary.ilike.%${searchTerm}%,mobile_secondary_1.ilike.%${searchTerm}%,mobile_secondary_2.ilike.%${searchTerm}%,whatsapp_number.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,vip_number.ilike.%${searchTerm}%,gst_number.ilike.%${searchTerm}%,pan_card_number.ilike.%${searchTerm}%,mobile_primary.ilike.%${phoneAlternate}%,mobile_secondary_1.ilike.%${phoneAlternate}%,mobile_secondary_2.ilike.%${phoneAlternate}%,whatsapp_number.ilike.%${phoneAlternate}%`)
        .limit(50)
        .order("first_name")

      // Search distributors
      const { data: distributorsData, error: distributorsError } = await supabase
        .from("distributors")
        .select("*")
        .eq("is_active", true)
        .or(`name.ilike.%${searchTerm}%,company_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone_primary.ilike.%${searchTerm}%,phone_secondary.ilike.%${searchTerm}%,phone_tertiary.ilike.%${searchTerm}%,gst_number.ilike.%${searchTerm}%,phone_primary.ilike.%${phoneAlternate}%,phone_secondary.ilike.%${phoneAlternate}%,phone_tertiary.ilike.%${phoneAlternate}%`)
        .limit(50)
        .order("name")

      // Search retailers
      const { data: retailersData, error: retailersError } = await supabase
        .from("retailers")
        .select("*")
        .eq("is_active", true)
        .or(`name.ilike.%${searchTerm}%,company_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone_primary.ilike.%${searchTerm}%,phone_secondary.ilike.%${searchTerm}%,retailer_code.ilike.%${searchTerm}%,phone_primary.ilike.%${phoneAlternate}%,phone_secondary.ilike.%${phoneAlternate}%`)
        .limit(50)
        .order("name")

      if (customersError || distributorsError || retailersError) {
        console.error("Search error:", customersError || distributorsError || retailersError)
        toast.error("Error searching")
        setSearchResults([])
        setIsSearching(false)
        return
      }

      // Transform distributors to Customer type
      const transformedDistributors: Customer[] = await Promise.all((distributorsData || []).map(async (dist) => {
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
          pan_card_number: dist.pan_card_number || null,
          full_address: null,
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
          // Distributors don't have a separate billing address of their own
          // — same source used for the order's billing_state elsewhere.
          billing_state: dist.shipping_state,
          is_vip: false,
          is_mandir: false,
          is_defaulter: false,
          vip_number: null,
          entity_type: dist.parent_id ? "subdistributor" : "distributor",
          parent_distributor_name: parentName,
        }
      }))

      // Transform retailers to Customer type
      const transformedRetailers: Customer[] = (retailersData || []).map((ret) => ({
        id: ret.id,
        first_name: ret.name.split(" ")[0] || ret.name,
        last_name: ret.name.split(" ").slice(1).join(" ") || "",
        email: ret.email,
        mobile_primary: ret.phone_primary,
        mobile_secondary_1: ret.phone_secondary,
        mobile_secondary_2: null,
        whatsapp_number: ret.phone_primary,
        whatsapp_same_as_primary: true,
        company_name: ret.company_name,
        gst_number: ret.gst_number,
        pan_card_number: ret.pan_card_number || null,
        full_address: null,
        shipping_building_name: ret.shipping_building || "",
        shipping_street_area: ret.shipping_street || "",
        shipping_city: ret.shipping_city || "",
        shipping_state: ret.shipping_state || "",
        shipping_pincode: ret.shipping_pincode || "",
        shipping_room_number: ret.shipping_room_number || null,
        shipping_floor: ret.shipping_floor_number || null,
        shipping_wing: ret.shipping_wing || null,
        shipping_flat_number: ret.shipping_flat_number || null,
        shipping_floor_wing: null,
        shipping_landmark: ret.shipping_landmark || null,
        // Retailers don't have a separate billing address of their own —
        // same source used for the order's billing_state elsewhere.
        billing_state: ret.shipping_state || null,
        is_vip: false,
        is_mandir: false,
        is_defaulter: false,
        vip_number: null,
        entity_type: "retailer" as const,
        parent_distributor_name: null,
      }))

      // Transform customers to add entity_type
      const transformedCustomers: Customer[] = (customersData || []).map((cust) => ({
        ...cust,
        entity_type: "customer" as const,
      }))

      // Combine and sort results
      const combinedResults = [...transformedCustomers, ...transformedDistributors, ...transformedRetailers].sort((a, b) => {
        const aName = `${a.first_name} ${a.last_name}`.toLowerCase()
        const bName = `${b.first_name} ${b.last_name}`.toLowerCase()
        return aName.localeCompare(bName)
      })

      setSearchResults(combinedResults)
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
      searchCustomers(customerSearch)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [customerSearch])

  // Category filter helpers
  const parentCategories = categories.filter(cat => cat.parent_category_id === null)

  const subCategories = selectedCategory && selectedCategory !== "all"
    ? categories.filter(cat => cat.parent_category_id === selectedCategory)
    : []

  // Reset subcategory when parent category changes
  useEffect(() => {
    setSelectedSubCategory("all")
  }, [selectedCategory])

  // Reset saveAsCustomerAddress when switching away from custom option
  useEffect(() => {
    if (shippingAddressOption !== "custom") {
      setSaveAsCustomerAddress(false)
    }
  }, [shippingAddressOption])

  // Reset editing state and auto-select best address option when customer changes
  useEffect(() => {
    setIsEditingFullAddress(false)
    setEditedFullAddress("")

    if (!selectedCustomer) return
    const customer = customers.find(c => c.id === selectedCustomer)
    if (!customer) return

    // Auto-select the best available address option
    if (customer.full_address) {
      setShippingAddressOption("full_address")
    } else if (customer.shipping_building_name || customer.shipping_street_area || customer.shipping_city || customer.shipping_pincode) {
      setShippingAddressOption("customer_structured")
    } else {
      setShippingAddressOption("custom")
    }
  }, [selectedCustomer, customers])

  // Fetch distributor/subdistributor godowns when entity is selected
  useEffect(() => {
    const fetchDistributorGodowns = async () => {
      // Reset state
      setDistributorGodowns([])
      setParentDistributorGodowns([])
      setDestinationWarehouseId(null)
      setDestinationWarehouseName(null)
      setNoDestinationWarning(false)

      if (!selectedCustomer) return
      const customer = customers.find(c => c.id === selectedCustomer)
      if (!customer) return

      // Only for distributors, subdistributors, and retailers
      if (customer.entity_type === "customer" || !customer.entity_type) return

      // Fetch this entity's godowns (retailers use retailer_id, distributors/subdistributors use distributor_id)
      const ownerColumn = customer.entity_type === "retailer" ? "retailer_id" : "distributor_id"
      const { data: godowns } = await supabase
        .from("godowns")
        .select("id, name, godown_code, is_primary")
        .eq(ownerColumn, customer.id)
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

      // For subdistributors: also fetch parent distributor's godowns as source suggestion
      if (customer.entity_type === "subdistributor") {
        // Get parent distributor ID from the distributors table
        const { data: distData } = await supabase
          .from("distributors")
          .select("parent_id")
          .eq("id", customer.id)
          .single()

        if (distData?.parent_id) {
          const { data: parentGodowns } = await supabase
            .from("godowns")
            .select("id, name, godown_code")
            .eq("distributor_id", distData.parent_id)
            .eq("is_active", true)
            .order("is_primary", { ascending: false })

          // Get parent distributor name
          const { data: parentDist } = await supabase
            .from("distributors")
            .select("name")
            .eq("id", distData.parent_id)
            .single()

          const parentName = parentDist?.name || "Parent Distributor"
          const transformedParentGodowns = (parentGodowns || []).map(g => ({
            ...g,
            distributor_name: parentName,
          }))
          setParentDistributorGodowns(transformedParentGodowns)

          // Auto-select parent's godown as source warehouse for subdistributor
          if (transformedParentGodowns.length > 0) {
            setSelectedWarehouseId(transformedParentGodowns[0].id)
          }
        }
      }
    }

    fetchDistributorGodowns()
  }, [selectedCustomer, customers])

  // Auto-detect and set pincode based on selected address option
  useEffect(() => {
    if (!selectedCustomer) {
      setShippingPincode("")
      return
    }

    const customer = customers.find((c) => c.id === selectedCustomer)
    if (!customer) return

    if (shippingAddressOption === "full_address" && customer.full_address) {
      // Try to extract pincode from full address (6 digits)
      const pincodeMatch = customer.full_address.match(/\b\d{6}\b/)
      setShippingPincode(pincodeMatch ? pincodeMatch[0] : customer.shipping_pincode || "")
    } else if (customer.shipping_pincode) {
      // Use customer's structured shipping pincode (works for all entity types)
      setShippingPincode(customer.shipping_pincode)
    }
  }, [selectedCustomer, shippingAddressOption, customers])

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

    // Calculate using same logic as table display
    // GST is included in product price, so gross_amount = netAmount (no GST added)
    const itemSubtotal = quantity * product.customer_price
    const discountAmount = 0 // Initially no discount
    const netAmount = itemSubtotal - discountAmount

    const newItem: OrderItem = {
      id: crypto.randomUUID(), // Unique ID for each line item
      product_id: product.id,
      product_name: product.name,
      quantity: quantity,
      unit_price: product.customer_price,
      discount_amount: discountAmount,
      discount_percentage: 0,
      gross_amount: netAmount,
      gst_percentage: product.gst_percentage || 0,
      hsn_code: product.hsn_code || "",
      stock: product.warehouse_stock ?? product.stock, // Use warehouse stock if available
    }

    setOrderItems([...orderItems, newItem])
    setSelectedProduct("")
    setQuantity(1)
    toast.success("Product added to order")
  }

  // Remove item by unique ID (allows duplicate products)
  const handleRemoveProduct = (itemId: string) => {
    setOrderItems(orderItems.filter((item) => item.id !== itemId))
    toast.success("Product removed from order")
  }


  // All update functions use itemId (unique ID) to support duplicate products
  const handleUpdateItemUnitPrice = (itemId: string, newUnitPrice: number) => {
    if (newUnitPrice < 0) return
    setOrderItems(orderItems.map(item => {
      if (item.id === itemId) {
        const itemSubtotal = item.quantity * newUnitPrice
        // Cap discount if it exceeds new subtotal
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

        // Recalculate discount percentage based on new quantity
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
        // Gross Amount = Net Amount = (quantity * unit_price) - discount
        // Recalculate unit_price from gross amount: unit_price = (grossAmount + discount) / quantity
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
    const customer = customers.find((c) => c.id === selectedCustomer)

    // Seller state: if a distributor/retailer is logged in creating their own sale,
    // GST is charged under THEIR registration, not Sadharmik & Company's. Admin/staff-created
    // orders fall back to Sadharmik & Company's own registration (Maharashtra).
    const companyState =
      (sellerEntityType === "distributor" || sellerEntityType === "retailer") &&
      sellerEntityDetails?.shipping_state
        ? sellerEntityDetails.shipping_state
        : "Maharashtra"

    const customerState = (customer?.shipping_state || customer?.billing_state || "").trim()
    // Don't silently assume intra-state when we don't actually know the customer's
    // state — that's exactly the bug we're fixing. Flag it instead.
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
      // GST is included in price - calculate for display only, not added to totals
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

    // Calculate total from actual gross amounts (which may have been manually edited)
    const itemsTotal = orderItems.reduce((sum, item) => sum + item.gross_amount, 0)
    const total = itemsTotal + shippingCharges - discountAmount

    return { subtotal, totalItemDiscount, totalGst, total, cgstAmount, sgstAmount, igstAmount, isInterState, customerStateMissing }
  }

  const handleOpenCustomerDialog = () => {
    setCustomerFormData({
      first_name: "",
      last_name: "",
      email: "",
      mobile_primary: "",
      whatsapp_number: "",
      whatsapp_same_as_primary: false,
      mobile_secondary_1: "",
      mobile_secondary_2: "",
      company_name: "",
      gst_number: "",
      pan_card_number: "",
      full_address: "",
      shipping_room_number: "",
      shipping_floor: "",
      shipping_wing: "",
      shipping_flat_number: "",
      shipping_floor_wing: "",
      shipping_building_name: "",
      shipping_street_area: "",
      shipping_landmark: "",
      shipping_city: "",
      shipping_state: "",
      shipping_pincode: "",
      shipping_country: "India",
      billing_same_as_shipping: true,
      billing_room_number: "",
      billing_floor: "",
      billing_wing: "",
      billing_flat_number: "",
      billing_floor_wing: "",
      billing_building_name: "",
      billing_street_area: "",
      billing_landmark: "",
      billing_city: "",
      billing_state: "",
      billing_pincode: "",
      billing_country: "India",
      is_vip: false,
      vip_number: "",
      is_mandir: false,
      is_defaulter: false,
      is_active: true,
    })
    setUseSameAddress(true)
    setCustomerDialogOpen(true)
  }

  const getNextVipNumber = async (): Promise<string> => {
    try {
      // Fetch all VIP numbers from the database
      const { data, error } = await supabase
        .from("customers")
        .select("vip_number")
        .not("vip_number", "is", null)

      if (error) {
        console.error("Error fetching VIP numbers:", error)
        throw error
      }

      if (!data || data.length === 0) {
        // No VIP numbers exist, start from 1000
        return "1000"
      }

      // Convert VIP numbers to integers, sort numerically, and get the highest
      const vipNumbers = data
        .map(item => parseInt(item.vip_number || "0", 10))
        .filter(num => !isNaN(num))
        .sort((a, b) => b - a)

      if (vipNumbers.length === 0) {
        // No valid numeric VIP numbers found, start from 1000
        return "1000"
      }

      const highestVipNumber = vipNumbers[0]
      const nextNumber = highestVipNumber + 1
      return nextNumber.toString()
    } catch (error) {
      console.error("Error generating VIP number:", error)
      // Return a fallback number if there's an error
      return Date.now().toString().slice(-4)
    }
  }

  const handleVipToggle = async (checked: boolean) => {
    if (checked && !customerFormData.vip_number) {
      // Auto-generate VIP number when VIP is checked and no VIP number exists
      setGeneratingVipNumber(true)
      try {
        const nextVipNumber = await getNextVipNumber()
        setCustomerFormData({ ...customerFormData, is_vip: true, vip_number: nextVipNumber })
        toast.success(`VIP number ${nextVipNumber} assigned automatically`)
      } catch (error) {
        console.error("Error generating VIP number:", error)
        toast.error("Failed to generate VIP number. Please enter manually.")
        setCustomerFormData({ ...customerFormData, is_vip: true })
      } finally {
        setGeneratingVipNumber(false)
      }
    } else {
      setCustomerFormData({ ...customerFormData, is_vip: checked })
    }
  }

  const validateCustomerForm = () => {
    const errors: Record<string, string> = {}

    // Email validation - only if provided
    if (customerFormData.email && customerFormData.email.trim().length > 0) {
      const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
      if (!customerFormData.email.match(emailRegex)) {
        errors.email = "Please enter a valid email address"
      }
    }

    // GST validation - must be exactly 15 characters if provided
    if (customerFormData.gst_number && customerFormData.gst_number.trim().length > 0) {
      if (customerFormData.gst_number.trim().length !== 15) {
        errors.gst_number = "GST number must be exactly 15 characters"
      }
    }

    // PAN validation - must match format: 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F)
    if (customerFormData.pan_card_number && customerFormData.pan_card_number.trim().length > 0) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
      if (!customerFormData.pan_card_number.match(panRegex)) {
        errors.pan_card_number = "PAN must be in format: 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F)"
      }
    }

    // Mobile number validation - must be exactly 10 digits
    const mobileRegex = /^\d{10}$/
    if (!customerFormData.mobile_primary.match(mobileRegex)) {
      errors.mobile_primary = "Mobile number must be exactly 10 digits"
    }

    // Indian pincode validation - must be exactly 6 digits
    const pincodeRegex = /^\d{6}$/

    // Required fields
    if (!customerFormData.first_name.trim()) {
      errors.first_name = "First name is required"
    }
    if (!customerFormData.last_name.trim()) {
      errors.last_name = "Last name is required"
    }

    // Check if full_address is provided
    const hasFullAddress = customerFormData.full_address && customerFormData.full_address.trim().length > 0

    // Address validation: Either full_address OR structured address fields must be provided
    if (!hasFullAddress) {
      // If no full address, validate structured address fields
      if (!customerFormData.shipping_building_name.trim()) {
        errors.shipping_building_name = "Building name is required"
      }
      if (!customerFormData.shipping_street_area.trim()) {
        errors.shipping_street_area = "Street/Area is required"
      }
      if (!customerFormData.shipping_pincode.trim()) {
        errors.shipping_pincode = "Pincode is required"
      } else if (!pincodeRegex.test(customerFormData.shipping_pincode.trim())) {
        errors.shipping_pincode = "Pincode must be exactly 6 digits"
      }
      if (!customerFormData.shipping_city.trim()) {
        errors.shipping_city = "City is required"
      }
      if (!customerFormData.shipping_state.trim()) {
        errors.shipping_state = "State is required"
      }
    } else {
      // If full_address is provided, still validate pincode format if it's filled in
      if (customerFormData.shipping_pincode.trim() && !pincodeRegex.test(customerFormData.shipping_pincode.trim())) {
        errors.shipping_pincode = "Pincode must be exactly 6 digits"
      }
    }

    // Validate billing pincode if billing address is different from shipping
    if (!customerFormData.billing_same_as_shipping && customerFormData.billing_pincode && customerFormData.billing_pincode.trim().length > 0) {
      if (!pincodeRegex.test(customerFormData.billing_pincode.trim())) {
        errors.billing_pincode = "Pincode must be exactly 6 digits"
      }
    }

    setCustomerFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSaveCustomer = async () => {
    if (!validateCustomerForm()) {
      toast.error("Please fix the validation errors before saving")
      return
    }

    setSavingCustomer(true)

    try {
      // Helper function to safely trim strings
      const safeTrim = (value: string | undefined): string => {
        return value?.trim() || ""
      }

      // Clean up the form data - convert empty strings to null for optional fields
      // Also sync new fields (room_number, floor, wing) with old fields (flat_number, floor_wing) for backward compatibility
      const floorWing = [safeTrim(customerFormData.shipping_floor), safeTrim(customerFormData.shipping_wing)]
        .filter(v => v !== "")
        .join(" / ")
      const billingFloorWing = [safeTrim(customerFormData.billing_floor), safeTrim(customerFormData.billing_wing)]
        .filter(v => v !== "")
        .join(" / ")

      const customerData: Record<string, unknown> = {
        first_name: safeTrim(customerFormData.first_name),
        last_name: safeTrim(customerFormData.last_name),
        email: safeTrim(customerFormData.email) || null,
        mobile_primary: safeTrim(customerFormData.mobile_primary),
        whatsapp_number: customerFormData.whatsapp_same_as_primary
          ? safeTrim(customerFormData.mobile_primary)
          : (safeTrim(customerFormData.whatsapp_number) || null),
        whatsapp_same_as_primary: customerFormData.whatsapp_same_as_primary,
        mobile_secondary_1: safeTrim(customerFormData.mobile_secondary_1) || null,
        mobile_secondary_2: safeTrim(customerFormData.mobile_secondary_2) || null,
        company_name: safeTrim(customerFormData.company_name) || null,
        gst_number: safeTrim(customerFormData.gst_number) || null,
        pan_card_number: safeTrim(customerFormData.pan_card_number) || null,
        full_address: safeTrim(customerFormData.full_address) || null,
        shipping_room_number: safeTrim(customerFormData.shipping_room_number) || null,
        shipping_floor: safeTrim(customerFormData.shipping_floor) || null,
        shipping_wing: safeTrim(customerFormData.shipping_wing) || null,
        shipping_flat_number: safeTrim(customerFormData.shipping_room_number) || null,
        shipping_floor_wing: floorWing || null,
        shipping_building_name: safeTrim(customerFormData.shipping_building_name),
        shipping_street_area: safeTrim(customerFormData.shipping_street_area),
        shipping_landmark: safeTrim(customerFormData.shipping_landmark) || null,
        shipping_city: safeTrim(customerFormData.shipping_city),
        shipping_state: safeTrim(customerFormData.shipping_state),
        shipping_pincode: safeTrim(customerFormData.shipping_pincode),
        shipping_country: safeTrim(customerFormData.shipping_country) || "India",
        is_vip: customerFormData.is_vip,
        vip_number: customerFormData.is_vip && safeTrim(customerFormData.vip_number) ? safeTrim(customerFormData.vip_number) : null,
        is_mandir: customerFormData.is_mandir,
        is_defaulter: customerFormData.is_defaulter,
        is_active: customerFormData.is_active
      }

      // Handle billing address
      if (customerFormData.billing_same_as_shipping) {
        customerData.billing_room_number = safeTrim(customerFormData.shipping_room_number) || null
        customerData.billing_floor = safeTrim(customerFormData.shipping_floor) || null
        customerData.billing_wing = safeTrim(customerFormData.shipping_wing) || null
        customerData.billing_flat_number = safeTrim(customerFormData.shipping_room_number) || null
        customerData.billing_floor_wing = floorWing || null
        customerData.billing_building_name = safeTrim(customerFormData.shipping_building_name)
        customerData.billing_street_area = safeTrim(customerFormData.shipping_street_area)
        customerData.billing_landmark = safeTrim(customerFormData.shipping_landmark) || null
        customerData.billing_city = safeTrim(customerFormData.shipping_city)
        customerData.billing_state = safeTrim(customerFormData.shipping_state)
        customerData.billing_pincode = safeTrim(customerFormData.shipping_pincode)
        customerData.billing_country = safeTrim(customerFormData.shipping_country) || "India"
      } else {
        customerData.billing_room_number = safeTrim(customerFormData.billing_room_number) || null
        customerData.billing_floor = safeTrim(customerFormData.billing_floor) || null
        customerData.billing_wing = safeTrim(customerFormData.billing_wing) || null
        customerData.billing_flat_number = safeTrim(customerFormData.billing_room_number) || null
        customerData.billing_floor_wing = billingFloorWing || null
        customerData.billing_building_name = safeTrim(customerFormData.billing_building_name) || null
        customerData.billing_street_area = safeTrim(customerFormData.billing_street_area) || null
        customerData.billing_landmark = safeTrim(customerFormData.billing_landmark) || null
        customerData.billing_city = safeTrim(customerFormData.billing_city) || null
        customerData.billing_state = safeTrim(customerFormData.billing_state) || null
        customerData.billing_pincode = safeTrim(customerFormData.billing_pincode) || null
        customerData.billing_country = safeTrim(customerFormData.billing_country) || "India"
      }

      const { data, error } = await supabase
        .from("customers")
        .insert([customerData])
        .select()
        .single()

      if (error) throw error

      toast.success("Customer created successfully")
      setCustomerDialogOpen(false)
      setCustomerFormErrors({})

      await fetchCustomersAndProducts()
      setSelectedCustomer(data.id)
    } catch (error: unknown) {
      console.error("Error saving customer:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to save customer"
      toast.error(errorMessage)
    } finally {
      setSavingCustomer(false)
    }
  }

  const handleSaveFullAddress = async () => {
    if (!selectedCustomer || !editedFullAddress.trim()) {
      toast.error("Please enter a valid address")
      return
    }

    setSavingAddress(true)

    try {
      const { error } = await supabase
        .from("customers")
        .update({ full_address: editedFullAddress.trim() })
        .eq("id", selectedCustomer)

      if (error) throw error

      // Update local state
      setCustomers(customers.map(c =>
        c.id === selectedCustomer
          ? { ...c, full_address: editedFullAddress.trim() }
          : c
      ))

      toast.success("Customer address updated successfully")
      setIsEditingFullAddress(false)

      // Auto-extract pincode from updated address
      const pincodeMatch = editedFullAddress.match(/\b\d{6}\b/)
      if (pincodeMatch) {
        setShippingPincode(pincodeMatch[0])
      }
    } catch (error: unknown) {
      console.error("Error updating address:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to update address"
      toast.error(errorMessage)
    } finally {
      setSavingAddress(false)
    }
  }

  // Handler for pincode auto-population
  const handlePincodeChange = async (pincode: string, addressType: 'shipping' | 'billing' | 'custom') => {
    // Only lookup when pincode is exactly 6 digits
    if (pincode.length === 6) {
      const result = await lookupPincode(pincode)
      if (result) {
        if (addressType === 'shipping') {
          setCustomerFormData({
            ...customerFormData,
            shipping_pincode: pincode,
            shipping_city: result.city,
            shipping_state: result.state,
          })
          toast.success(`Auto-filled: ${result.city}, ${result.state}`, { duration: 2000 })
        } else if (addressType === 'billing') {
          setCustomerFormData({
            ...customerFormData,
            billing_pincode: pincode,
            billing_city: result.city,
            billing_state: result.state,
          })
          toast.success(`Auto-filled: ${result.city}, ${result.state}`, { duration: 2000 })
        } else if (addressType === 'custom') {
          setCustomAddressFields({
            ...customAddressFields,
            pincode: pincode,
            city: result.city,
            state: result.state,
          })
          setShippingPincode(pincode)
          toast.success(`Auto-filled: ${result.city}, ${result.state}`, { duration: 2000 })
        }
      } else {
        // Pincode not found in database
        if (addressType === 'shipping') {
          setCustomerFormData({ ...customerFormData, shipping_pincode: pincode })
        } else if (addressType === 'billing') {
          setCustomerFormData({ ...customerFormData, billing_pincode: pincode })
        } else if (addressType === 'custom') {
          setCustomAddressFields({ ...customAddressFields, pincode: pincode })
          setShippingPincode(pincode)
        }
        toast.warning('Pincode not found in database. Please enter city and state manually.', { duration: 3000 })
      }
    } else {
      // Just update the pincode value
      if (addressType === 'shipping') {
        setCustomerFormData({ ...customerFormData, shipping_pincode: pincode })
      } else if (addressType === 'billing') {
        setCustomerFormData({ ...customerFormData, billing_pincode: pincode })
      } else if (addressType === 'custom') {
        setCustomAddressFields({ ...customAddressFields, pincode: pincode })
        setShippingPincode(pincode)
      }
    }
  }

  const handleCreateOrder = async () => {
    if (!selectedCustomer) {
      toast.error("Please select a customer")
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

    if (!selectedWarehouseId) {
      toast.error("Please select a source warehouse")
      return
    }

    setSaving(true)

    try {
      const customer = customers.find((c) => c.id === selectedCustomer)
      if (!customer) throw new Error("Customer not found")

      const { subtotal, totalGst, total, cgstAmount, sgstAmount, igstAmount } = calculateOrderTotals()

      const orderNumber = `ORD-${Date.now()}`

      // Determine shipping address based on selection
      let shippingFullAddress = ""

      if (shippingAddressOption === "full_address") {
        // Use customer's saved full address
        if (!customer.full_address) {
          toast.error("Customer does not have a saved full address")
          setSaving(false)
          return
        }
        shippingFullAddress = customer.full_address
      } else if (shippingAddressOption === "customer_structured") {
        // Build full address from customer's existing structured shipping fields
        const addressParts = []
        if (customer.shipping_room_number) addressParts.push(`Room: ${customer.shipping_room_number}`)
        if (customer.shipping_floor) addressParts.push(`Floor: ${customer.shipping_floor}`)
        if (customer.shipping_wing) addressParts.push(`Wing: ${customer.shipping_wing}`)
        if (customer.shipping_flat_number) addressParts.push(`Flat: ${customer.shipping_flat_number}`)
        if (customer.shipping_floor_wing) addressParts.push(customer.shipping_floor_wing)
        if (customer.shipping_building_name) addressParts.push(customer.shipping_building_name)
        if (customer.shipping_street_area) addressParts.push(customer.shipping_street_area)
        if (customer.shipping_landmark) addressParts.push(`Near ${customer.shipping_landmark}`)
        if (customer.shipping_city) addressParts.push(customer.shipping_city)
        if (customer.shipping_state) addressParts.push(customer.shipping_state)
        if (customer.shipping_pincode) addressParts.push(customer.shipping_pincode)

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

      // The structured fields below (except state) stayed unpopulated when
      // this switched to storing one flat shipping_full_address string —
      // shipping_state specifically is NOT cosmetic though: GSTR-1, the
      // GST-orders report, and Tally export all read it directly to tell
      // interstate from intrastate supply, so leaving it null silently broke
      // those for every order (1,000+ affected). Mirrors the same per-mode
      // source used to build shippingFullAddress above, falling back to the
      // customer's own state on "full_address" mode since that option has no
      // separate structured fields of its own to read a state from.
      const shippingState =
        shippingAddressOption === "custom"
          ? (customAddressFields.state || "").trim()
          : shippingAddressOption === "customer_structured"
            ? (customer.shipping_state || "").trim()
            : (customer?.shipping_state || customer?.billing_state || "").trim()

      // Always store in shipping_full_address
      const shippingData = {
        shipping_full_address: shippingFullAddress,
        shipping_pincode: shippingPincode, // Always save the pincode separately
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

      // Determine if this is a customer, distributor, or subdistributor order
      const isDistributorOrder = customer.entity_type === "distributor"
      const isSubdistributorOrder = customer.entity_type === "subdistributor"
      const isRetailerOrder = customer.entity_type === "retailer"
      const isCustomerOrder = customer.entity_type === "customer" || !customer.entity_type

      // Debug logging
      console.log("Order entity detection:", {
        entity_type: customer.entity_type,
        isDistributorOrder,
        isSubdistributorOrder,
        isRetailerOrder,
        isCustomerOrder,
        selectedCustomer,
        customerData: customer
      })

      const orderData = {
        order_number: orderNumber,
        customer_id: isCustomerOrder ? selectedCustomer : null,
        distributor_id: isDistributorOrder || isSubdistributorOrder ? selectedCustomer : null,
        retailer_id: isRetailerOrder ? selectedCustomer : null,
        is_distributor: isDistributorOrder,
        is_subdistributor: isSubdistributorOrder,
        is_gst_invoice: isGstInvoice,
        customer_gst_number: customer.gst_number || tempGstNumber || null,
        customer_pan_number: customer.pan_card_number || tempPanNumber || null,
        order_status: orderStatus,
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        source: "backend", // Manual order creation through dashboard
        ...shippingData,
        billing_building_name: customer.shipping_building_name,
        billing_street_area: customer.shipping_street_area,
        billing_city: customer.shipping_city,
        billing_state: customer.shipping_state,
        billing_pincode: customer.shipping_pincode,
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
        order_date: orderDate ? orderDate.toISOString() : new Date().toISOString(),
        created_by_user_id: currentUserId,
        created_by_agent_id: currentAgentId,
        created_by_agent_name: currentAgentName,
        source_godown_id: selectedWarehouseId,
        destination_godown_id: (isDistributorOrder || isSubdistributorOrder || isRetailerOrder) ? destinationWarehouseId : null,
        delivery_partner_id: selectedDeliveryPartnerId || null,
        assigned_to_delivery_at: selectedDeliveryPartnerId ? new Date().toISOString() : null,
        delivery_status: selectedDeliveryPartnerId ? "assigned" : null,
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

      // Decrement product stock from warehouse for customer orders only (not for distributors, subdistributors, or retailers)
      if (isCustomerOrder) {
        console.log("Decrementing warehouse stock for customer order...")

        // Check if this is GDN002 warehouse (needs smart fallback to RAJ123)
        const { data: selectedGodown } = await supabase
          .from("godowns")
          .select("godown_code")
          .eq("id", selectedWarehouseId)
          .single()

        const isGDN002 = selectedGodown?.godown_code === "GDN002"

        // Get RAJ123 warehouse ID if needed
        let raj123WarehouseId: string | null = null
        if (isGDN002) {
          const { data: raj123Godown } = await supabase
            .from("godowns")
            .select("id")
            .eq("godown_code", "RAJ123")
            .single()
          raj123WarehouseId = raj123Godown?.id || null
        }

        // Update warehouse stock for each ordered product
        for (const item of orderItems) {
          // Get the stock inventory ID for this product
          const { data: inventoryData, error: inventoryError } = await supabase
            .from("stock_inventory")
            .select("id")
            .eq("product_id", item.product_id)
            .single()

          if (inventoryError) {
            console.error(`Error fetching stock inventory for ${item.product_name}:`, inventoryError)
            toast.warning(`Failed to find stock inventory for ${item.product_name}. Stock not updated.`)
            continue
          }

          // Get current warehouse stock (if exists)
          const { data: warehouseStock } = await supabase
            .from("godown_stock")
            .select("quantity, reserved_quantity")
            .eq("godown_id", selectedWarehouseId)
            .eq("stock_inventory_id", inventoryData.id)
            .maybeSingle()

          const currentQuantity = warehouseStock?.quantity || 0
          const currentReservedQuantity = warehouseStock?.reserved_quantity || 0
          const availableInGDN002 = currentQuantity

          // Smart fallback logic for GDN002 -> RAJ123
          if (isGDN002 && raj123WarehouseId && availableInGDN002 < item.quantity) {
            console.log(`GDN002 has insufficient stock for ${item.product_name} (${availableInGDN002} < ${item.quantity}). Checking RAJ123...`)

            // Get RAJ123 stock
            const { data: raj123Stock } = await supabase
              .from("godown_stock")
              .select("quantity, reserved_quantity")
              .eq("godown_id", raj123WarehouseId)
              .eq("stock_inventory_id", inventoryData.id)
              .maybeSingle()

            const raj123CurrentQuantity = raj123Stock?.quantity || 0
            const raj123CurrentReserved = raj123Stock?.reserved_quantity || 0

            // Deduct from RAJ123 instead
            const raj123NewQuantity = raj123CurrentQuantity - item.quantity
            const raj123NewReserved = raj123NewQuantity < 0 ? 0 : raj123CurrentReserved

            const { error: raj123UpdateError } = await supabase
              .from("godown_stock")
              .upsert({
                godown_id: raj123WarehouseId,
                stock_inventory_id: inventoryData.id,
                quantity: raj123NewQuantity,
                reserved_quantity: raj123NewReserved,
              }, {
                onConflict: 'godown_id,stock_inventory_id'
              })

            if (raj123UpdateError) {
              console.error(`Error updating RAJ123 stock for ${item.product_name}:`, raj123UpdateError)
              toast.warning(`Failed to update stock for ${item.product_name}. Please update manually.`)
            } else {
              console.log(`✓ Stock deducted from RAJ123 for ${item.product_name}: ${raj123CurrentQuantity} -> ${raj123NewQuantity}`)
              toast.info(`${item.product_name}: Deducted from RAJ123 warehouse (GDN002 had insufficient stock)`)
            }
            continue // Skip GDN002 deduction for this item
          }

          // Standard deduction from selected warehouse
          const newQuantity = currentQuantity - item.quantity
          const newReservedQuantity = newQuantity < 0 ? 0 : currentReservedQuantity

          // Log if stock will go negative
          if (newQuantity < 0) {
            console.warn(`Stock will go negative for ${item.product_name}: ${currentQuantity} - ${item.quantity} = ${newQuantity}`)
            if (currentReservedQuantity > 0) {
              toast.info(`${item.product_name} stock will be negative (${newQuantity}). Reserved quantity cleared.`)
            } else {
              toast.info(`${item.product_name} stock will be negative (${newQuantity}). Order created successfully.`)
            }
          }

          // Use upsert to handle both existing and new stock records
          const { error: updateError } = await supabase
            .from("godown_stock")
            .upsert({
              godown_id: selectedWarehouseId,
              stock_inventory_id: inventoryData.id,
              quantity: newQuantity,
              reserved_quantity: newReservedQuantity,
            }, {
              onConflict: 'godown_id,stock_inventory_id'
            })

          if (updateError) {
            console.error(`Error updating warehouse stock for ${item.product_name}:`, updateError)
            toast.warning(`Failed to update warehouse stock for ${item.product_name}. Please update manually.`)
          } else {
            console.log(`Warehouse stock updated for ${item.product_name}: ${currentQuantity} -> ${newQuantity}`)
          }
        }

        console.log("Warehouse stock decrement completed for customer order")
      } else if (isDistributorOrder || isSubdistributorOrder || isRetailerOrder) {
        // Distributor/Subdistributor/Retailer orders: deduct from source, add to destination
        console.log(`Processing stock for ${customer.entity_type} order...`)
        console.log(`Source warehouse: ${selectedWarehouseId}, Destination warehouse: ${destinationWarehouseId}`)

        for (const item of orderItems) {
          // Get the stock inventory ID for this product
          const { data: inventoryData, error: inventoryError } = await supabase
            .from("stock_inventory")
            .select("id")
            .eq("product_id", item.product_id)
            .single()

          if (inventoryError) {
            console.error(`Error fetching stock inventory for ${item.product_name}:`, inventoryError)
            toast.warning(`Failed to find stock inventory for ${item.product_name}. Stock not updated.`)
            continue
          }

          // DEDUCT from source warehouse
          const { data: sourceStock } = await supabase
            .from("godown_stock")
            .select("quantity, reserved_quantity")
            .eq("godown_id", selectedWarehouseId)
            .eq("stock_inventory_id", inventoryData.id)
            .maybeSingle()

          const sourceCurrentQty = sourceStock?.quantity || 0
          const sourceCurrentReserved = sourceStock?.reserved_quantity || 0
          const sourceNewQty = sourceCurrentQty - item.quantity
          const sourceNewReserved = sourceNewQty < 0 ? 0 : sourceCurrentReserved

          if (sourceNewQty < 0) {
            console.warn(`Source stock will go negative for ${item.product_name}: ${sourceCurrentQty} - ${item.quantity} = ${sourceNewQty}`)
            toast.info(`${item.product_name}: Source stock will be negative (${sourceNewQty}).`)
          }

          const { error: sourceUpdateError } = await supabase
            .from("godown_stock")
            .upsert({
              godown_id: selectedWarehouseId,
              stock_inventory_id: inventoryData.id,
              quantity: sourceNewQty,
              reserved_quantity: sourceNewReserved,
            }, {
              onConflict: 'godown_id,stock_inventory_id'
            })

          if (sourceUpdateError) {
            console.error(`Error deducting source stock for ${item.product_name}:`, sourceUpdateError)
            toast.warning(`Failed to deduct source stock for ${item.product_name}.`)
          } else {
            console.log(`Source stock deducted for ${item.product_name}: ${sourceCurrentQty} -> ${sourceNewQty}`)
          }

          // ADD to destination warehouse (if distributor has a godown)
          if (destinationWarehouseId) {
            const { data: destStock } = await supabase
              .from("godown_stock")
              .select("quantity, reserved_quantity")
              .eq("godown_id", destinationWarehouseId)
              .eq("stock_inventory_id", inventoryData.id)
              .maybeSingle()

            const destCurrentQty = destStock?.quantity || 0
            const destCurrentReserved = destStock?.reserved_quantity || 0
            const destNewQty = destCurrentQty + item.quantity

            const { error: destUpdateError } = await supabase
              .from("godown_stock")
              .upsert({
                godown_id: destinationWarehouseId,
                stock_inventory_id: inventoryData.id,
                quantity: destNewQty,
                reserved_quantity: destCurrentReserved,
              }, {
                onConflict: 'godown_id,stock_inventory_id'
              })

            if (destUpdateError) {
              console.error(`Error adding destination stock for ${item.product_name}:`, destUpdateError)
              toast.warning(`Failed to add stock to ${customer.entity_type}'s warehouse for ${item.product_name}.`)
            } else {
              console.log(`Destination stock added for ${item.product_name}: ${destCurrentQty} -> ${destNewQty}`)
            }
          } else {
            console.log(`No destination warehouse for ${item.product_name} - stock deducted from source only`)
          }
        }

        const destMsg = destinationWarehouseId
          ? `Stock moved: source deducted, destination (${destinationWarehouseName}) updated.`
          : `Stock deducted from source. No destination warehouse — ${customer.entity_type} has no godown.`
        console.log(destMsg)
      }

      // Save custom address to customer profile if requested (only for actual customers, not distributors)
      if (isCustomerOrder && shippingAddressOption === "custom" && saveAsCustomerAddress && shippingFullAddress.trim()) {
        const { error: customerUpdateError } = await supabase
          .from("customers")
          .update({ full_address: shippingFullAddress.trim() })
          .eq("id", selectedCustomer)

        if (customerUpdateError) {
          console.error("Error updating customer address:", customerUpdateError)
          toast.warning("Order created successfully, but failed to save address to customer profile")
        }
      }

      // Send WhatsApp notification to customer
      try {
        // Try to get WhatsApp number, fallback to primary mobile
        const phoneNumber = customer.whatsapp_number || customer.mobile_primary
        const customerName = customer.first_name || 'Customer'

        const whatsappResponse = await fetch('/api/whatsapp/send-order-confirmation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customerName: customerName,
            orderNumber: orderNumber,
            mobileNumber: phoneNumber,
          }),
        })

        const whatsappResult = await whatsappResponse.json()

        if (whatsappResult.success) {
          console.log('WhatsApp notification sent successfully:', whatsappResult.messageId)
        } else {
          console.error('Failed to send WhatsApp notification:', whatsappResult.error)
          // Don't show error to user - WhatsApp notification is optional
        }
      } catch (whatsappError) {
        console.error('Error sending WhatsApp notification:', whatsappError)
        // Don't block order creation if WhatsApp fails
      }

      toast.success("Order created successfully!")
      router.push("/dashboard/orders")
    } catch (error: unknown) {
      console.error("Error creating order:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to create order"
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  // Alt+A finishes and creates the order, same as clicking "Create Order".
  useSaveShortcut(handleCreateOrder, saving)

  const { subtotal, totalItemDiscount, totalGst, total, cgstAmount, sgstAmount, igstAmount, isInterState, customerStateMissing } = useMemo(() => {
    return calculateOrderTotals()
  }, [orderItems, shippingCharges, discountAmount, customers, selectedCustomer, sellerEntityType, sellerEntityDetails])

  const selectedCustomerData = customers.find((c) => c.id === selectedCustomer)

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/orders")}
          className="-ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to orders
        </Button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 shrink-0">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Create New Order</h1>
              <p className="text-sm text-muted-foreground">
                Select a customer and add products to create an order
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/dashboard/orders")}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrder} disabled={saving || orderItems.length === 0}>
              <Save className="h-4 w-4" />
              {saving ? "Creating..." : "Create Order"}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Form */}
      <div className="space-y-6">
          {/* Customer Selection */}
          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer
              </CardTitle>
              <CardDescription>Search and select a customer, distributor, sub-distributor, or retailer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Search Input - Full Width */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="customer-search" className="text-sm font-medium">
                    Search & Select <span className="text-destructive">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleOpenCustomerDialog}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    New Customer
                  </Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    id="customer-search"
                    placeholder="Search by name, phone, email, GST, company…"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="pl-9 pr-9 h-11"
                  />
                  {customerSearch && (
                    <button
                      type="button"
                      onClick={() => setCustomerSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Search Results */}
              {customerSearch && (
                <div className="space-y-3">
                  {/* Filter Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-medium text-muted-foreground mr-1">Filter:</span>
                    {[
                      { key: "all", label: "All" },
                      { key: "customer", label: "Customers" },
                      { key: "distributor", label: "Distributors" },
                      { key: "subdistributor", label: "Subdistributors" },
                      { key: "retailer", label: "Retailers" },
                    ].map((f) => {
                      const active = entityTypeFilter === f.key
                      return (
                        <Button
                          key={f.key}
                          type="button"
                          variant={active ? "default" : "outline"}
                          size="sm"
                          onClick={() => setEntityTypeFilter(f.key as typeof entityTypeFilter)}
                          className="h-7 text-xs px-2.5"
                        >
                          {f.label}
                        </Button>
                      )
                    })}
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      {isSearching && (
                        <span className="h-3 w-3 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
                      )}
                      {isSearching ? "Searching…" : `Found ${searchResults.filter(r => entityTypeFilter === "all" || r.entity_type === entityTypeFilter).length} result${searchResults.filter(r => entityTypeFilter === "all" || r.entity_type === entityTypeFilter).length !== 1 ? 's' : ''}`}
                    </span>
                  </div>

                  {!isSearching && searchResults.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No customers or distributors found matching "{customerSearch}"
                      </AlertDescription>
                    </Alert>
                  ) : !isSearching && searchResults.filter(r => entityTypeFilter === "all" || r.entity_type === entityTypeFilter).length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No {entityTypeFilter === "all" ? "results" : entityTypeFilter === "customer" ? "customers" : entityTypeFilter === "distributor" ? "distributors" : entityTypeFilter === "subdistributor" ? "subdistributors" : "retailers"} found matching "{customerSearch}"
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
                      {searchResults.filter(r => entityTypeFilter === "all" || r.entity_type === entityTypeFilter).map((customer) => {
                        const initials = `${(customer.first_name || "").charAt(0)}${(customer.last_name || "").charAt(0)}`.toUpperCase() || "?"
                        const isSelected = selectedCustomer === customer.id
                        return (
                          <div
                            key={customer.id}
                            onClick={() => {
                              setSelectedCustomer(customer.id)
                              setCustomers([customer])
                              setCustomerSearch("")
                              setSearchResults([])
                              setTempGstNumber("")
                              setTempPanNumber("")
                              if (customer.gst_number || customer.pan_card_number) {
                                setIsGstInvoice(true)
                              }
                            }}
                            className={cn(
                              "relative p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm",
                              isSelected
                                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                                : "border-border hover:border-primary/40 hover:bg-accent/40"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                "flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold shrink-0",
                                customer.is_vip
                                  ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                                  : "bg-muted text-muted-foreground"
                              )}>
                                {initials}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                  <h4 className="font-semibold text-sm">
                                    {customer.first_name} {customer.last_name}
                                  </h4>
                                  {customer.entity_type === "customer" && (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">Customer</Badge>
                                  )}
                                  {customer.entity_type === "distributor" && (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">Distributor</Badge>
                                  )}
                                  {customer.entity_type === "subdistributor" && (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">Subdistributor</Badge>
                                  )}
                                  {customer.entity_type === "retailer" && (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">Retailer</Badge>
                                  )}
                                  {customer.parent_distributor_name && (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                      ↳ {customer.parent_distributor_name}
                                    </Badge>
                                  )}
                                  {customer.is_vip && (
                                    <Badge variant="default" className="text-[10px] h-4 px-1.5 bg-amber-500 hover:bg-amber-500/80 text-white">
                                      VIP{customer.vip_number && ` · ${customer.vip_number}`}
                                    </Badge>
                                  )}
                                  {customer.is_mandir && (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">Mandir</Badge>
                                  )}
                                  {customer.is_defaulter && (
                                    <Badge variant="destructive" className="text-[10px] h-4 px-1.5">Defaulter</Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
                                  <span className="font-mono">{customer.mobile_primary}</span>
                                  {customer.email && (
                                    <>
                                      <span className="text-muted-foreground/40">•</span>
                                      <span className="truncate">{customer.email}</span>
                                    </>
                                  )}
                                  {customer.company_name && (
                                    <>
                                      <span className="text-muted-foreground/40">•</span>
                                      <span>{customer.company_name}</span>
                                    </>
                                  )}
                                  {customer.gst_number && (
                                    <>
                                      <span className="text-muted-foreground/40">•</span>
                                      <span className="font-mono">GST {customer.gst_number}</span>
                                    </>
                                  )}
                                  {!customer.gst_number && customer.pan_card_number && (
                                    <>
                                      <span className="text-muted-foreground/40">•</span>
                                      <span className="font-mono">PAN {customer.pan_card_number}</span>
                                    </>
                                  )}
                                </div>
                                {(customer.shipping_city || customer.shipping_state || customer.shipping_pincode) && (
                                  <div className="text-xs text-muted-foreground/80 mt-1 truncate">
                                    {[customer.shipping_city, customer.shipping_state, customer.shipping_pincode].filter(Boolean).join(", ")}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Previous Orders Section */}
              {selectedCustomer && previousOrders.length > 0 && (
                <div className="rounded-lg border bg-muted/30">
                  <button
                    type="button"
                    onClick={() => setShowPreviousOrders(!showPreviousOrders)}
                    className="flex w-full items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Previous Orders</span>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {previousOrders.length}
                      </Badge>
                    </div>
                    {showPreviousOrders ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {showPreviousOrders && (
                    <div className="border-t p-2 space-y-1.5">
                      {previousOrders.map((order) => (
                        <div
                          key={order.id}
                          className="flex items-center justify-between gap-3 p-2.5 bg-background border rounded-md"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium font-mono">{order.order_number}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <span>{format(new Date(order.order_date), "dd MMM yyyy")}</span>
                              <span className="text-muted-foreground/40">•</span>
                              <span className="font-medium text-foreground/80">
                                ₹{order.total_amount?.toLocaleString("en-IN")}
                              </span>
                              <span className="text-muted-foreground/40">•</span>
                              <span>{order.order_items?.length || 0} items</span>
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              loadOrderForReorder(order.id)
                            }}
                          >
                            Reuse
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedCustomerData && (
                <>
                  <Separator className="my-4" />

                  {/* Shipping Address Selection */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Shipping Address - 2/3 width (4 columns) */}
                    <div className="lg:col-span-2 space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Shipping Address</Label>
                      </div>

                      <div className="space-y-3">
                      {/* Full Address Option (from customer) */}
                      {selectedCustomerData.full_address && (
                        <div
                          onClick={() => !isEditingFullAddress && setShippingAddressOption("full_address")}
                          className={cn(
                            "p-3.5 rounded-lg border transition-all",
                            isEditingFullAddress ? "border-primary bg-primary/5" : "cursor-pointer",
                            shippingAddressOption === "full_address" && !isEditingFullAddress
                              ? "border-primary bg-primary/5"
                              : !isEditingFullAddress && "border-border hover:border-primary/50"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            {!isEditingFullAddress && (
                              <div className={cn(
                                "w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center",
                                shippingAddressOption === "full_address" ? "border-primary" : "border-muted-foreground"
                              )}>
                                {shippingAddressOption === "full_address" && (
                                  <div className="w-3 h-3 rounded-full bg-primary" />
                                )}
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold text-sm">Use Customer Full Address</h4>
                                  <Badge variant="secondary" className="text-xs">Saved</Badge>
                                </div>
                                {!isEditingFullAddress ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setIsEditingFullAddress(true)
                                      setEditedFullAddress(selectedCustomerData.full_address || "")
                                    }}
                                    className="h-7 text-xs"
                                  >
                                    Edit
                                  </Button>
                                ) : (
                                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setIsEditingFullAddress(false)
                                        setEditedFullAddress("")
                                      }}
                                      className="h-7 text-xs"
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={handleSaveFullAddress}
                                      disabled={savingAddress}
                                      className="h-7 text-xs"
                                    >
                                      {savingAddress ? "Saving..." : "Save"}
                                    </Button>
                                  </div>
                                )}
                              </div>
                              {!isEditingFullAddress ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setIsEditingFullAddress(true)
                                    setEditedFullAddress(selectedCustomerData.full_address || "")
                                  }}
                                  className="w-full text-left p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors border border-border hover:border-primary/50 text-base leading-relaxed text-foreground font-medium"
                                >
                                  {selectedCustomerData.full_address}
                                </button>
                              ) : (
                                <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                                  <Textarea
                                    value={editedFullAddress}
                                    onChange={(e) => setEditedFullAddress(e.target.value)}
                                    placeholder="Enter complete address..."
                                    className="min-h-[120px] text-sm"
                                    rows={5}
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    This will update the customer's saved address permanently.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Customer Structured Address Option */}
                      {(selectedCustomerData.shipping_building_name || selectedCustomerData.shipping_street_area || selectedCustomerData.shipping_city || selectedCustomerData.shipping_pincode) && (
                        <div
                          onClick={() => setShippingAddressOption("customer_structured")}
                          className={cn(
                            "p-3.5 rounded-lg border cursor-pointer transition-all",
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
                                <h4 className="font-semibold text-sm">Use Customer Shipping Address</h4>
                                <Badge variant="secondary" className="text-xs">Saved Fields</Badge>
                              </div>
                              <div className="p-3 rounded-md bg-muted/50 border border-border text-sm leading-relaxed text-foreground">
                                {[
                                  selectedCustomerData.shipping_room_number && `Room: ${selectedCustomerData.shipping_room_number}`,
                                  selectedCustomerData.shipping_floor && `Floor: ${selectedCustomerData.shipping_floor}`,
                                  selectedCustomerData.shipping_wing && `Wing: ${selectedCustomerData.shipping_wing}`,
                                  selectedCustomerData.shipping_flat_number && `Flat: ${selectedCustomerData.shipping_flat_number}`,
                                  selectedCustomerData.shipping_floor_wing,
                                  selectedCustomerData.shipping_building_name,
                                  selectedCustomerData.shipping_street_area,
                                  selectedCustomerData.shipping_landmark && `Near ${selectedCustomerData.shipping_landmark}`,
                                  selectedCustomerData.shipping_city,
                                  selectedCustomerData.shipping_state,
                                  selectedCustomerData.shipping_pincode,
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
                          "p-3.5 rounded-lg border cursor-pointer transition-all",
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

                                <Separator />

                                <div className="flex items-center space-x-2 pt-1">
                                  <Switch
                                    id="saveAsCustomerAddress"
                                    checked={saveAsCustomerAddress}
                                    onCheckedChange={setSaveAsCustomerAddress}
                                  />
                                  <Label
                                    htmlFor="saveAsCustomerAddress"
                                    className="text-sm font-medium cursor-pointer"
                                  >
                                    Save as customer's primary address
                                  </Label>
                                </div>
                                {saveAsCustomerAddress && (
                                  <Alert className="bg-blue-50 border-blue-200">
                                    <AlertCircle className="h-4 w-4 text-blue-600" />
                                    <AlertDescription className="text-xs text-blue-800">
                                      This address will be saved to the customer's profile and can be reused for future orders.
                                    </AlertDescription>
                                  </Alert>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    </div>

                    {/* Right rail - Pincode & Payment Method */}
                    <div className="lg:col-span-1 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="shippingPincode" className="text-sm font-semibold flex items-center gap-2">
                          Delivery Pincode <span className="text-destructive">*</span>
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
                          className="font-mono text-sm h-9"
                          required
                        />
                        <p className="text-xs text-muted-foreground">Required for delivery.</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="paymentMethodTop" className="text-sm font-semibold">
                          Payment Method <span className="text-destructive">*</span>
                        </Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                          <SelectTrigger id="paymentMethodTop" className="h-9 w-full text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">💵 Cash</SelectItem>
                            <SelectItem value="card">💳 Card</SelectItem>
                            <SelectItem value="upi">📱 UPI</SelectItem>
                            <SelectItem value="bank_transfer">🏦 Bank Transfer</SelectItem>
                            <SelectItem value="cheque">📝 Cheque</SelectItem>
                            <SelectItem value="balance">💰 Balance</SelectItem>
                            <SelectItem value="cod">🚚 Cash on Delivery</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
                    {/* Header with Name and Badges */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-base leading-none mb-1">
                          {selectedCustomerData.first_name} {selectedCustomerData.last_name}
                        </h3>
                        {selectedCustomerData.company_name && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {selectedCustomerData.company_name}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 justify-end">
                        {selectedCustomerData.is_vip && (
                          <div className="flex items-center gap-1.5">
                            <Badge variant="default">VIP</Badge>
                            {selectedCustomerData.vip_number && (
                              <Badge variant="outline" className="font-mono text-xs">
                                {selectedCustomerData.vip_number}
                              </Badge>
                            )}
                          </div>
                        )}
                        {selectedCustomerData.is_mandir && (
                          <Badge variant="secondary">Mandir</Badge>
                        )}
                        {selectedCustomerData.is_defaulter && (
                          <Badge variant="destructive">Defaulter</Badge>
                        )}
                      </div>
                    </div>

                    {/* GST Number or PAN Card */}
                    {selectedCustomerData.gst_number && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground font-medium">GST:</span>
                        <span className="font-mono">{selectedCustomerData.gst_number}</span>
                      </div>
                    )}
                    {!selectedCustomerData.gst_number && selectedCustomerData.pan_card_number && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground font-medium">PAN:</span>
                        <span className="font-mono">{selectedCustomerData.pan_card_number}</span>
                      </div>
                    )}

                    <Separator />

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
                            <span className="font-medium text-sm">{selectedCustomerData.mobile_primary}</span>
                          </div>
                          {selectedCustomerData.whatsapp_number && !selectedCustomerData.whatsapp_same_as_primary && (
                            <div className="flex items-start gap-2.5">
                              <span className="text-muted-foreground text-sm min-w-[80px]">WhatsApp:</span>
                              <span className="font-medium text-sm">{selectedCustomerData.whatsapp_number}</span>
                            </div>
                          )}
                          {selectedCustomerData.email && (
                            <div className="flex items-start gap-2.5">
                              <span className="text-muted-foreground text-sm min-w-[80px]">Email:</span>
                              <span className="text-sm break-all">{selectedCustomerData.email}</span>
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
                          {selectedCustomerData.shipping_room_number && (
                            <div>Room: {selectedCustomerData.shipping_room_number}</div>
                          )}
                          {selectedCustomerData.shipping_floor && (
                            <div>Floor: {selectedCustomerData.shipping_floor}</div>
                          )}
                          {selectedCustomerData.shipping_wing && (
                            <div>Wing: {selectedCustomerData.shipping_wing}</div>
                          )}
                          {selectedCustomerData.shipping_flat_number && (
                            <div>{selectedCustomerData.shipping_flat_number}</div>
                          )}
                          {selectedCustomerData.shipping_floor_wing && (
                            <div>{selectedCustomerData.shipping_floor_wing}</div>
                          )}
                          <div>{selectedCustomerData.shipping_building_name}</div>
                          <div>{selectedCustomerData.shipping_street_area}</div>
                          {selectedCustomerData.shipping_landmark && (
                            <div className="text-muted-foreground">Near {selectedCustomerData.shipping_landmark}</div>
                          )}
                          <div className="mt-1.5 font-semibold">
                            {selectedCustomerData.shipping_city}, {selectedCustomerData.shipping_state} - {selectedCustomerData.shipping_pincode}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedCustomerData.is_defaulter && (
                    <Alert variant="destructive" className="border-destructive/50">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        <strong>Warning:</strong> This customer is marked as a defaulter. Please verify payment before processing the order.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Products */}
          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Items
              </CardTitle>
              <CardDescription>Add products to the order</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Category Filters */}
              <div className="grid grid-cols-2 gap-2.5 p-3 bg-muted/50 rounded-lg border">
                <div className="space-y-1.5">
                  <Label htmlFor="categoryFilter" className="flex items-center gap-1.5 text-xs font-medium">
                    <Filter className="h-3.5 w-3.5" />
                    Filter by Category
                  </Label>
                  <Select value={selectedCategory || "all"} onValueChange={setSelectedCategory}>
                    <SelectTrigger id="categoryFilter" className="w-full h-9 text-sm">
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
                <div className="space-y-1.5">
                  <Label htmlFor="subCategoryFilter" className="flex items-center gap-1.5 text-xs font-medium">
                    <Filter className="h-3.5 w-3.5" />
                    Filter by Sub-Category
                  </Label>
                  <Select
                    value={selectedSubCategory || "all"}
                    onValueChange={setSelectedSubCategory}
                    disabled={!selectedCategory || selectedCategory === "all" || subCategories.length === 0}
                  >
                    <SelectTrigger id="subCategoryFilter" className="w-full h-9 text-sm">
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
                  <SelectTrigger className="flex-1 h-9 text-sm">
                    <SelectValue placeholder={`Select a product (${filteredProducts.length} available)`} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{product.name}</span>
                          <div className="flex items-center gap-2 ml-4">
                            <span className="text-sm">₹{product.customer_price}</span>
                            {selectedWarehouseId && product.warehouse_stock !== null && (
                              <Badge variant={product.warehouse_stock > 10 ? "secondary" : product.warehouse_stock > 0 ? "outline" : "destructive"} className="text-xs">
                                Stock: {product.warehouse_stock}
                              </Badge>
                            )}
                            {!selectedWarehouseId && (
                              <Badge variant="outline" className="text-xs">
                                Select warehouse
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
                                    Available: {item.stock}
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
          <Card size="sm">
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
              <CardDescription>Configure payment, shipping, and additional details</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Agent Information Display */}
              {(currentAgentId || currentAgentName) && (
                <>
                  <div className="rounded-lg border bg-muted/50 p-3 mb-4">
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
                  <Separator className="mb-4" />
                </>
              )}

              <Tabs defaultValue="payment" className="w-full">
                <TabsList className="grid w-full grid-cols-3 !h-12 p-1">
                  <TabsTrigger value="payment" className="flex items-center gap-2 !h-10 px-4 text-sm">
                    <IndianRupee className="h-4 w-4" />
                    Payment
                  </TabsTrigger>
                  <TabsTrigger value="shipping" className="flex items-center gap-2 !h-10 px-4 text-sm">
                    <Truck className="h-4 w-4" />
                    Shipping
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="flex items-center gap-2 !h-10 px-4 text-sm">
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
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paymentStatus">Payment Status</Label>
                      <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                        <SelectTrigger id="paymentStatus" className="h-9 w-full text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">⏳ Pending</SelectItem>
                          <SelectItem value="processing">⚙️ Processing</SelectItem>
                          <SelectItem value="completed">✅ Completed</SelectItem>
                          <SelectItem value="failed">❌ Failed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="orderStatus">Order Status</Label>
                      <Select value={orderStatus} onValueChange={setOrderStatus}>
                        <SelectTrigger id="orderStatus" className="h-9 w-full text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">📋 Pending</SelectItem>
                          <SelectItem value="confirmed">✅ Confirmed</SelectItem>
                          <SelectItem value="processing">⚙️ Processing</SelectItem>
                          <SelectItem value="packed">📦 Packed</SelectItem>
                          <SelectItem value="shipped">🚚 Shipped</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Order Date (optional)</Label>
                    <div className="flex items-center gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "flex-1 justify-start text-left font-normal",
                              !orderDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {orderDate ? format(orderDate, "dd MMM yyyy") : <span>Defaults to today</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={orderDate}
                            onSelect={setOrderDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      {orderDate && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 text-xs text-muted-foreground"
                          onClick={() => setOrderDate(undefined)}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Leave empty to use today's date and time. Override only for backdated entries.
                    </p>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
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
                    <div className="flex items-center justify-between p-3">
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
                          {selectedCustomerData && (selectedCustomerData.gst_number || selectedCustomerData.pan_card_number) && (
                            <span className="block mt-1 text-xs text-primary font-medium">
                              Auto-enabled: Customer has {selectedCustomerData.gst_number ? 'GST' : 'PAN'}
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
                    {selectedCustomerData && (
                      <div className="px-3 pb-3 pt-2 border-t bg-muted/20">
                        {(selectedCustomerData.gst_number || selectedCustomerData.pan_card_number) ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              {selectedCustomerData.gst_number ? 'GST Number:' : 'PAN Card:'}
                            </span>
                            <span className="text-sm font-mono font-semibold">
                              {selectedCustomerData.gst_number || selectedCustomerData.pan_card_number}
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-xs text-muted-foreground">
                              Customer doesn't have GST or PAN saved. Add for this order:
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
                                    if (value) setTempPanNumber("") // Clear PAN if GST is entered
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
                                    if (value) setTempGstNumber("") // Clear GST if PAN is entered
                                  }}
                                  className="h-9 text-sm font-mono"
                                  maxLength={10}
                                  disabled={!!tempGstNumber}
                                />
                              </div>
                            </div>
                            <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                              Note: These values will only be used for this order and won't update the customer's profile.
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
                        // Auto-set expected delivery date if courier has default days
                        const selectedCourier = courierPartners.find(cp => cp.code === value)
                        if (selectedCourier?.default_delivery_days) {
                          const deliveryDate = new Date()
                          deliveryDate.setDate(deliveryDate.getDate() + selectedCourier.default_delivery_days)
                          setExpectedDeliveryDate(deliveryDate)
                        }
                      }}>
                        <SelectTrigger id="courierPartner" className="h-9 w-full text-sm">
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
                        className="h-9 text-sm"
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
                          {expectedDeliveryDate ? format(expectedDeliveryDate, "dd MMM yyyy") : <span>Pick a date</span>}
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
                    <Label htmlFor="customerNotes">Customer Notes</Label>
                    <Textarea
                      id="customerNotes"
                      value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value)}
                      placeholder="Add notes for the customer"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="internalNotes">Internal Notes</Label>
                    <Textarea
                      id="internalNotes"
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      placeholder="Add internal notes (not visible to customer)"
                      rows={3}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Order Summary - Full Width at Bottom */}
          <Card size="sm">
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
                  <div className="space-y-3 text-sm max-w-md ml-auto">
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

                    {customerStateMissing && selectedCustomer && (
                      <Alert variant="destructive" className="py-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Customer has no state on file — GST split below defaults to
                          CGST+SGST, which may be wrong if this is an inter-state sale.
                          Add the customer&apos;s state to get an accurate split.
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

          {/* Warehouse Selection */}
          {selectedCustomer && shippingPincode && (
            <Card size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Source Warehouse
                </CardTitle>
                <CardDescription>Select the warehouse to fulfill this order from</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  const customer = customers.find(c => c.id === selectedCustomer)
                  if (customer?.entity_type === "subdistributor" && parentDistributorGodowns.length === 0) {
                    return (
                      <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-700">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                          <p className="text-sm text-amber-800 dark:text-amber-300">
                            <span className="font-semibold">Parent distributor ({customer.parent_distributor_name || "unknown"}) has no warehouse.</span>{" "}
                            Stock will be deducted from the company warehouse selected below instead of the parent distributor&apos;s warehouse.
                          </p>
                        </div>
                      </div>
                    )
                  }
                  return null
                })()}
                <WarehouseSelector
                  shippingPincode={shippingPincode}
                  selectedWarehouseId={selectedWarehouseId}
                  onWarehouseSelect={setSelectedWarehouseId}
                  selectedProducts={orderItems.map(item => ({
                    product_id: item.product_id,
                    quantity: item.quantity
                  }))}
                  paymentMethod={paymentMethod}
                  excludeWarehouseIds={destinationWarehouseId ? [destinationWarehouseId] : []}
                />
              </CardContent>
            </Card>
          )}

          {/* Destination Warehouse - for distributor/subdistributor/retailer orders */}
          {selectedCustomer && (() => {
            const customer = customers.find(c => c.id === selectedCustomer)
            const entityType = customer?.entity_type
            if (entityType === "customer" || !entityType) return null
            return (
              <Card size="sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Destination Warehouse
                  </CardTitle>
                  <CardDescription>
                    {entityType === "subdistributor"
                      ? "Stock will be added to this subdistributor's warehouse"
                      : `Stock will be added to this ${entityType}'s warehouse`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {noDestinationWarning && (
                    <div className="p-3 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-700">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                        <p className="text-sm text-red-800 dark:text-red-300">
                          <span className="font-semibold">This {entityType} has no warehouse/godown.</span>{" "}
                          Stock will be deducted from source but not tracked at the {entityType}&apos;s end. You can still create the order.
                        </p>
                      </div>
                    </div>
                  )}

                  {distributorGodowns.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        {customer?.first_name} {customer?.last_name}&apos;s Warehouse
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
                                {g.name} ({g.godown_code}) {g.is_primary ? " — Primary" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}

                  {entityType === "subdistributor" && parentDistributorGodowns.length > 0 && (
                    <div className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-950 border-blue-200">
                      <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">
                        Source suggestion for subdistributor:
                      </p>
                      <p className="text-sm">
                        Parent distributor ({parentDistributorGodowns[0].distributor_name}) warehouse:{" "}
                        <span className="font-medium">{parentDistributorGodowns[0].name}</span>
                        <span className="text-xs text-muted-foreground ml-1">({parentDistributorGodowns[0].godown_code})</span>
                      </p>
                    </div>
                  )}

                  {entityType === "subdistributor" && parentDistributorGodowns.length === 0 && (
                    <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-700">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <p className="text-sm text-amber-800 dark:text-amber-300">
                          <span className="font-semibold">Parent distributor has no warehouse.</span>{" "}
                          Using company warehouse as source.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })()}

          {/* Delivery Partner Suggestions */}
          {selectedCustomer && shippingPincode && (
            <Card size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Delivery Partner
                </CardTitle>
                <CardDescription>Suggested delivery partners based on shipping pincode</CardDescription>
              </CardHeader>
              <CardContent>
                <DeliveryPartnerSuggestions
                  shippingPincode={shippingPincode}
                  selectedPartnerId={selectedDeliveryPartnerId}
                  onPartnerSelect={setSelectedDeliveryPartnerId}
                  warehouseId={selectedWarehouseId}
                />
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

      {/* New Customer Dialog */}
      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>
              Enter customer details to create a new customer
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {/* Basic Information Section */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Basic Information</h3>
                <p className="text-sm text-muted-foreground">Personal details of the customer</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={customerFormData.first_name}
                    onChange={(e) =>
                      setCustomerFormData({ ...customerFormData, first_name: e.target.value })
                    }
                    required
                    className={customerFormErrors.first_name ? "border-red-500" : ""}
                  />
                  {customerFormErrors.first_name && (
                    <p className="text-sm text-red-500">{customerFormErrors.first_name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={customerFormData.last_name}
                    onChange={(e) =>
                      setCustomerFormData({ ...customerFormData, last_name: e.target.value })
                    }
                    required
                    className={customerFormErrors.last_name ? "border-red-500" : ""}
                  />
                  {customerFormErrors.last_name && (
                    <p className="text-sm text-red-500">{customerFormErrors.last_name}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={customerFormData.email}
                  onChange={(e) =>
                    setCustomerFormData({ ...customerFormData, email: e.target.value })
                  }
                  className={customerFormErrors.email ? "border-red-500" : ""}
                  placeholder="example@domain.com"
                />
                {customerFormErrors.email && (
                  <p className="text-sm text-red-500">{customerFormErrors.email}</p>
                )}
              </div>
            </div>

            {/* Contact Information Section */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Contact Information</h3>
                <p className="text-sm text-muted-foreground">Phone numbers and contact details</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile_primary">Mobile Primary *</Label>
                <Input
                  id="mobile_primary"
                  value={customerFormData.mobile_primary}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '')
                    setCustomerFormData({ ...customerFormData, mobile_primary: value })
                  }}
                  required
                  maxLength={10}
                  placeholder="10 digit mobile number"
                  className={customerFormErrors.mobile_primary ? "border-red-500" : ""}
                />
                {customerFormErrors.mobile_primary && (
                  <p className="text-sm text-red-500">{customerFormErrors.mobile_primary}</p>
                )}
                {customerFormData.mobile_primary && customerFormData.mobile_primary.length > 0 && !customerFormErrors.mobile_primary && (
                  <p className="text-sm text-muted-foreground">
                    {customerFormData.mobile_primary.length}/10 digits
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp_number">WhatsApp Number</Label>
                  <Input
                    id="whatsapp_number"
                    value={customerFormData.whatsapp_same_as_primary ? customerFormData.mobile_primary : customerFormData.whatsapp_number}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '')
                      setCustomerFormData({ ...customerFormData, whatsapp_number: value, whatsapp_same_as_primary: false })
                    }}
                    disabled={customerFormData.whatsapp_same_as_primary}
                    maxLength={10}
                    placeholder="10 digit number"
                  />
                </div>
                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <label className="flex items-center gap-2 h-10">
                    <input
                      type="checkbox"
                      checked={customerFormData.whatsapp_same_as_primary}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setCustomerFormData({
                          ...customerFormData,
                          whatsapp_same_as_primary: checked,
                          whatsapp_number: checked ? customerFormData.mobile_primary : customerFormData.whatsapp_number
                        })
                      }}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">Same as Primary</span>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mobile_secondary_1">Mobile Secondary 1</Label>
                  <Input
                    id="mobile_secondary_1"
                    value={customerFormData.mobile_secondary_1}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '')
                      setCustomerFormData({ ...customerFormData, mobile_secondary_1: value })
                    }}
                    maxLength={10}
                    placeholder="10 digit number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile_secondary_2">Mobile Secondary 2</Label>
                  <Input
                    id="mobile_secondary_2"
                    value={customerFormData.mobile_secondary_2}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '')
                      setCustomerFormData({ ...customerFormData, mobile_secondary_2: value })
                    }}
                    maxLength={10}
                    placeholder="10 digit number"
                  />
                </div>
              </div>
            </div>

            {/* Business Information Section */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Business Information</h3>
                <p className="text-sm text-muted-foreground">Company, GST, and PAN details (optional)</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  value={customerFormData.company_name}
                  onChange={(e) =>
                    setCustomerFormData({ ...customerFormData, company_name: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gst_number">GST Number</Label>
                  <Input
                    id="gst_number"
                    value={customerFormData.gst_number}
                    onChange={(e) =>
                      setCustomerFormData({ ...customerFormData, gst_number: e.target.value })
                    }
                    maxLength={15}
                    placeholder="15 characters"
                    className={customerFormErrors.gst_number ? "border-red-500" : ""}
                  />
                  {customerFormErrors.gst_number && (
                    <p className="text-sm text-red-500">{customerFormErrors.gst_number}</p>
                  )}
                  {customerFormData.gst_number && customerFormData.gst_number.length > 0 && !customerFormErrors.gst_number && (
                    <p className="text-sm text-muted-foreground">
                      {customerFormData.gst_number.length}/15 characters
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pan_card_number">PAN Card Number</Label>
                  <Input
                    id="pan_card_number"
                    value={customerFormData.pan_card_number}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                      setCustomerFormData({ ...customerFormData, pan_card_number: value })
                    }}
                    maxLength={10}
                    placeholder="ABCDE1234F"
                    className={customerFormErrors.pan_card_number ? "border-red-500" : ""}
                  />
                  {customerFormErrors.pan_card_number && (
                    <p className="text-sm text-red-500">{customerFormErrors.pan_card_number}</p>
                  )}
                  {customerFormData.pan_card_number && customerFormData.pan_card_number.length > 0 && !customerFormErrors.pan_card_number && (
                    <p className="text-sm text-muted-foreground">
                      {customerFormData.pan_card_number.length}/10 characters
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Shipping Address Section */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Shipping Address *</h3>
                <p className="text-sm text-muted-foreground">Provide either full address OR structured address fields</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_address">Full Address (Option 1)</Label>
                <textarea
                  id="full_address"
                  value={customerFormData.full_address}
                  onChange={(e) =>
                    setCustomerFormData({ ...customerFormData, full_address: e.target.value })
                  }
                  rows={3}
                  placeholder="Complete address as provided (optional if structured fields below are filled)"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="text-xs text-muted-foreground">
                  Enter complete address here to skip structured fields below
                </p>
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">OR</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Structured Address (Option 2)</Label>
              </div>
              <div className="grid gap-3">
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    placeholder="Room/Flat No."
                    value={customerFormData.shipping_room_number}
                    onChange={(e) =>
                      setCustomerFormData({ ...customerFormData, shipping_room_number: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Floor"
                    value={customerFormData.shipping_floor}
                    onChange={(e) =>
                      setCustomerFormData({ ...customerFormData, shipping_floor: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Wing/Block"
                    value={customerFormData.shipping_wing}
                    onChange={(e) =>
                      setCustomerFormData({ ...customerFormData, shipping_wing: e.target.value })
                    }
                  />
                </div>
                <Input
                  placeholder="Building Name *"
                  value={customerFormData.shipping_building_name}
                  onChange={(e) =>
                    setCustomerFormData({ ...customerFormData, shipping_building_name: e.target.value })
                  }
                  required
                  className={customerFormErrors.shipping_building_name ? "border-red-500" : ""}
                />
                {customerFormErrors.shipping_building_name && (
                  <p className="text-sm text-red-500">{customerFormErrors.shipping_building_name}</p>
                )}
                <Input
                  placeholder="Street/Area *"
                  value={customerFormData.shipping_street_area}
                  onChange={(e) =>
                    setCustomerFormData({ ...customerFormData, shipping_street_area: e.target.value })
                  }
                  required
                  className={customerFormErrors.shipping_street_area ? "border-red-500" : ""}
                />
                {customerFormErrors.shipping_street_area && (
                  <p className="text-sm text-red-500">{customerFormErrors.shipping_street_area}</p>
                )}
                <Input
                  placeholder="Landmark"
                  value={customerFormData.shipping_landmark}
                  onChange={(e) =>
                    setCustomerFormData({ ...customerFormData, shipping_landmark: e.target.value })
                  }
                />
                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Input
                      placeholder="City *"
                      value={customerFormData.shipping_city}
                      onChange={(e) =>
                        setCustomerFormData({ ...customerFormData, shipping_city: e.target.value })
                      }
                      required
                      className={customerFormErrors.shipping_city ? "border-red-500" : ""}
                    />
                    {customerFormErrors.shipping_city && (
                      <p className="text-xs text-red-500">{customerFormErrors.shipping_city}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Select
                      value={customerFormData.shipping_state}
                      onValueChange={(value) =>
                        setCustomerFormData({ ...customerFormData, shipping_state: value })
                      }
                    >
                      <SelectTrigger className={customerFormErrors.shipping_state ? "border-red-500" : ""}>
                        <SelectValue placeholder="State *" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDIAN_STATES.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {customerFormErrors.shipping_state && (
                      <p className="text-xs text-red-500">{customerFormErrors.shipping_state}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Input
                      placeholder="Pincode *"
                      value={customerFormData.shipping_pincode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '')
                        handlePincodeChange(value, 'shipping')
                      }}
                      required
                      maxLength={6}
                      className={customerFormErrors.shipping_pincode ? "border-red-500" : ""}
                    />
                    {customerFormErrors.shipping_pincode && (
                      <p className="text-xs text-red-500">{customerFormErrors.shipping_pincode}</p>
                    )}
                    {customerFormData.shipping_pincode && customerFormData.shipping_pincode.length > 0 && !customerFormErrors.shipping_pincode && (
                      <p className="text-xs text-muted-foreground">
                        {customerFormData.shipping_pincode.length}/6 digits
                      </p>
                    )}
                  </div>
                  <Input
                    placeholder="Country"
                    value={customerFormData.shipping_country}
                    onChange={(e) =>
                      setCustomerFormData({ ...customerFormData, shipping_country: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Billing Address Section */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Billing Address</h3>
                <p className="text-sm text-muted-foreground">Invoice and billing address</p>
              </div>
              <div className="mb-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={customerFormData.billing_same_as_shipping}
                    onChange={(e) =>
                      setCustomerFormData({ ...customerFormData, billing_same_as_shipping: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Same as Shipping Address</span>
                </label>
              </div>
              {!customerFormData.billing_same_as_shipping && (
                <div className="grid gap-3">
                  <div className="grid grid-cols-3 gap-3">
                    <Input
                      placeholder="Room/Flat No."
                      value={customerFormData.billing_room_number}
                      onChange={(e) =>
                        setCustomerFormData({ ...customerFormData, billing_room_number: e.target.value })
                      }
                    />
                    <Input
                      placeholder="Floor"
                      value={customerFormData.billing_floor}
                      onChange={(e) =>
                        setCustomerFormData({ ...customerFormData, billing_floor: e.target.value })
                      }
                    />
                    <Input
                      placeholder="Wing/Block"
                      value={customerFormData.billing_wing}
                      onChange={(e) =>
                        setCustomerFormData({ ...customerFormData, billing_wing: e.target.value })
                      }
                    />
                  </div>
                  <Input
                    placeholder="Building Name"
                    value={customerFormData.billing_building_name}
                    onChange={(e) =>
                      setCustomerFormData({ ...customerFormData, billing_building_name: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Street/Area"
                    value={customerFormData.billing_street_area}
                    onChange={(e) =>
                      setCustomerFormData({ ...customerFormData, billing_street_area: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Landmark"
                    value={customerFormData.billing_landmark}
                    onChange={(e) =>
                      setCustomerFormData({ ...customerFormData, billing_landmark: e.target.value })
                    }
                  />
                  <div className="grid grid-cols-4 gap-3">
                    <Input
                      placeholder="City"
                      value={customerFormData.billing_city}
                      onChange={(e) =>
                        setCustomerFormData({ ...customerFormData, billing_city: e.target.value })
                      }
                    />
                    <Select
                      value={customerFormData.billing_state}
                      onValueChange={(value) =>
                        setCustomerFormData({ ...customerFormData, billing_state: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="State" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDIAN_STATES.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="space-y-1">
                      <Input
                        placeholder="Pincode"
                        value={customerFormData.billing_pincode}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '')
                          handlePincodeChange(value, 'billing')
                        }}
                        maxLength={6}
                        className={customerFormErrors.billing_pincode ? "border-red-500" : ""}
                      />
                      {customerFormErrors.billing_pincode && (
                        <p className="text-xs text-red-500">{customerFormErrors.billing_pincode}</p>
                      )}
                      {customerFormData.billing_pincode && customerFormData.billing_pincode.length > 0 && !customerFormErrors.billing_pincode && (
                        <p className="text-xs text-muted-foreground">
                          {customerFormData.billing_pincode.length}/6 digits
                        </p>
                      )}
                    </div>
                    <Input
                      placeholder="Country"
                      value={customerFormData.billing_country}
                      onChange={(e) =>
                        setCustomerFormData({ ...customerFormData, billing_country: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Customer Classification Section */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Customer Classification</h3>
                <p className="text-sm text-muted-foreground">Customer type and status tags</p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={customerFormData.is_vip}
                      onChange={(e) => handleVipToggle(e.target.checked)}
                      disabled={generatingVipNumber}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">VIP Customer</span>
                    {generatingVipNumber && (
                      <span className="text-xs text-muted-foreground">(Generating VIP number...)</span>
                    )}
                  </label>
                  {customerFormData.is_vip && (
                    <div className="flex-1 max-w-xs">
                      <Input
                        placeholder="VIP Number (auto-generated)"
                        value={customerFormData.vip_number}
                        onChange={(e) =>
                          setCustomerFormData({ ...customerFormData, vip_number: e.target.value })
                        }
                        className="h-9"
                        title="VIP number is auto-generated. You can edit it if needed."
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={customerFormData.is_mandir}
                    onChange={(e) =>
                      setCustomerFormData({ ...customerFormData, is_mandir: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Mandir/Temple</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={customerFormData.is_defaulter}
                    onChange={(e) =>
                      setCustomerFormData({ ...customerFormData, is_defaulter: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Defaulter</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={customerFormData.is_active}
                    onChange={(e) =>
                      setCustomerFormData({ ...customerFormData, is_active: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Active</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomerDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCustomer} disabled={savingCustomer}>
              {savingCustomer ? "Saving..." : "Create Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
