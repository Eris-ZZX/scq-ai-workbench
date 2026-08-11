import { redirect } from 'next/navigation';

export default function PortalUsersRedirect() {
  redirect('/portal/platform-admin/users');
}
