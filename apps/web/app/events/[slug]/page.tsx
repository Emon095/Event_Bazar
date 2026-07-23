import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, ExternalLink, MapPin, ShieldCheck, Trophy, UsersRound } from "lucide-react";
import { events } from "@/lib/data";
import { DetailActions } from "@/components/detail-actions";
import { Logo } from "@/components/logo";
import { EventDiscussion } from "@/components/event-discussion";

export function generateStaticParams() { return events.map(event => ({ slug: event.slug })); }

export default async function EventDetails({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = events.find(item => item.slug === slug);
  if (!event) notFound();
  const starts = new Date(event.startsAt);
  return <main className="details-page">
    <nav className="detail-nav"><Link href="/"><Logo /></Link><Link href="/" className="back-link"><ArrowLeft /> Back to discover</Link></nav>
    <div className="detail-wrap">
      <div className={`detail-hero category-${event.category.toLowerCase()} ${event.banner ? "" : "without-image"}`}>{event.banner && <Image src={event.banner} alt={`${event.title} event banner`} fill priority sizes="1200px"/>}<div className="detail-hero-shade"/><div className="detail-title"><span>{event.category} · {event.format}</span><h1>{event.title}</h1><p>Hosted by <b>{event.organizer}</b></p></div></div>
      <div className="detail-layout">
        <article className="detail-content">
          <section><h2>About this event</h2><p>{event.description} Join builders and problem solvers from around the world for an experience designed around learning, collaboration, and ambitious ideas.</p><p>Expect carefully designed challenges, a welcoming community, and live support throughout the event. Whether you are joining to compete, learn, or meet your next teammate, you will find a place here.</p><div className="detail-tags">{event.tags.map(tag => <span key={tag}>#{tag.replaceAll(" ", "")}</span>)}</div></section>
          <section><h2>Rules & eligibility</h2><ul className="rules"><li><CheckCircle2/>Registration must be completed before the published deadline.</li><li><CheckCircle2/>Teams may include {event.teamSize} participants.</li><li><CheckCircle2/>Be respectful, collaborate fairly, and follow the organizer code of conduct.</li><li><CheckCircle2/>Participants from all backgrounds are welcome unless otherwise noted.</li></ul></section>
          <section><h2>Event timeline</h2><div className="timeline"><div><i/><span><b>Registration closes</b><small>{new Date(event.deadline).toLocaleString()}</small></span></div><div><i/><span><b>Opening ceremony</b><small>{starts.toLocaleString()}</small></span></div><div><i/><span><b>Results & closing</b><small>Announced by the organizer</small></span></div></div></section>
          <EventDiscussion eventKey={event.id}/>
        </article>
        <aside className="detail-aside">
          <div className="registration-card"><DetailActions/><div className="detail-facts"><div><CalendarDays/><span><small>DATE</small><b>{starts.toLocaleDateString(undefined,{month:"long",day:"numeric",year:"numeric"})}</b></span></div><div><Clock3/><span><small>TIME</small><b>{starts.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})} BST</b></span></div><div><MapPin/><span><small>LOCATION</small><b>{event.location}</b></span></div><div><UsersRound/><span><small>TEAM SIZE</small><b>{event.teamSize}</b></span></div><div><Trophy/><span><small>PRIZE</small><b>{event.prize}</b></span></div><div><ShieldCheck/><span><small>DIFFICULTY</small><b>{event.difficulty}</b></span></div></div><button className="register-button">Register now <ExternalLink/></button><button className="official-button">Visit official website</button></div>
          <div className="organizer-card"><div className="avatar violet">{event.organizerInitials}</div><div><small>ORGANIZED BY</small><b>{event.organizer}</b><span>Verified organizer</span></div><button>Follow</button></div>
        </aside>
      </div>
    </div>
  </main>;
}
