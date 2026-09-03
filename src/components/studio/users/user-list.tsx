"use client";

import { useMemo, useState, type FormEvent } from "react";
import { StudioTableHead } from "@/components/studio/studio-table-head";
import { StudioRow } from "@/components/studio/studio-row";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  MoreHorizontal,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import {
  createUser,
  deleteUsers,
  resetUserPassword,
  updateUserRole,
} from "@/actions/users";
import { BulkBar } from "@/components/studio/bulk-bar";
import { ConfirmDeleteDialog } from "@/components/studio/confirm-delete-dialog";
import { EmptyState } from "@/components/studio/page-header";
import {
  Pagination,
  PAGE_SIZE,
  usePagination,
} from "@/components/studio/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Role } from "@/generated/prisma/enums";
import { useSelection } from "@/hooks/use-selection";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Pre-formatted on the server (en-IN) to keep hydration deterministic. */
  createdAt: string;
};

const ROLE_BADGE: Record<Role, "default" | "secondary"> = {
  ADMIN: "default",
  EDITOR: "secondary",
};

/** Header action — owns its own invite dialog instance. */
export function InviteUserButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlus /> Invite user
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        {/* Radix unmounts content on close; keying by open resets field
            state on every open without any effect. */}
        {open && <InviteUserBody key="invite" onOpenChange={setOpen} />}
      </Dialog>
    </>
  );
}

function InviteUserBody({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(Role.EDITOR);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    const res = await createUser({
      name: name.trim(),
      email: email.trim(),
      password,
      role,
    });
    setBusy(false);
    if (res.ok) {
      toast.success("User created.");
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <DialogContent
      className="max-w-md"
      onInteractOutside={(e) => busy && e.preventDefault()}
      onEscapeKeyDown={(e) => busy && e.preventDefault()}
    >
      <DialogHeader>
        <DialogTitle>Invite user</DialogTitle>
        <DialogDescription>
          Create a staff account. Share the password with them privately —
          it is never emailed.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="invite-name">Name</Label>
          <Input
            id="invite-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Aarti Sharma"
            required
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="aarti@rivya-living-art.com"
            autoComplete="off"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="invite-password">Password</Label>
          <Input
            id="invite-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="invite-role">Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger id="invite-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={Role.EDITOR}>
                Editor — manages content
              </SelectItem>
              <SelectItem value={Role.ADMIN}>Admin — full access</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? "Creating…" : "Create user"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function ResetPasswordBody({
  user,
  onOpenChange,
}: {
  user: UserRow;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    const res = await resetUserPassword(user.id, password);
    setBusy(false);
    if (res.ok) {
      toast.success(`Password reset for ${user.name}.`);
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <DialogContent
      className="max-w-md"
      onInteractOutside={(e) => busy && e.preventDefault()}
      onEscapeKeyDown={(e) => busy && e.preventDefault()}
    >
      <DialogHeader>
        <DialogTitle>Reset password</DialogTitle>
        <DialogDescription>
          Set a new password for {user.name} ({user.email}). Their current
          password stops working immediately.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="reset-password">New password</Label>
          <Input
            id="reset-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            minLength={8}
            required
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? "Saving…" : "Reset password"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export function UserList({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const { pageRows, page, setPage, pageCount, total, pageSize } = usePagination(
    users,
    PAGE_SIZE,
  );
  // Selection is scoped to the visible page (see useSelection docs).
  const rowIds = useMemo(() => pageRows.map((u) => u.id), [pageRows]);
  const selection = useSelection(rowIds);
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [roleBusy, setRoleBusy] = useState(false);

  async function handleRoleChange(user: UserRow) {
    const nextRole = user.role === Role.ADMIN ? Role.EDITOR : Role.ADMIN;
    setRoleBusy(true);
    const res = await updateUserRole(user.id, nextRole);
    setRoleBusy(false);
    if (res.ok) {
      toast.success(
        nextRole === Role.ADMIN
          ? `${user.name} is now an admin.`
          : `${user.name} is now an editor.`,
      );
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function handleDelete() {
    const count = pendingDelete.length;
    setDeleting(true);
    const res = await deleteUsers(pendingDelete);
    setDeleting(false);
    setConfirmOpen(false);
    if (res.ok) {
      toast.success(`Deleted ${count} ${count === 1 ? "user" : "users"}.`);
      selection.clear();
      setPendingDelete([]);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  function requestDelete(ids: string[]) {
    setPendingDelete(ids);
    setConfirmOpen(true);
  }

  if (users.length === 0) {
    return (
      <EmptyState
        title="No users yet"
        description="Invite teammates so they can help manage the studio."
        action={<InviteUserButton />}
      />
    );
  }

  return (
    <>
      <div
            tabIndex={0}
            role="region"
            aria-label="Staff users"
            className="overflow-x-auto rounded-card border border-border bg-card shadow-e1 [contain:paint] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
        <table className="w-full text-sm">
          <thead>
            <StudioTableHead>
              <th scope="col" className="w-12 px-4 py-3">
                <Checkbox
                  checked={selection.allSelected}
                  onCheckedChange={selection.toggleAll}
                  aria-label="Select all"
                />
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Name
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Email
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Role
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Created
              </th>
              <th scope="col" className="w-16 px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </StudioTableHead>
          </thead>
          <tbody>
            {pageRows.map((user) => {
              const isSelf = user.id === currentUserId;
              return (
                <StudioRow
                  key={user.id}
                >
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selection.selected.has(user.id)}
                      onCheckedChange={() => selection.toggle(user.id)}
                      aria-label={`Select ${user.name}`}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    <span className="flex items-center gap-2">
                      {user.name}
                      {isSelf && <Badge variant="outline">You</Badge>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {user.email}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={ROLE_BADGE[user.role]}>
                      {user.role === Role.ADMIN ? "Admin" : "Editor"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {user.createdAt}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={`Actions for ${user.name}`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={roleBusy}
                          onSelect={() => handleRoleChange(user)}
                        >
                          {user.role === Role.ADMIN ? (
                            <>
                              <ShieldOff /> Make editor
                            </>
                          ) : (
                            <>
                              <ShieldCheck /> Make admin
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setResetting(user)}>
                          <KeyRound /> Reset password
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={isSelf}
                          onSelect={() => requestDelete([user.id])}
                        >
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </StudioRow>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={pageSize}
        onPageChange={setPage}
        unit="users"
      />

      <BulkBar count={selection.count} onClear={selection.clear}>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => requestDelete(selection.ids)}
        >
          <Trash2 /> Delete
        </Button>
      </BulkBar>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        count={pendingDelete.length}
        noun="user"
        onConfirm={handleDelete}
        busy={deleting}
        extraWarning="You cannot delete your own account or the last remaining admin."
      />

      <Dialog
        open={resetting !== null}
        onOpenChange={(o) => {
          if (!o) setResetting(null);
        }}
      >
        {/* Keyed by user so re-opening for another user starts clean. */}
        {resetting && (
          <ResetPasswordBody
            key={resetting.id}
            user={resetting}
            onOpenChange={(o) => {
              if (!o) setResetting(null);
            }}
          />
        )}
      </Dialog>
    </>
  );
}
