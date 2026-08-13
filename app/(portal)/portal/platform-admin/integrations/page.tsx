import { redirect } from 'next/navigation';

export default async function PlatformIntegrationsRoute() {
  redirect('/portal/platform-admin/apps?app=sqm-drawing-reliability');
}
