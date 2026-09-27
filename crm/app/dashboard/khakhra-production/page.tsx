"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { format } from "date-fns"

type Category = { id: string; name: string }
type Recipe = { id: string; flavor_category_id: string; raw_material_category_id: string; grams_per_kg_output: number }
type ProductionRun = {
  id: string
  flavor_category_id: string
  output_quantity_kg: number
  batch_number: string | null
  production_date: string
  notes: string | null
}

const FLAVOR_SUFFIX = "Khakhra"

export default function KhakhraProductionPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [runs, setRuns] = useState<ProductionRun[]>([])
  const [looseStock, setLooseStock] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const [recipeFlavorId, setRecipeFlavorId] = useState<string>("")
  const [recipeInputs, setRecipeInputs] = useState<Record<string, string>>({})
  const [savingRecipe, setSavingRecipe] = useState(false)

  const [runFlavorId, setRunFlavorId] = useState<string>("")
  const [outputKg, setOutputKg] = useState("")
  const [batchNumber, setBatchNumber] = useState("")
  const [notes, setNotes] = useState("")
  const [loggingRun, setLoggingRun] = useState(false)

  const flavors = categories.filter((c) => c.name.endsWith(FLAVOR_SUFFIX))
  const rawMaterials = categories.filter((c) => !c.name.endsWith(FLAVOR_SUFFIX))

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [catsRes, recipesRes, runsRes, looseRes] = await Promise.all([
        supabase.from("product_categories").select("id, name").order("name"),
        supabase.from("khakhra_recipes").select("id, flavor_category_id, raw_material_category_id, grams_per_kg_output"),
        supabase.from("khakhra_production_runs").select("id, flavor_category_id, output_quantity_kg, batch_number, production_date, notes").order("production_date", { ascending: false }).limit(50),
        supabase.from("loose_stock").select("category_id, quantity_kg"),
      ])
      if (catsRes.error) throw catsRes.error
      if (recipesRes.error) throw recipesRes.error
      if (runsRes.error) throw runsRes.error
      if (looseRes.error) throw looseRes.error

      setCategories(catsRes.data || [])
      setRecipes(recipesRes.data || [])
      setRuns(runsRes.data || [])
      const stockMap: Record<string, number> = {}
      ;(looseRes.data || []).forEach((row: any) => { stockMap[row.category_id] = Number(row.quantity_kg) })
      setLooseStock(stockMap)
    } catch (error) {
      console.error("Error loading khakhra production data:", error)
      toast.error("Failed to load production data")
    } finally {
      setLoading(false)
    }
  }

  // Populate the recipe input fields whenever the selected flavor (or the
  // loaded recipes) changes, so editing shows current saved values.
  useEffect(() => {
    if (!recipeFlavorId) { setRecipeInputs({}); return }
    const inputs: Record<string, string> = {}
    rawMaterials.forEach((m) => {
      const existing = recipes.find((r) => r.flavor_category_id === recipeFlavorId && r.raw_material_category_id === m.id)
      inputs[m.id] = existing ? String(existing.grams_per_kg_output) : ""
    })
    setRecipeInputs(inputs)
  }, [recipeFlavorId, recipes, rawMaterials.length])

  const saveRecipe = async () => {
    if (!recipeFlavorId) { toast.error("Select a flavor first"); return }
    setSavingRecipe(true)
    try {
      const rows = Object.entries(recipeInputs)
        .filter(([, value]) => value.trim() !== "")
        .map(([rawMaterialId, value]) => ({
          flavor_category_id: recipeFlavorId,
          raw_material_category_id: rawMaterialId,
          grams_per_kg_output: parseFloat(value),
        }))
        .filter((row) => !isNaN(row.grams_per_kg_output) && row.grams_per_kg_output > 0)

      if (rows.length === 0) { toast.error("Enter at least one ingredient amount"); return }

      const { error } = await supabase
        .from("khakhra_recipes")
        .upsert(rows, { onConflict: "flavor_category_id,raw_material_category_id" })
      if (error) throw error

      toast.success("Recipe saved")
      loadAll()
    } catch (error) {
      console.error("Error saving recipe:", error)
      toast.error("Failed to save recipe")
    } finally {
      setSavingRecipe(false)
    }
  }

  const flavorRecipeRows = recipes.filter((r) => r.flavor_category_id === runFlavorId)
  const outputKgNum = parseFloat(outputKg) || 0
  const consumptionPreview = flavorRecipeRows.map((r) => {
    const material = rawMaterials.find((m) => m.id === r.raw_material_category_id)
    const gramsNeeded = r.grams_per_kg_output * outputKgNum
    const kgNeeded = gramsNeeded / 1000
    const available = looseStock[r.raw_material_category_id] || 0
    return { material: material?.name || "Unknown", kgNeeded, available, sufficient: available >= kgNeeded }
  })
  const canLogRun = runFlavorId !== "" && outputKgNum > 0 && flavorRecipeRows.length > 0 && consumptionPreview.every((c) => c.sufficient)

  const logProductionRun = async () => {
    if (!canLogRun) return
    setLoggingRun(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { data: run, error: runError } = await supabase
        .from("khakhra_production_runs")
        .insert({
          flavor_category_id: runFlavorId,
          output_quantity_kg: outputKgNum,
          batch_number: batchNumber.trim() || null,
          notes: notes.trim() || null,
          user_id: user?.id || null,
          user_email: user?.email || null,
        })
        .select("id")
        .single()
      if (runError) throw runError

      // Deduct each raw ingredient from its loose_stock tank, logging a
      // transaction per ingredient (mirrors how ghee's packaging "transfer"
      // logs one loose_stock_transactions row per consumption event).
      for (const row of flavorRecipeRows) {
        const kgNeeded = (row.grams_per_kg_output * outputKgNum) / 1000
        const { data: stockRow, error: stockFetchError } = await supabase
          .from("loose_stock")
          .select("id, quantity_kg")
          .eq("category_id", row.raw_material_category_id)
          .single()
        if (stockFetchError) throw stockFetchError

        const { error: updateError } = await supabase
          .from("loose_stock")
          .update({ quantity_kg: Number(stockRow.quantity_kg) - kgNeeded })
          .eq("id", stockRow.id)
        if (updateError) throw updateError

        const { error: txnError } = await supabase.from("loose_stock_transactions").insert({
          loose_stock_id: stockRow.id,
          transaction_type: "transfer",
          quantity_kg: -kgNeeded,
          user_id: user?.id || null,
          user_email: user?.email || null,
          transaction_notes: `Consumed for production run ${run.id}`,
        })
        if (txnError) throw txnError
      }

      // Credit the flavor's own loose-stock tank with the produced weight.
      const { data: flavorStock, error: flavorFetchError } = await supabase
        .from("loose_stock")
        .select("id, quantity_kg")
        .eq("category_id", runFlavorId)
        .single()
      if (flavorFetchError) throw flavorFetchError

      const { error: flavorUpdateError } = await supabase
        .from("loose_stock")
        .update({ quantity_kg: Number(flavorStock.quantity_kg) + outputKgNum })
        .eq("id", flavorStock.id)
      if (flavorUpdateError) throw flavorUpdateError

      toast.success(`Logged production run: ${outputKgNum}kg`)
      setOutputKg("")
      setBatchNumber("")
      setNotes("")
      loadAll()
    } catch (error) {
      console.error("Error logging production run:", error)
      toast.error("Failed to log production run")
    } finally {
      setLoggingRun(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Khakhra Production</h1>
        <p className="text-sm text-muted-foreground">Recipes and production runs, in kg</p>
      </div>

      <Tabs defaultValue="runs" className="w-full">
        <TabsList>
          <TabsTrigger value="runs">Production Runs</TabsTrigger>
          <TabsTrigger value="recipes">Recipes</TabsTrigger>
        </TabsList>

        <TabsContent value="runs" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Log a Production Run</CardTitle>
              <CardDescription>Enter the flavor and how much finished khakhra came out of this batch</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Flavor</Label>
                  <Select value={runFlavorId} onValueChange={setRunFlavorId}>
                    <SelectTrigger><SelectValue placeholder="Select flavor" /></SelectTrigger>
                    <SelectContent>
                      {flavors.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Output (kg)</Label>
                  <Input type="number" step="0.01" value={outputKg} onChange={(e) => setOutputKg(e.target.value)} placeholder="e.g. 12" />
                </div>
                <div className="space-y-2">
                  <Label>Batch Number</Label>
                  <Input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="Optional" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
              </div>

              {runFlavorId && flavorRecipeRows.length === 0 && (
                <p className="text-sm text-amber-600">No recipe defined for this flavor yet — add one in the Recipes tab first.</p>
              )}

              {consumptionPreview.length > 0 && (
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ingredient</TableHead>
                        <TableHead className="text-right">Needed (kg)</TableHead>
                        <TableHead className="text-right">Available (kg)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {consumptionPreview.map((c) => (
                        <TableRow key={c.material}>
                          <TableCell>{c.material}</TableCell>
                          <TableCell className="text-right">{c.kgNeeded.toFixed(3)}</TableCell>
                          <TableCell className={`text-right ${c.sufficient ? "" : "text-red-600 font-medium"}`}>{c.available.toFixed(3)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <Button onClick={logProductionRun} disabled={!canLogRun || loggingRun}>
                {loggingRun ? "Logging..." : "Log Production Run"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Recent Runs</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Flavor</TableHead>
                    <TableHead className="text-right">Output (kg)</TableHead>
                    <TableHead>Batch</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>{format(new Date(run.production_date), "dd MMM yyyy")}</TableCell>
                      <TableCell>{categories.find((c) => c.id === run.flavor_category_id)?.name || "Unknown"}</TableCell>
                      <TableCell className="text-right">{run.output_quantity_kg}</TableCell>
                      <TableCell>{run.batch_number || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recipes" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Flavor Recipe</CardTitle>
              <CardDescription>Grams of each raw ingredient per 1kg of finished khakhra</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 max-w-xs">
                <Label>Flavor</Label>
                <Select value={recipeFlavorId} onValueChange={setRecipeFlavorId}>
                  <SelectTrigger><SelectValue placeholder="Select flavor" /></SelectTrigger>
                  <SelectContent>
                    {flavors.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {recipeFlavorId && (
                <>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Raw Material</TableHead>
                          <TableHead className="text-right">Grams per kg output</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rawMaterials.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell>{m.name}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.1"
                                className="w-32 ml-auto text-right"
                                value={recipeInputs[m.id] || ""}
                                onChange={(e) => setRecipeInputs({ ...recipeInputs, [m.id]: e.target.value })}
                                placeholder="0"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Button onClick={saveRecipe} disabled={savingRecipe}>
                    {savingRecipe ? "Saving..." : "Save Recipe"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
