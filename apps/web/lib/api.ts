import type { Category, EventItem } from "./types";
import { createClient } from "@/utils/supabase/client";
import { publicPath } from "@/lib/site";

interface LiveEvent {
  id: string; source: string; title: string; starts_at: string; registration_deadline: string;
  category: Category; organizer: string; official_url: string; location: string;
  format: "Online" | "Offline" | "Hybrid"; prize: string; team_size: string;
  difficulty: string; description: string; banner_url: string | null; tags: string[];
}

export interface SourceStatus { ok: boolean; count: number; error: string | null }
export interface UpcomingResponse { events: LiveEvent[]; status: Record<string, SourceStatus>; cached: boolean; updated_at: string }
interface CommunityEvent {
  id: string; slug: string; title: string; short_description: string; starts_at: string;
  registration_deadline: string; registration_url: string | null; website_url: string | null;
  banner_url: string | null; prize: string; team_size: string; difficulty: string;
  format: "Online" | "Offline" | "Hybrid"; location: string; is_featured: boolean;
  source: string; organizer_name: string; categories: { name: Category } | { name: Category }[];
}

function hash(value: string) { return [...value].reduce((sum, character) => sum + character.charCodeAt(0), 0); }

export async function fetchUpcoming(): Promise<{ events: EventItem[]; status: Record<string, SourceStatus> }> {
  const staticFeeds = process.env.NEXT_PUBLIC_STATIC_FEEDS === "true";
  const base = process.env.NEXT_PUBLIC_API_URL ?? "https://emon095.github.io/Event_Bazar/api/v1";
  const endpoint = staticFeeds ? publicPath("/data/upcoming.json") : `${base}/sources/upcoming`;
  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Event API returned ${response.status}`);
  const payload = await response.json() as UpcomingResponse;
  return {
    status: payload.status,
    events: payload.events.map(event => ({
      id: event.id, slug: event.id, title: event.title,
      description: event.description.slice(0, 260), category: event.category,
      organizer: event.organizer, organizerInitials: event.organizer.split(/\s+/).map(word => word[0]).join("").slice(0, 2).toUpperCase(),
      banner: event.banner_url?.trim() || undefined, startsAt: event.starts_at,
      deadline: event.registration_deadline, prize: event.prize.slice(0, 40),
      teamSize: event.team_size, difficulty: event.difficulty, format: event.format,
      location: event.location, interested: 40 + hash(event.id) % 2400,
      comments: hash(event.title) % 90, tags: event.tags,
      officialUrl: event.official_url, source: event.source,
    })),
  };
}

export async function fetchCommunityEvents(): Promise<EventItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("events").select("*, categories(name)").eq("status","published").order("is_featured",{ascending:false}).order("starts_at").limit(50);
  if (error) throw error;
  return (data as CommunityEvent[]).map(event => {
    const category = Array.isArray(event.categories) ? event.categories[0] : event.categories;
    return ({
    id: event.id, slug: event.slug, title: event.title, description: event.short_description,
    category: category.name, organizer: event.organizer_name,
    organizerInitials: event.organizer_name.split(/\s+/).map(word => word[0]).join("").slice(0, 2).toUpperCase(),
    banner: event.banner_url?.trim() || undefined, startsAt: event.starts_at,
    deadline: event.registration_deadline, prize: event.prize, teamSize: event.team_size,
    difficulty: event.difficulty, format: event.format, location: event.location,
    interested: hash(event.id) % 80, comments: 0, featured: event.is_featured,
    tags: [category.name, event.format, "Community"], source: event.source,
    officialUrl: event.registration_url || event.website_url || undefined,
  })});
}
