"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, FileSpreadsheet, FileDown } from "lucide-react";
import { exportToCSV, exportToExcel, exportTableToPDF } from "@/lib/export-utils";
import { toast } from "sonner";

interface ExportButtonsProps {
  data: any[];
  filename: string;
  columns?: { header: string; dataKey: string }[];
  pdfTitle?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  disabled?: boolean;
}

export function ExportButtons({
  data,
  filename,
  columns,
  pdfTitle,
  variant = "outline",
  size = "sm",
  disabled = false,
}: ExportButtonsProps) {
  const handleExportCSV = () => {
    try {
      if (!data || data.length === 0) {
        toast.error("No data to export");
        return;
      }
      exportToCSV(data, filename);
      toast.success("Exported to CSV successfully");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export CSV");
    }
  };

  const handleExportExcel = () => {
    try {
      if (!data || data.length === 0) {
        toast.error("No data to export");
        return;
      }
      exportToExcel(data, filename);
      toast.success("Exported to Excel successfully");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export Excel");
    }
  };

  const handleExportPDF = () => {
    try {
      if (!data || data.length === 0) {
        toast.error("No data to export");
        return;
      }

      // If columns are provided, use them; otherwise generate from data keys
      const pdfColumns = columns || Object.keys(data[0]).map(key => ({
        header: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
        dataKey: key
      }));

      exportTableToPDF(data, pdfColumns, filename, pdfTitle);
      toast.success("Exported to PDF successfully");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export PDF");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={disabled || !data || data.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportCSV}>
          <FileText className="mr-2 h-4 w-4" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportExcel}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export as Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportPDF}>
          <FileDown className="mr-2 h-4 w-4" />
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
