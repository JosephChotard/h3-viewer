import "@blueprintjs/core/lib/css/blueprint.css";
import "mapbox-gl/dist/mapbox-gl.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
    </StrictMode>
);
