import { redirect } from "next/navigation";

import { auth } from "~/server/auth";

export default async function LoginPage() {
  const session = await auth();
  
  // Redirect to home if already logged in
  if (session?.user) {
    redirect("/");
  }

  // Redirect to the NextAuth sign-in page
  redirect("/api/auth/signin");
}
