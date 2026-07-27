import { redirect } from 'next/navigation';
import { DEFAULT_AFTER_LOGIN } from '@/platform/auth/constants';

export default function RootPage() {
  redirect(DEFAULT_AFTER_LOGIN);
}
