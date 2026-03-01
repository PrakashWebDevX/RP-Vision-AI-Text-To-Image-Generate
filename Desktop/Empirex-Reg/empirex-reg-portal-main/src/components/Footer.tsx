import aiEmpireLogo from "@/assets/ai-empire-logo.png";

const Footer = () => (
  <footer className="border-t border-border/50 py-8 px-4">
    <div className="container mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <img src={aiEmpireLogo} alt="AI Empire" className="w-8 h-8" />
        <span className="font-display text-sm font-bold gold-gradient-text">EMPIREX 2026</span>
      </div>
      <p className="text-xs text-muted-foreground font-body text-center">
        © 2026 Department of AI & Data Science, RVS Technical Campus. All rights reserved.
      </p>
      <div className="flex gap-6">
        {["About", "Events", "Register", "Contact"].map((link) => (
          <a
            key={link}
            href={`#${link.toLowerCase()}`}
            className="text-xs text-muted-foreground hover:text-primary transition-colors font-body"
          >
            {link}
          </a>
        ))}
      </div>
    </div>
  </footer>
);

export default Footer;
