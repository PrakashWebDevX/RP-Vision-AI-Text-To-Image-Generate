import { useState } from "react";
import { motion } from "framer-motion";
import { Code, Brain, Cpu, Lightbulb, Gamepad2, Mic, Palette, Users, X, Clock, MapPin, Trophy, Globe, Database } from "lucide-react";

interface EventInfo {
  icon: React.ElementType;
  title: string;
  desc: string;
  fullDesc: string;
  rules: string[];
  duration: string;
  venue: string;
  teamSize: string;
}

const technicalEvents: EventInfo[] = [
  {
    icon: Code, title: "Code Sprint",
    desc: "Competitive coding challenge testing algorithmic problem-solving skills.",
    fullDesc: "Battle it out in an intense coding competition! Solve algorithmic challenges across multiple rounds with increasing difficulty. Show off your problem-solving prowess and coding speed.",
    rules: ["Individual participation", "3 rounds of increasing difficulty", "Languages: C, C++, Java, Python", "Internet access not allowed"],
    duration: "2 Hours", venue: "Room 222", teamSize: "Individual",
  },
  {
    icon: Brain, title: "AI Quiz",
    desc: "Test your knowledge of AI, ML, and Data Science fundamentals.",
    fullDesc: "A buzzer-round quiz covering Artificial Intelligence, Machine Learning, Deep Learning, Data Science, and emerging tech trends. Prove you're the ultimate AI enthusiast!",
    rules: ["Team of 2 members", "3 rounds: Written, Rapid Fire, Buzzer", "No electronic devices", "Judges' decision is final"],
    duration: "1.5 Hours", venue: "Room 222", teamSize: "Team of 2",
  },
  {
    icon: Cpu, title: "Paper Presentation",
    desc: "Present your research on emerging technologies in AI & Data Science.",
    fullDesc: "Present innovative research papers on cutting-edge topics in AI, Data Science, IoT, Blockchain, and more. Impress the panel of judges with your knowledge and presentation skills.",
    rules: ["Team of 2-3 members", "IEEE format preferred", "8-10 minutes presentation + 5 min Q&A", "Topics: AI, ML, Data Science, IoT, Blockchain"],
    duration: "15 Minutes/Team", venue: "Room 222", teamSize: "Team of 2-3",
  },
  {
    icon: Lightbulb, title: "Hackathon",
    desc: "Build innovative solutions to real-world problems in a timed challenge.",
    fullDesc: "A high-energy hackathon where teams build working prototypes to solve real-world problems. Bring your laptops, creativity, and caffeine — it's going to be intense!",
    rules: ["Team of 3-4 members", "Bring your own laptops", "Problem statement given on spot", "Working prototype required"],
    duration: "3 Hours", venue: "Room 222", teamSize: "Team of 3-4",
  },
  {
    icon: Globe, title: "Web Design",
    desc: "Design a stunning website on a given topic within the time limit.",
    fullDesc: "Showcase your web development skills! Design and develop a responsive website on a surprise topic. Creativity, functionality, and aesthetics all count towards your score.",
    rules: ["Individual or Team of 2", "Topic given on spot", "HTML, CSS, JS frameworks allowed", "No pre-built templates"],
    duration: "2 Hours", venue: "Room 222", teamSize: "Individual / Team of 2",
  },
];

const nonTechnicalEvents: EventInfo[] = [
  {
    icon: Gamepad2, title: "Tech Treasure Hunt",
    desc: "A thrilling hunt blending tech clues with physical challenges.",
    fullDesc: "An exciting treasure hunt combining technical puzzles, QR codes, and campus exploration. Decode clues, solve riddles, and race against other teams to find the treasure!",
    rules: ["Team of 3 members", "Follow all clue sequences", "No skipping clues", "First team to finish wins"],
    duration: "1.5 Hours", venue: "Campus-wide", teamSize: "Team of 3",
  },
  {
    icon: Mic, title: "Just a Minute (JAM)",
    desc: "Speak on random topics for one minute without hesitation or repetition.",
    fullDesc: "The classic JAM session! Speak fluently on a random topic for 60 seconds without hesitation, repetition, or grammatical errors. Quick thinking and confidence are key!",
    rules: ["Individual participation", "Topic given on the spot", "No repetition or hesitation", "Judges' decision is final"],
    duration: "1 Hour", venue: "Room 222", teamSize: "Individual",
  },
  {
    icon: Palette, title: "Meme Wars",
    desc: "Create the most hilarious and relatable tech memes to win.",
    fullDesc: "Unleash your inner meme lord! Create the funniest, most creative tech memes on given templates. The audience and judges vote for the best. May the dankest meme win!",
    rules: ["Individual participation", "Templates provided on spot", "No offensive content", "Audience voting + Judge scoring"],
    duration: "45 Minutes", venue: "Room 222", teamSize: "Individual",
  },
  {
    icon: Users, title: "Connections",
    desc: "A team-based puzzle game testing communication and strategy.",
    fullDesc: "A fun team puzzle game inspired by NYT Connections! Group 16 items into 4 categories using logic, communication, and teamwork. Strategize with your partner to crack the code!",
    rules: ["Team of 2 members", "Multiple rounds", "Limited attempts per round", "Time-based scoring"],
    duration: "1 Hour", venue: "Room 222", teamSize: "Team of 2",
  },
  {
    icon: Database, title: "Data Detective",
    desc: "Analyze datasets and solve mysteries hidden within the data.",
    fullDesc: "Put on your detective hat and dive into real-world datasets! Find patterns, anomalies, and insights to solve the mystery. Data analysis meets storytelling in this unique event.",
    rules: ["Team of 2 members", "Dataset provided on spot", "Tools: Excel, Python, or any analysis tool", "Present findings in 5 minutes"],
    duration: "1.5 Hours", venue: "Room 222", teamSize: "Team of 2",
  },
];

