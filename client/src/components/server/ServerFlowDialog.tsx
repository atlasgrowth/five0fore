import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { OrderSummary, OrderWithItems } from "@shared/schema";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/ui/order-status-badge";
import { 
  CheckCircle, 
  AlertTriangle, 
  ChevronRight, 
  AlertCircle,
  ThumbsUp
} from "lucide-react";

interface ServerFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderSummary;
  orderDetails: OrderWithItems | null;
  isLoadingDetails: boolean;
  onComplete: () => void;
}

export default function ServerFlowDialog({ 
  open, 
  onOpenChange, 
  order, 
  orderDetails,
  isLoadingDetails,
  onComplete
}: ServerFlowDialogProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Steps in the server flow
  const steps = [
    { id: 'verification', title: 'Verify Order' },
    { id: 'delivery', title: 'Deliver Items' },
    { id: 'confirmation', title: 'Confirm Completion' }
  ];

  const markAsServed = async () => {
    if (!order) return;
    
    try {
      setIsSubmitting(true);
      await apiRequest('PUT', `/api/order/${order.id}/status`, { status: 'served' });
      
      toast({
        title: "Order Served Successfully",
        description: "The order has been marked as served.",
      });
      
      // Close dialog and reset
      onComplete();
      setCurrentStep(0);
      setIsSubmitting(false);
    } catch (error) {
      console.error("Error marking order as served:", error);
      toast({
        title: "Error",
        description: "Failed to update order status.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  const handleNextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      markAsServed();
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepContent = () => {
    if (isLoadingDetails) {
      return (
        <div className="flex items-center justify-center p-8">
          <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      );
    }

    switch(currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="bg-neutral-50 p-4 rounded-lg">
              <div className="font-medium text-lg mb-2">Order Summary</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-neutral-500">Order ID</div>
                  <div className="font-medium">#{order.orderNumber}</div>
                </div>
                <div>
                  <div className="text-sm text-neutral-500">Bay</div>
                  <div className="font-medium">Bay {order.bayNumber} (Floor {order.floor})</div>
                </div>
                <div>
                  <div className="text-sm text-neutral-500">Status</div>
                  <OrderStatusBadge status={order.status} />
                </div>
                <div>
                  <div className="text-sm text-neutral-500">Time Elapsed</div>
                  <div className={`font-medium ${order.isDelayed ? 'text-danger' : ''}`}>
                    {order.timeElapsed} minutes
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="font-medium text-lg">Items to Serve</div>
              {orderDetails?.items && orderDetails.items.length > 0 ? (
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {orderDetails.items.map((item) => (
                    <div 
                      key={item.id} 
                      className="flex flex-col p-3 bg-white border border-neutral-200 rounded-md"
                    >
                      <div className="flex justify-between w-full">
                        <div className="flex-1">
                          <div className="font-medium">
                            {item.quantity}x {item.menuItem?.name || 'Unknown Item'}
                          </div>
                          <div className="text-xs text-neutral-500">
                            Station: {item.menuItem?.station || item.station || 'Unknown'}
                          </div>
                          
                          {/* Display item notes if available */}
                          {item.notes && (
                            <div className="text-xs italic mt-1 p-1 bg-neutral-100 rounded">
                              <span className="font-medium">Notes:</span> {item.notes}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center">
                          <div className="text-sm mr-2">
                            {item.status === 'READY' ? (
                              <span className="flex items-center text-success">
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Ready
                              </span>
                            ) : item.status === 'DELIVERED' ? (
                              <span className="flex items-center text-primary">
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Delivered
                              </span>
                            ) : (
                              <span className="flex items-center text-warning">
                                <AlertTriangle className="h-4 w-4 mr-1" />
                                Pending
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Display customizations if available */}
                      {item.customizations && item.customizations.length > 0 && (
                        <div className="text-xs bg-blue-50 p-2 rounded mt-1 border border-blue-200">
                          <div className="font-medium text-blue-700 border-b border-blue-100 pb-1 mb-1">Customizations:</div>
                          <ul className="list-disc list-inside text-blue-800">
                            {item.customizations.map((customization, idx) => (
                              <li key={idx} className="pl-1 mb-1">
                                <span className="font-medium">{customization.categoryName}:</span> {customization.options.map(opt => opt.name).join(', ')}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-neutral-500 text-center p-4 bg-neutral-50 rounded-md">
                  No items found
                </div>
              )}
            </div>
            
            {/* Special instructions have been moved to item level notes and customizations */}
            
            <div className="bg-amber-50 p-3 rounded-md border border-amber-200 flex items-start">
              <AlertCircle className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-amber-800">Verification Required</div>
                <div className="text-sm text-amber-700">
                  Please verify that all items are prepared and ready to be served to the customer.
                  All items should be marked as "Ready" by the kitchen.
                </div>
              </div>
            </div>
          </div>
        );
      
      case 1:
        return (
          <div className="space-y-4">
            <div className="bg-blue-50 p-3 rounded-md border border-blue-200 flex items-start mb-4">
              <AlertCircle className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-blue-800">Delivery Instructions</div>
                <div className="text-sm text-blue-700">
                  Take all items to Bay {order.bayNumber} on Floor {order.floor}.
                  Check all items against the list below before presenting to the customer.
                </div>
              </div>
            </div>
            
            <div className="font-medium text-lg">Delivery Checklist</div>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {orderDetails?.items && orderDetails.items.map((item, index) => (
                <div key={item.id} className="flex flex-col bg-white border border-neutral-200 p-3 rounded-md">
                  <div className="flex items-center">
                    <div className="mr-3 text-neutral-500 font-medium">{index + 1}.</div>
                    <div className="flex-1">
                      <div className="font-medium">{item.quantity}x {item.menuItem?.name || 'Unknown Item'}</div>
                      <div className="text-xs text-neutral-500">
                        {item.menuItem?.description || 'No description available'}
                      </div>
                      
                      {/* Display item notes if available */}
                      {item.notes && (
                        <div className="text-xs italic mt-1 p-1 bg-neutral-100 rounded">
                          <span className="font-medium">Notes:</span> {item.notes}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Display customizations if available */}
                  {item.customizations && item.customizations.length > 0 && (
                    <div className="text-xs bg-blue-50 p-2 rounded mt-1 border border-blue-200 ml-7">
                      <div className="font-medium text-blue-700 border-b border-blue-100 pb-1 mb-1">Customizations:</div>
                      <ul className="list-disc list-inside text-blue-800">
                        {item.customizations.map((customization, idx) => (
                          <li key={idx} className="pl-1 mb-1">
                            <span className="font-medium">{customization.categoryName}:</span> {customization.options.map(opt => opt.name).join(', ')}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-2 bg-neutral-50 p-3 rounded-md">
              <div className="font-medium mb-1">Delivery Notes:</div>
              <ul className="text-sm space-y-1 text-neutral-700">
                <li>• Verify the customer at Bay {order.bayNumber}</li>
                <li>• Ensure all items are present and correctly prepared</li>
                <li>• Ask if the customer needs anything else</li>
                <li>• Thank the customer for their order</li>
              </ul>
            </div>
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-4 text-center py-6">
            <div className="mx-auto w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
              <ThumbsUp className="h-10 w-10 text-success" />
            </div>
            
            <div>
              <h3 className="text-xl font-semibold">Order Ready to Complete</h3>
              <p className="text-neutral-600 mt-1">
                Confirm that all items have been delivered to Bay {order.bayNumber}.
              </p>
            </div>
            
            <div className="bg-neutral-50 p-4 rounded-lg mx-auto max-w-sm">
              <div className="font-medium text-center mb-2">Order Summary</div>
              <div className="flex justify-between mb-1">
                <span className="text-neutral-500">Order ID:</span>
                <span className="font-medium">#{order.orderNumber}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-neutral-500">Bay:</span>
                <span className="font-medium">Bay {order.bayNumber} (Floor {order.floor})</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-neutral-500">Items:</span>
                <span className="font-medium">{order.totalItems} items</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Time Elapsed:</span>
                <span className="font-medium">{order.timeElapsed} minutes</span>
              </div>
            </div>
            
            <div className="bg-neutral-50 p-3 rounded-md border border-neutral-200 text-left">
              <div className="font-medium mb-1">Confirm completion by clicking "Complete Service" below.</div>
              <div className="text-sm text-neutral-600">
                This will mark the order as "Served" in the system.
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Serve Order #{order.orderNumber}</DialogTitle>
          <DialogDescription>
            Follow the steps below to serve this order to the customer
          </DialogDescription>
        </DialogHeader>
        
        {/* Progress Steps */}
        <div className="flex justify-between mb-6 relative">
          {steps.map((step, index) => (
            <div key={step.id} className="flex flex-col items-center relative z-10">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center mb-1
                  ${currentStep >= index 
                    ? 'bg-primary text-white' 
                    : 'bg-neutral-200 text-neutral-500'
                  }`}
              >
                {index + 1}
              </div>
              <div className="text-xs text-center w-20">
                {step.title}
              </div>
            </div>
          ))}
          
          {/* Progress bar */}
          <div className="absolute top-4 left-0 right-0 h-0.5 bg-neutral-200">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
            ></div>
          </div>
        </div>
        
        {/* Step Content */}
        <div className="min-h-[300px]">
          {renderStepContent()}
        </div>
        
        {/* Actions */}
        <DialogFooter className="flex justify-between items-center border-t pt-4">
          {currentStep > 0 ? (
            <Button 
              variant="outline" 
              onClick={handlePrevStep}
              disabled={isSubmitting}
            >
              Back
            </Button>
          ) : (
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
          
          <Button 
            onClick={handleNextStep}
            className="bg-primary hover:bg-primary-dark"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : currentStep === steps.length - 1 ? (
              <span className="flex items-center">
                Complete Service <CheckCircle className="ml-2 h-4 w-4" />
              </span>
            ) : (
              <span className="flex items-center">
                Next Step <ChevronRight className="ml-2 h-4 w-4" />
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}