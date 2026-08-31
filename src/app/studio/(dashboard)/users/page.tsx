import type { Metadata } from "next";

import { EmptyState, PageHeader } from "@/components/studio/page-header";
import {
  InviteUserButton,
  UserList,
  type UserRow,
} from "@/components/studio/users/user-list";
import { Role } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Users" };

const dateFormatter = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

export default async function UsersPage() {
  const session = await auth();

  if (session?.user?.role !== Role.ADMIN) {
    return (
      <>
        <PageHeader
          title="Users"
          description="Staff accounts that can sign in to the studio."
        />
        <EmptyState
          title="Admins only"
          description="User management is restricted to admins. Ask an admin if you need a role change or a password reset."
        />
      </>
    );
  }

  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  const rows: UserRow[] = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: dateFormatter.format(user.createdAt),
  }));

  return (
    <>
      <PageHeader
        title="Users"
        description="Staff accounts that can sign in to the studio — admins manage everything, editors manage content."
        actions={<InviteUserButton />}
      />
      <UserList users={rows} currentUserId={session.user.id} />
    </>
  );
}
