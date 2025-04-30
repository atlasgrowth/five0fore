import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import qrCode from "@/assets/qr-code.svg";
import { CircleDot, UtensilsCrossed, ChefHat, QrCode } from "lucide-react";

export default function Home() {
  const [bayNumber, setBayNumber] = useState("");
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]"></div>
      
      <Card className="w-full max-w-md glassmorphism overflow-hidden animate-scale-in border-none">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary opacity-10 rounded-full -mr-10 -mt-10 z-0"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-secondary opacity-10 rounded-full -ml-10 -mb-10 z-0"></div>
        
        <CardHeader className="relative z-10 text-center py-8 border-b border-white/10">
          <div className="flex justify-center mb-2">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <CircleDot className="h-8 w-8 text-primary animate-pulse-subtle" />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-secondary text-white rounded-full p-2">
                <UtensilsCrossed className="h-4 w-4" />
              </div>
            </div>
          </div>
          <CardTitle className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
            SwingEats
          </CardTitle>
          <p className="text-muted-foreground mt-1">New Orleans Premier Golf Entertainment</p>
        </CardHeader>
        
        <CardContent className="pt-8 pb-6 space-y-8 relative z-10">
          <div className="text-center space-y-4">
            <h2 className="text-xl font-semibold">Select Interface</h2>
            
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Link href="/server">
                <Button className="w-full btn-modern bg-primary text-white h-12 group" size="lg">
                  <span className="mr-2 group-hover:scale-110 transition-transform">
                    <UtensilsCrossed className="h-4 w-4 inline" />
                  </span>
                  Server View
                </Button>
              </Link>
              <Link href="/kitchen">
                <Button className="w-full btn-modern bg-accent text-accent-foreground h-12 group" size="lg">
                  <span className="mr-2 group-hover:scale-110 transition-transform">
                    <ChefHat className="h-4 w-4 inline" />
                  </span>
                  Kitchen View
                </Button>
              </Link>
            </div>
          </div>
          
          <div className="section-divider">
            <span>Or access customer view</span>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bay-number" className="text-sm font-medium">Bay Number</Label>
              <Input 
                id="bay-number" 
                type="number" 
                placeholder="Enter your bay number"
                value={bayNumber}
                onChange={(e) => setBayNumber(e.target.value)}
                className="transition-all duration-300 focus:ring-2 focus:ring-primary/50" 
              />
            </div>
            
            <Link href={`/customer/${bayNumber}`}>
              <Button 
                className="w-full btn-modern bg-secondary text-white h-12 mt-2" 
                size="lg"
                disabled={!bayNumber}
              >
                Go to Customer Menu
              </Button>
            </Link>
          </div>
          
          <div className="mt-8 text-center">
            <div className="section-divider">
              <span>Quick Access</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Scan QR code at your bay</p>
            <div className="flex justify-center hover-lift">
              <div className="relative p-1.5 bg-white rounded-lg shadow-md">
                <QrCode className="absolute top-0 right-0 h-6 w-6 -mt-2 -mr-2 bg-white rounded-full p-1 text-primary" />
                <img src={qrCode} alt="QR Code for menu" className="w-32 h-32" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
