import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import Nav from "../components/Nav";
import { useScrollChoreography } from "../hooks/useScrollChoreography";
import { startMedia } from "./media";
import "../styles/site.css";

// The news pages are static HTML: only the nav and the scroll spy run here.
function Client() {
  useScrollChoreography();
  return <Nav base="/" current="/news/" />;
}

startMedia();

hydrateRoot(
  document.getElementById("nav-host")!,
  <StrictMode>
    <Client />
  </StrictMode>,
);
