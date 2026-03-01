import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import aiEmpireLogo from "@/assets/ai-empire-logo.png";

const navLinks = [
  { label: "About", href: "#about" },
  { label: "Events", href: "#events" },
  { label: "Prizes", href: "#prizes" },
  { label: "Register", href: "#register" },
  { label: "Contact", href: "#contact" },
];

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/80 backdrop-blur-xl border-b border-border/50" : ""}`}>
      <div className="container mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
        <a href="#" className="flex items-center gap-2">
          <img src={aiEmpireLogo} alt="Logo" className="w-8 h-8" />
          <span className="font-display text-sm font-bold gold-gradient-text hidden sm:block">EMPIREX</span>
        </a>

        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((l) => (
            <a key={l.label} href={l.href} className="text-sm text-muted-foreground hover:text-primary transition-colors font-body">
              {l.label}
            </a>
          ))}
        </div>

        <button onClick={() => setOpen(!open)} className="md:hidden text-foreground">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-background/95 backdrop-blur-xl border-b border-border/50 px-4 pb-4">
          {navLinks.map((l) => (
            <a
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block py-2 text-sm text-muted-foreground hover:text-primary transition-colors font-body"
            >
              {l.label}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
