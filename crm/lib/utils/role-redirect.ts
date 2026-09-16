import { UserRole } from "@/lib/types/database"

/**
 * Determines the appropriate redirect path based on user role
 * @param role - The user's role
 * @returns The path to redirect to after login
 */
export function getRoleBasedRedirectPath(role: UserRole | null): string {
  if (!role) {
    return "/dashboard"
  }

  switch (role) {
    case "main_distributor":
    case "sub_distributor":
      return "/dashboard/distributor-panel"

    case "retailer":
      return "/dashboard/retailer-panel"

    case "vendors":
      return "/dashboard/vendor-panel"

    case "delivery_driver":
      return "/dashboard/delivery-drivers"

    case "customer_support":
      return "/dashboard/agent-dashboard"

    case "factories":
      return "/dashboard/factory-dashboard"

    case "admin":
    case "warehouse":
    default:
      return "/dashboard"
  }
}