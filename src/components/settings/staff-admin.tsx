"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createStaffAction, removeStaffAction, updateStaffRoleAction } from "@/actions/staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import { STAFF_ROLE_LABELS, STAFF_ROLES, type StaffRole } from "@/lib/constants";
import type { StaffMember } from "@/lib/queries/staff";

function randomPassword() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => (byte % 36).toString(36)).join("").slice(0, 12);
}

export function RolePermissionGuide() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Roles</h2>
        <p className="text-sm text-muted-foreground">
          Access is venue-scoped. Nobody can grant themselves a higher role. Viewers stay read-only.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {STAFF_ROLES.map((role) => (
          <div key={role} className="rounded-xl border bg-card p-4">
            <p className="font-semibold">{STAFF_ROLE_LABELS[role]}</p>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              {ROLE_PERMISSIONS[role].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export function StaffDirectory({
  members,
  currentUserId,
  canManage,
  serviceRoleConfigured,
}: {
  members: StaffMember[];
  currentUserId: string;
  canManage: boolean;
  serviceRoleConfigured: boolean;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Staff</h2>
        <p className="text-sm text-muted-foreground">
          {canManage
            ? "Create logins here. The first admin still has to be bootstrapped in Supabase."
            : "Only admins can add people or change roles."}
        </p>
      </div>
      {canManage ? <CreateStaffForm serviceRoleConfigured={serviceRoleConfigured} /> : null}
      {members.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-6 text-sm text-muted-foreground">No staff records yet.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {members.map((member) => (
            <StaffRow key={member.userId} member={member} currentUserId={currentUserId} canManage={canManage} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CreateStaffForm({ serviceRoleConfigured }: { serviceRoleConfigured: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<StaffRole>("viewer");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  if (!serviceRoleConfigured) {
    return (
      <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Add <code>SUPABASE_SERVICE_ROLE_KEY</code> to the server environment to create logins from this screen. Role
        changes still work without it.
      </p>
    );
  }

  return (
    <form
      className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        setFieldErrors({});
        startTransition(async () => {
          const result = await createStaffAction({ email, displayName, role, password });
          if (!result.ok) {
            setFieldErrors(result.fieldErrors ?? {});
            toast.error(result.message);
            return;
          }
          toast.success(result.message);
          setEmail("");
          setDisplayName("");
          setPassword("");
          setRole("viewer");
          router.refresh();
        });
      }}
    >
      <Field error={fieldErrors.displayName?.[0]}>
        <Label htmlFor="staff-name">Display name</Label>
        <Input id="staff-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      </Field>
      <Field error={fieldErrors.email?.[0]}>
        <Label htmlFor="staff-email">Email</Label>
        <Input id="staff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field error={fieldErrors.role?.[0]}>
        <Label htmlFor="staff-role">Role</Label>
        <select
          id="staff-role"
          className="h-11 min-h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value as StaffRole)}
        >
          {STAFF_ROLES.map((value) => (
            <option key={value} value={value}>
              {STAFF_ROLE_LABELS[value]}
            </option>
          ))}
        </select>
      </Field>
      <Field error={fieldErrors.password?.[0]}>
        <Label htmlFor="staff-password">Temporary password</Label>
        <div className="flex gap-2">
          <Input
            id="staff-password"
            type="text"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="button" variant="outline" onClick={() => setPassword(randomPassword())}>
            Generate
          </Button>
        </div>
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create staff login"}
        </Button>
      </div>
    </form>
  );
}

function StaffRow({
  member,
  currentUserId,
  canManage,
}: {
  member: StaffMember;
  currentUserId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState<StaffRole>(member.role);
  const isSelf = member.userId === currentUserId;
  const dirty = role !== member.role;
  const roleOptions = useMemo(() => STAFF_ROLES, []);

  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">
          {member.displayName}
          {isSelf ? <span className="ml-2 text-xs text-muted-foreground">You</span> : null}
        </p>
        <p className="text-sm text-muted-foreground">{member.email || "No email on file"}</p>
      </div>
      {canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-11 min-h-11 rounded-lg border border-input bg-transparent px-3 text-sm"
            value={role}
            disabled={isSelf || pending}
            aria-label={`Role for ${member.displayName}`}
            onChange={(e) => setRole(e.target.value as StaffRole)}
          >
            {roleOptions.map((value) => (
              <option key={value} value={value}>
                {STAFF_ROLE_LABELS[value]}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            disabled={isSelf || pending || !dirty}
            onClick={() => {
              startTransition(async () => {
                const result = await updateStaffRoleAction({ userId: member.userId, role });
                if (!result.ok) {
                  toast.error(result.message);
                  setRole(member.role);
                  return;
                }
                toast.success(result.message);
                router.refresh();
              });
            }}
          >
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isSelf || pending}
            onClick={() => {
              startTransition(async () => {
                const result = await removeStaffAction({ userId: member.userId });
                if (!result.ok) toast.error(result.message);
                else {
                  toast.success(result.message);
                  router.refresh();
                }
              });
            }}
          >
            Remove
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{STAFF_ROLE_LABELS[member.role]}</p>
      )}
    </li>
  );
}

function Field({ children, error }: { children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-2">
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
