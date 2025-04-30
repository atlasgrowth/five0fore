import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

document.title = "Five O Four Golf - Food & Beverage Ordering System";

createRoot(document.getElementById("root")!).render(<App />);
