import type { EventItem } from "./types";

export const events: EventItem[] = [
  {
    id: "1", slug: "cipherstorm-ctf-2026", title: "CipherStorm CTF 2026",
    description: "A 24-hour global cybersecurity showdown. Solve web, crypto, pwn and forensics challenges with your team.",
    category: "CTF", organizer: "ByteShield Security", organizerInitials: "BS",
    banner: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1400&q=85",
    startsAt: "2026-08-08T20:00:00+06:00", deadline: "2026-08-07T23:59:00+06:00", prize: "$12,000", teamSize: "1–4", difficulty: "All levels", format: "Online", location: "Worldwide", interested: 0, comments: 0, featured: true, tags: ["Jeopardy", "Beginner friendly", "Global"]
  },
  {
    id: "2", slug: "icpc-dhaka-regional", title: "ICPC Dhaka Regional Warmup",
    description: "Sharpen your algorithms and compete with the brightest university teams across Bangladesh.",
    category: "Programming", organizer: "ICPC Bangladesh", organizerInitials: "IC",
    banner: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1400&q=85",
    startsAt: "2026-08-15T09:00:00+06:00", deadline: "2026-08-10T23:59:00+06:00", prize: "৳300K", teamSize: "3", difficulty: "Advanced", format: "Offline", location: "Dhaka, Bangladesh", interested: 0, comments: 0, tags: ["Algorithms", "University", "Bangladesh"]
  },
  {
    id: "3", slug: "build-for-bengal", title: "Build for Bengal Hackathon",
    description: "Turn bold ideas into real products for climate, mobility and public services. Mentors and cloud credits included.",
    category: "Hackathon", organizer: "Startup Bangladesh", organizerInitials: "SB",
    banner: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1400&q=85",
    startsAt: "2026-09-04T18:00:00+06:00", deadline: "2026-08-24T23:59:00+06:00", prize: "৳1M", teamSize: "2–5", difficulty: "Intermediate", format: "Hybrid", location: "Dhaka + Online", interested: 0, comments: 0, featured: true, tags: ["Climate", "Civic tech", "Mentorship"]
  },
  {
    id: "4", slug: "agentic-ai-workshop", title: "Agentic AI: From Prompt to Product",
    description: "A hands-on workshop for building dependable agent workflows with evaluation, tools and human oversight.",
    category: "Workshop", organizer: "AI Builders BD", organizerInitials: "AI",
    banner: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1400&q=85",
    startsAt: "2026-08-02T16:00:00+06:00", deadline: "2026-08-01T20:00:00+06:00", prize: "Free", teamSize: "Solo", difficulty: "Beginner", format: "Online", location: "Google Meet", interested: 0, comments: 0, tags: ["AI", "Hands-on", "Free"]
  },
  {
    id: "5", slug: "codeforces-round-1102", title: "Codeforces Round 1102 (Div. 2)",
    description: "A rated programming contest featuring six original algorithmic problems for Division 2 participants.",
    category: "Programming", organizer: "Codeforces", organizerInitials: "CF",
    banner: "https://images.unsplash.com/photo-1516116216624-53e697fedbea?auto=format&fit=crop&w=1400&q=85",
    startsAt: "2026-08-01T20:35:00+06:00", deadline: "2026-08-01T20:30:00+06:00", prize: "Rating", teamSize: "Solo", difficulty: "Intermediate", format: "Online", location: "Worldwide", interested: 0, comments: 0, tags: ["Rated", "Algorithms", "Div. 2"]
  },
  {
    id: "6", slug: "tech-career-fair-2026", title: "Bangladesh Tech Career Fair",
    description: "Meet engineering teams from 50+ companies, get your portfolio reviewed and discover your next role.",
    category: "Career", organizer: "TechConnect BD", organizerInitials: "TC",
    banner: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1400&q=85",
    startsAt: "2026-09-12T10:00:00+06:00", deadline: "2026-09-10T23:59:00+06:00", prize: "Free", teamSize: "Solo", difficulty: "All levels", format: "Offline", location: "BICC, Dhaka", interested: 0, comments: 0, tags: ["Career", "Networking", "Dhaka"]
  }
];

export const categoryStyle: Record<string, { icon: string; color: string }> = {
  CTF: { icon: "⌁", color: "red" }, Programming: { icon: "</>", color: "blue" },
  Hackathon: { icon: "⚡", color: "orange" }, Workshop: { icon: "✦", color: "green" }, Career: { icon: "◈", color: "pink" },
};
