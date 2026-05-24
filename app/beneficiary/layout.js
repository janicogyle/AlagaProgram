import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import BeneficiaryShell from './BeneficiaryShell';
import {
  BENEFICIARY_SESSION_COOKIE,
  readBeneficiarySessionToken,
} from '@/lib/beneficiarySession.server';

export default async function BeneficiaryLayout({ children }) {
  const cookieStore = await cookies();
  const session = readBeneficiarySessionToken(cookieStore.get(BENEFICIARY_SESSION_COOKIE)?.value);

  if (!session.ok) {
    redirect('/login');
  }

  return <BeneficiaryShell>{children}</BeneficiaryShell>;
}
