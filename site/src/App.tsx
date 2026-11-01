import { useEffect } from "react";
import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Trailer from "./components/Trailer";
import Story from "./components/Story";
import Toolkit from "./components/Toolkit";
import Install from "./components/Install";
import Help from "./components/Help";
import News from "./components/News";
import Footer from "./components/Footer";
import { Toaster } from "./lib/toast";
import { useScrollChoreography } from "./hooks/useScrollChoreography";

export default function App() {
  useScrollChoreography();

  useEffect(() => {
    // The sections didn't exist yet when the browser looked for /#install, coming from a news page.
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "instant" });
  }, []);

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <Trailer />
        <Story />
        <Toolkit />
        <Install />
        <Help />
        <News />
      </main>
      <Footer />
      <Toaster />
    </>
  );
}
