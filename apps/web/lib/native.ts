import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { EventItem } from "@/lib/types";
import { SITE_URL } from "@/lib/site";

export const MOBILE_AUTH_CALLBACK = `${SITE_URL}/auth/mobile-callback/`;

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

function notificationId(value: string) {
  let hash = 0;
  for (const character of value) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return Math.abs(hash || 1) % 2_000_000_000;
}

async function allowNotifications() {
  if (!isNativeApp()) return false;
  let status = await LocalNotifications.checkPermissions();
  if (status.display === "prompt") status = await LocalNotifications.requestPermissions();
  return status.display === "granted";
}

export async function scheduleEventReminder(event: EventItem) {
  if (!(await allowNotifications())) return;
  const starts = new Date(event.startsAt);
  if (starts.getTime() <= Date.now()) return;
  await LocalNotifications.schedule({
    notifications: [{
      id: notificationId(`start:${event.id}`),
      title: `${event.title} is starting`,
      body: `${event.organizer} · ${event.format}`,
      schedule: { at: starts, allowWhileIdle: true },
      extra: { eventId: event.id, slug: event.slug },
    }],
  });
}

export async function cancelEventReminder(event: EventItem) {
  if (!isNativeApp()) return;
  await LocalNotifications.cancel({ notifications: [{ id: notificationId(`start:${event.id}`) }] });
}

export async function notifyNewEvents(events: EventItem[]) {
  if (!isNativeApp() || !events.length) return;
  const key = "event-bazar-known-events-v1";
  const current = events.map(event => event.id);
  const previous = JSON.parse(localStorage.getItem(key) || "[]") as string[];
  localStorage.setItem(key, JSON.stringify(current));
  if (!previous.length) return;
  const known = new Set(previous);
  const added = events.filter(event => !known.has(event.id));
  if (!added.length || !(await allowNotifications())) return;
  await LocalNotifications.schedule({
    notifications: [{
      id: notificationId(`new:${Date.now()}`),
      title: added.length === 1 ? "New event added" : `${added.length} new events added`,
      body: added.length === 1 ? added[0].title : `${added[0].title} and more are now available.`,
      schedule: { at: new Date(Date.now() + 1000) },
    }],
  });
}
