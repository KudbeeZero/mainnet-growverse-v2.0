import { redirect } from "next/navigation";

// The command center is no longer a per-plant nested page — it IS the dashboard.
// You log in, you see your pod, and you run everything from the one view (a
// carousel of up to four plants + every rail and the care/time controls). This
// route is kept only so old links/bookmarks land on the real thing.
export default function CommandRedirect() {
  redirect("/dashboard");
}
