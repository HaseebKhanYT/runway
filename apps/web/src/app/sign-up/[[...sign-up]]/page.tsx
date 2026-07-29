import {SignUp} from '@clerk/nextjs';
import {AuthShell, clerkAppearance} from '../../auth_shell';

export default function SignUpPage() {
  return (
    <AuthShell tagline="One number tells you what's safe to spend, every day.">
      <SignUp appearance={clerkAppearance} />
    </AuthShell>
  );
}
