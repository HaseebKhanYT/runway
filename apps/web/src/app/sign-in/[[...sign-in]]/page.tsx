import {SignIn} from '@clerk/nextjs';
import {AuthShell, clerkAppearance} from '../../auth-shell';

export default function SignInPage() {
  return (
    <AuthShell tagline="Welcome back — let's check your runway.">
      <SignIn appearance={clerkAppearance} />
    </AuthShell>
  );
}
