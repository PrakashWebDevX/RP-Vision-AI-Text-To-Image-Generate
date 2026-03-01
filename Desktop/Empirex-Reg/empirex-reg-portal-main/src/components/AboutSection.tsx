import { motion } from "framer-motion";

const AboutSection = () => (
  <section id="about" className="py-20 px-4">
    <div className="container mx-auto max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="section-heading">About EMPIREX</h2>
        <p className="text-center text-muted-foreground font-body text-lg mb-10 max-w-2xl mx-auto">
          Where innovation meets intellect
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="glass-card p-8 md:p-12"
      >
        <p className="text-foreground/90 font-body text-base md:text-lg leading-relaxed mb-4">
          <span className="text-primary font-semibold">EMPIREX 2026</span> is the flagship national-level technical symposium organized by the Department of B.Tech Artificial Intelligence and Data Science at RVS Technical Campus, Coimbatore.
        </p>
        <p className="text-foreground/80 font-body text-base md:text-lg leading-relaxed mb-4">
          This symposium brings together the brightest minds from across the nation to compete, collaborate, and celebrate technology. From cutting-edge technical challenges to engaging non-technical events, EMPIREX offers something for every aspiring technologist.
        </p>
        <p className="text-foreground/80 font-body text-base md:text-lg leading-relaxed">
          Join us for a day packed with innovation, creativity, and fierce competition — all under one roof.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          {[
            { value: "500+", label: "Expected Participants" },
            { value: "8+", label: "Events" },
            { value: "₹50K+", label: "Prize Pool" },
            { value: "1", label: "Epic Day" },
          ].map((stat, i) => (
            <div key={i} className="text-center p-4">
              <div className="text-2xl md:text-3xl font-bold gold-gradient-text font-display">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1 font-body">{stat.label}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  </section>
);

export default AboutSection;