const GOOGLE_FORM_URL = "https://forms.google.com/your-form-link-here";

interface EventCardProps {
  event: EventInfo;
  index: number;
  onClick: () => void;
}

const EventCard = ({ event, index, onClick }: EventCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay: index * 0.1 }}
    className="glass-card-hover p-6 group cursor-pointer"
    onClick={onClick}
  >
    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
      <event.icon className="w-6 h-6 text-primary" />
    </div>
    <h3 className="font-display text-lg font-bold text-foreground mb-2">{event.title}</h3>
    <p className="text-muted-foreground text-sm font-body mb-3">{event.desc}</p>
    <span className="text-primary text-xs font-display font-semibold tracking-wider uppercase">Tap to view details →</span>
  </motion.div>
);

interface EventDialogProps {
  event: EventInfo | null;
  onClose: () => void;
}

const EventDialog = ({ event, onClose }: EventDialogProps) => {
  if (!event) return null;
  const Icon = event.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative glass-card p-6 md:p-8 max-w-lg w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-xl font-bold text-foreground">{event.title}</h3>
            <p className="text-primary text-sm font-display font-semibold">{event.teamSize}</p>
          </div>
        </div>

        <p className="text-muted-foreground font-body text-sm leading-relaxed mb-5">{event.fullDesc}</p>

        <div className="flex flex-wrap gap-3 mb-5">
          <div className="flex items-center gap-1.5 text-xs font-body text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full">
            <Clock className="w-3.5 h-3.5 text-primary" /> {event.duration}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-body text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full">
            <MapPin className="w-3.5 h-3.5 text-primary" /> {event.venue}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-body text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full">
            <Trophy className="w-3.5 h-3.5 text-primary" /> Prizes + Certificates
          </div>
        </div>

        <div className="mb-6">
          <h4 className="font-display text-sm font-bold text-foreground mb-2 uppercase tracking-wider">Rules</h4>
          <ul className="space-y-1.5">
            {event.rules.map((rule, i) => (
              <li key={i} className="text-muted-foreground text-sm font-body flex items-start gap-2">
                <span className="text-primary mt-1">•</span> {rule}
              </li>
            ))}
          </ul>
        </div>

        <a
          href={GOOGLE_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-3 bg-primary text-primary-foreground font-display font-bold text-sm rounded-lg hover:opacity-90 transition-opacity text-center"
        >
          Register for {event.title} — ₹150
        </a>
      </motion.div>
    </motion.div>
  );
};

const EventsSection = () => {
  const [selectedEvent, setSelectedEvent] = useState<EventInfo | null>(null);

  return (
    <>
      <section id="events" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <h2 className="section-heading">Technical Events</h2>
            <p className="text-center text-muted-foreground font-body text-lg mb-12">Push your technical limits</p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {technicalEvents.map((e, i) => <EventCard key={e.title} event={e} index={i} onClick={() => setSelectedEvent(e)} />)}
          </div>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <h2 className="section-heading">Non-Technical Events</h2>
            <p className="text-center text-muted-foreground font-body text-lg mb-12">Fun, creativity, and teamwork</p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {nonTechnicalEvents.map((e, i) => <EventCard key={e.title} event={e} index={i} onClick={() => setSelectedEvent(e)} />)}
          </div>
        </div>
      </section>

      {selectedEvent && <EventDialog event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    </>
  );
};

export default EventsSection;
