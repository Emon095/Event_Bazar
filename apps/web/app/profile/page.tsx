import { Suspense } from "react";
import { PublicProfile } from "@/components/public-profile";

export default function ProfilePage() {
  return <Suspense fallback={<main className="account-page"><div className="account-shell">Loading profile…</div></main>}><PublicProfile/></Suspense>;
}
