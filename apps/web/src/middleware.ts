import {clerkMiddleware, createRouteMatcher} from '@clerk/nextjs/server';
import {NextResponse} from 'next/server';
import {branchAliasRedirect} from './lib/preview-alias';

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);

export default clerkMiddleware(async (auth, req) => {
  // Before anything else, including the sign-in redirect: a preview opened by
  // its deployment hostname belongs on the branch alias, which is the origin
  // the staging API answers.
  const alias = branchAliasRedirect(
    req.headers.get('host'),
    `${req.nextUrl.pathname}${req.nextUrl.search}`,
    {vercelEnv: process.env.VERCEL_ENV, branchHost: process.env.VERCEL_BRANCH_URL},
  );
  if (alias) {
    return NextResponse.redirect(alias, 307);
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
