'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'
import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Distributor = {
  id: string
  name: string
  company_name: string
}

type StockFiltersProps = {
  onSearchChange: (search: string) => void
  onWarehouseFilter: (warehouse: string) => void
  warehouses: string[]
  categories: string[]
  selectedCategory: string
  onCategoryChange: (category: string) => void
  distributors?: Distributor[]
  selectedDistributor?: string
  onDistributorChange?: (distributorId: string) => void
}

export function StockFilters({
  onSearchChange,
  onWarehouseFilter,
  warehouses,
  categories,
  selectedCategory,
  onCategoryChange,
  distributors,
  selectedDistributor,
  onDistributorChange
}: StockFiltersProps) {
  const [search, setSearch] = useState('')

  const handleSearchChange = (value: string) => {
    setSearch(value)
    onSearchChange(value)
  }

  return (
    <div className="space-y-4 mb-6">
      {/* Category Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={selectedCategory === 'all' ? 'default' : 'outline'}
          onClick={() => onCategoryChange('all')}
          size="sm"
        >
          All
        </Button>
        {categories.map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? 'default' : 'outline'}
            onClick={() => onCategoryChange(category)}
            size="sm"
          >
            {category}
          </Button>
        ))}
      </div>

      {/* Search, Distributor and Warehouse Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Label htmlFor="search" className="sr-only">Search products</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              id="search"
              placeholder="Search products..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        {distributors && onDistributorChange && (
          <div className="w-full sm:w-[250px]">
            <Label htmlFor="distributor" className="sr-only">Filter by distributor</Label>
            <Select value={selectedDistributor || 'all'} onValueChange={onDistributorChange}>
              <SelectTrigger id="distributor" className="w-full">
                <SelectValue placeholder="All Distributors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Distributors</SelectItem>
                {distributors.map((distributor) => (
                  <SelectItem key={distributor.id} value={distributor.id}>
                    {distributor.name} ({distributor.company_name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="w-full sm:w-[200px]">
          <Label htmlFor="warehouse" className="sr-only">Filter by warehouse</Label>
          <Select onValueChange={onWarehouseFilter} defaultValue="all">
            <SelectTrigger id="warehouse" className="w-full">
              <SelectValue placeholder="All Warehouses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Warehouses</SelectItem>
              {warehouses.map((warehouse) => (
                <SelectItem key={warehouse} value={warehouse}>
                  {warehouse}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
