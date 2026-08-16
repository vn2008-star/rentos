import { AppLayout } from "@/components/app-layout";
import { AuthGuard } from "@/components/auth-guard";
import { OrgGuard } from "@/components/org-guard";

/**
 * Rendered per request rather than prerendered to a file, so that clicking
 * around the sidebar is a navigation and not a page load.
 *
 * Firebase Hosting serves a prerendered route from the CDN by filename, and it
 * cannot vary a static file on a request header. The App Router asks for a
 * navigation with `RSC: 1` and expects `text/x-component` back; Hosting matched
 * `/tenants` to `tenants.html` and returned the whole document instead. Next
 * sees a response it cannot splice into the running app, gives up on the client
 * navigation and reloads the browser.
 *
 * So every sidebar click was a cold start of the entire application: the shell
 * unmounted, one and a half megabytes of JavaScript re-parsed, Firebase
 * re-initialised, the profile and organization re-read, every Firestore listener
 * rebuilt from nothing, and the guard below holding a full-screen spinner over
 * all of it. That is the loading indicator, and none of the work behind it
 * needed doing.
 *
 * Nothing in this group can be prerendered usefully anyway — every page is a
 * client component whose data arrives from Firestore in the browser, so the
 * prerendered HTML was an empty shell. Marking the group dynamic sends these
 * routes to the SSR function, which does honour the header, and the navigations
 * become what they always looked like they were.
 *
 * The public and marketing routes are deliberately left prerendered: they are
 * entered by URL rather than by in-app navigation, and the CDN is the right
 * place for them.
 */
export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <OrgGuard>
        <AppLayout>{children}</AppLayout>
      </OrgGuard>
    </AuthGuard>
  );
}
