import { useRoute } from "wouter";
import CustomerView from "@/components/customer/CustomerView";
import NotFound from "@/pages/not-found";

export default function Customer() {
  const [match, params] = useRoute("/customer/:bayNumber");
  
  if (!match || !params.bayNumber || isNaN(Number(params.bayNumber))) {
    return <NotFound />;
  }
  
  const bayNumber = parseInt(params.bayNumber);
  
  return <CustomerView bayNumber={bayNumber} />;
}
