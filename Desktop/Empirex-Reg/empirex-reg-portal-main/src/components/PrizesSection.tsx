import { motion } from "framer-motion";
import { Trophy, Award, Medal } from "lucide-react";

const PrizesSection = () => (
  <section id="prizes" className="py-20 px-4">
    <div className="container mx-auto max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
        <h2 className="section-heading">Prizes & Rewards</h2>
        <p className="text-center text-muted-foreground font-body text-lg mb-12">Compete. Win. Celebrate.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: Trophy, title: "Winners", desc: "Exciting cash prizes and trophies for event winners.", color: "text-primary" },
          { icon: Medal, title: "Runners Up", desc: "Medals and goodies for the runners-up in every event.", color: "text-primary/80" },
          { icon: Award, title: "All Participants", desc: "Certificate of participation for every registered attendee.", color: "text-primary/60" },
        ].map((item, i) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.15 }}
            className="glass-card-hover p-8 text-center"
          >
            <item.icon className={`w-12 h-12 mx-auto mb-4 ${item.color}`} />
            <h3 className="font-display text-xl font-bold text-foreground mb-2">{item.title}</h3>
            <p className="text-muted-foreground text-sm font-body">{item.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default PrizesSection;
