# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 application using the App Router, React 19, TypeScript, and Tailwind CSS 4. The project is configured with shadcn/ui component system (New York style) and includes Turbopack for faster development builds.

## Development Commands
 
```bash 
# Start development server with Turbopack
npm run dev

# Build for production with Turbopack
npm run build

# Start production server
npm start

# Run ESLint
npm run lint
```

The development server runs on http://localhost:3000 by default.

## Architecture

### Directory Structure

- **`app/`** - Next.js App Router directory
  - `layout.tsx` - Root layout with Geist font configuration
  - `page.tsx` - Home page component
  - `globals.css` - Global styles with Tailwind CSS 4 and custom theme variables
- **`lib/`** - Utility functions
  - `utils.ts` - Contains `cn()` utility for merging Tailwind classes
- **`public/`** - Static assets (SVG icons)
- **`components/`** - React components (currently empty, ready for shadcn/ui components)

### Styling Architecture

The project uses Tailwind CSS 4 with custom CSS variables for theming:
- Native `@import` syntax for Tailwind and tw-animate-css
- Custom variant for dark mode: `@custom-variant dark (&:is(.dark *))`
- Theme system using CSS custom properties defined in `@theme inline` block
- Color system based on OKLCH color space for better perceptual uniformity
- Comprehensive light/dark theme variables defined in `:root` and `.dark` classes

### Path Aliases

TypeScript path mapping is configured with `@/*` pointing to the root directory:
- `@/components` - Components directory
- `@/lib/utils` - Utilities
- `@/components/ui` - UI components (shadcn/ui)
- `@/lib` - Library code
- `@/hooks` - React hooks

### shadcn/ui Configuration

The project is configured for shadcn/ui with:
- Style: "new-york"
- RSC enabled (React Server Components)
- Base color: neutral
- CSS variables enabled
- Icon library: lucide-react

To add components, use:
```bash
npx shadcn@latest add <component-name>
```

## Technology Stack

- **Framework**: Next.js 15.5.5 with App Router
- **React**: 19.1.0
- **TypeScript**: 5.x (strict mode enabled)
- **Styling**: Tailwind CSS 4 with PostCSS
- **UI Components**: shadcn/ui (class-variance-authority, clsx, tailwind-merge)
- **Icons**: lucide-react
- **Build Tool**: Turbopack (via Next.js)
- **Fonts**: Geist Sans and Geist Mono (self-hosted via next/font)

## Configuration Notes

- **TypeScript**: Strict mode enabled, ES2017 target, bundler module resolution
- **ESLint**: Using Next.js core-web-vitals and TypeScript configurations
- **PostCSS**: Single plugin configuration for Tailwind CSS 4
- **Next.js**: Minimal configuration in `next.config.ts` (default settings)

## MCP Servers

This project uses Model Context Protocol (MCP) servers to enhance Claude Code capabilities. The following MCP servers are configured in `.mcp.json`:

### shadcn MCP

Provides direct integration with shadcn/ui component system:
- Search and browse available components from registries
- View detailed component information and examples
- Get CLI commands to add components to the project
- Access component demos and usage patterns

Configuration in `.mcp.json`:
```json
{
  "mcpServers": {
    "shadcn": {
      "command": "cmd",
      "args": ["/c", "npx", "shadcn@latest", "mcp"]
    }
  }
}
```

### Supabase MCP

Provides integration with Supabase backend services:
- Database operations and schema management
- Authentication and user management
- Storage and file operations
- Real-time subscriptions
- Edge functions

When working with Supabase, ensure the MCP server is properly configured with the project URL and API keys.
