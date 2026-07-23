export type Category = "CTF" | "Programming" | "Hackathon" | "Workshop" | "Career";

export interface EventItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: Category;
  organizer: string;
  organizerInitials: string;
  banner?: string;
  startsAt: string;
  deadline: string;
  prize: string;
  teamSize: string;
  difficulty: string;
  format: "Online" | "Offline" | "Hybrid";
  location: string;
  interested: number;
  comments: number;
  featured?: boolean;
  tags: string[];
  officialUrl?: string;
  source?: string;
}
