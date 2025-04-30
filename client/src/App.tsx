import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Customer from "@/pages/customer";
import Server from "@/pages/server";
import Kitchen from "@/pages/kitchen";
import { OrderProvider } from "@/contexts/OrderContext";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/customer/:bayNumber" component={Customer} />
      <Route path="/server" component={Server} />
      <Route path="/kitchen" component={Kitchen} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <OrderProvider>
          <Toaster />
          <Router />
        </OrderProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
