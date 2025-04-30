import { cn } from "@/lib/utils";

interface OrderStatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig = {
  pending: {
    background: 'bg-neutral-200 bg-opacity-60',
    text: 'text-neutral-700',
    label: 'Pending'
  },
  preparing: {
    background: 'bg-success bg-opacity-10',
    text: 'text-success',
    label: 'In Progress'
  },
  cooking: {
    background: 'bg-amber-100',
    text: 'text-amber-700',
    label: 'Cooking'
  },
  plating: {
    background: 'bg-purple-100',
    text: 'text-purple-700',
    label: 'Plating'
  },
  ready: {
    background: 'bg-warning bg-opacity-10',
    text: 'text-warning',
    label: 'Ready'
  },
  served: {
    background: 'bg-primary bg-opacity-10',
    text: 'text-primary',
    label: 'Served'
  },
  dining: {
    background: 'bg-purple-100',
    text: 'text-purple-700',
    label: 'Dining'
  },
  paid: {
    background: 'bg-teal-100',
    text: 'text-teal-700',
    label: 'Paid'
  },
  closed: {
    background: 'bg-gray-200',
    text: 'text-gray-700',
    label: 'Closed'
  },
  cancelled: {
    background: 'bg-neutral-200 bg-opacity-60',
    text: 'text-neutral-600',
    label: 'Cancelled'
  },
  delayed: {
    background: 'bg-danger bg-opacity-10',
    text: 'text-danger',
    label: 'Delayed'
  }
};

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const isDelayed = status === 'delayed';
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

  return (
    <span className={cn(
      "px-2 py-1 text-xs rounded-full",
      config.background,
      config.text,
      className
    )}>
      {config.label}
    </span>
  );
}
