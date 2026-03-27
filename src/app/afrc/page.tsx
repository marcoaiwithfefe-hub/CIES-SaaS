import { redirect } from 'next/navigation';

/**
 * Legacy route — tools now live on the single-page workspace at /.
 * Redirect any bookmarks or stale browser tabs.
 */
export default function AfrcRedirect() {
  redirect('/');
}
