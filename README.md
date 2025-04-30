# SwingEats - Golf Facility Food Ordering System

SwingEats is a comprehensive digital food ordering system designed for golf facilities with multiple bays. It provides a seamless experience for customers, servers, and kitchen staff, streamlining the food ordering and preparation process.

## Features

- **Multi-Interface System**:
  - Customer QR-code based ordering interface
  - Server ordering and management interface
  - Kitchen preparation and order management interface

- **Real-time Updates**: WebSocket integration ensures all interfaces stay in sync with real-time updates

- **Kitchen Management**: Prioritized order display with timing tracking and alerts for delayed orders

- **Bay Management**: Visual tracking of bay status across multiple floors

## Technology Stack

- **Frontend**: React, TypeScript, TailwindCSS, Shadcn UI components
- **Backend**: Node.js, Express
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time Updates**: WebSockets
- **Docker**: For containerized database deployment

## Getting Started

1. Start the database:
   ```bash
   docker compose up -d
   ```
2. Copy the environment file:
   ```bash
   cp .env.example .env
   ```
3. Install dependencies:
   ```bash
   npm i
   ```
4. Set up and seed the database:
   ```bash
   npm run db:push && npm run db:seed
   ```
5. Start the development server:
   ```bash
   npm run dev
   ```

## Data Model

The application uses a PostgreSQL database with the following schema:

- **Users**: System users with different roles (admin, server, kitchen staff)
- **Bays**: Golf bays with status tracking (100 bays across 3 floors)
- **Categories**: Menu item categories (drinks, appetizers, main courses, etc.)
- **MenuItems**: Food and beverage offerings with prices and preparation times
- **Orders**: Customer orders linked to specific bays
- **OrderItems**: Individual items within an order

All schema definitions and types are managed in the `shared/schema.ts` file using Drizzle ORM and Zod for validation.

## Application Structure

- **Customer View**: Scan QR code to access bay-specific menu, place and track orders
- **Server View**: Monitor bay status, manage orders, place orders on behalf of customers
- **Kitchen View**: Track and prioritize incoming orders, mark items as prepared

## Recent Improvements

- **Database Migration**: Switched from in-memory storage to PostgreSQL with Drizzle ORM
- **Type Consistency**: Fixed naming inconsistencies (price → priceCents, qty → quantity)
- **String IDs**: Orders and order items now use string IDs instead of number IDs for better compatibility
- **DTO Pattern**: Added Data Transfer Object mappers to ensure consistent API responses
- **QR Code Generation**: Added script to generate QR codes for all 100 bays across 3 floors

## License

MIT