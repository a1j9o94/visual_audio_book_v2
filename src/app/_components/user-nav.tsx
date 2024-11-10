'use client';

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { type User } from "next-auth";
import Link from "next/link";

interface UserNavProps {
  user: User;
}

export function UserNav({ user }: UserNavProps) {
  const initials = user.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase() ?? '?';

  return (
    <div className="flex items-center gap-4">
      <Link href="/settings" className="text-sm font-medium">
        Settings
      </Link>
      <Link href="/api/auth/signout" className="text-sm font-medium">
        Sign out
      </Link>
      <Avatar className="h-8 w-8">
        <AvatarImage src={user.image ?? undefined} alt={user.name ?? ''} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
    </div>
  );
} 