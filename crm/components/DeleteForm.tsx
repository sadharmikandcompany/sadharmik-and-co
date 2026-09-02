"use client";

import { ReactNode } from "react";

export function DeleteForm({ 
  action, 
  children, 
  confirmMessage = "Are you sure you want to delete this?" 
}: { 
  action: string | ((formData: FormData) => void | Promise<void>); 
  children: ReactNode; 
  confirmMessage?: string;
}) {
  return (
    <form 
      action={action} 
      onSubmit={(e) => {
        if (!confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </form>
  );
}
