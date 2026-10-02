"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  clearComputerControlUserAction,
  createComputerControlUserAction,
  createStaffAction,
  removeStaffAction,
  updateStaffRoleAction,
} from "@/actions/staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_PERMISSIONS, isMasterAdminEmail } from "@/lib/auth/permissions";
import {
  STAFF_MENUS,
  STAFF_MENU_IDS,
  STAFF_MENUS_SQL,
  defaultMenusForRole,
  sameMenus,
  type StaffMenuId,
} from "@/lib/auth/menus";
import { WALL_OPS_LOGIN_PATH, WALL_OPS_SQL } from "@/lib/auth/wall-ops";
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
  menusReady = true,
  wallOpsUserId = null,
  wallOpsReady = true,
}: {
  members: StaffMember[];
  currentUserId: string;
  canManage: boolean;
  serviceRoleConfigured: boolean;
  menusReady?: boolean;
  wallOpsUserId?: string | null;
  wallOpsReady?: boolean;
}) {
  const wallOpsMember = members.find((member) => member.userId === wallOpsUserId) ?? null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Staff</h2>
        <p className="text-sm text-muted-foreground">
          {canManage
            ? "Create a login, then turn menus on or off for that person. The role still controls what they can change."
            : "Only admins can add people or change roles and menus."}
        </p>
      </div>
      {canManage && !menusReady ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Apply <code>{STAFF_MENUS_SQL}</code> before menu choices can be saved. Until then, each person keeps the
          menus for their role.
        </p>
      ) : null}
      {canManage ? (
        <ComputerControlCard
          member={wallOpsMember}
          serviceRoleConfigured={serviceRoleConfigured}
          wallOpsReady={wallOpsReady}
        />
      ) : null}
      {canManage ? <CreateStaffForm serviceRoleConfigured={serviceRoleConfigured} /> : null}
      {members.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-6 text-sm text-muted-foreground">No staff records yet.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {members.map((member) => (
            <StaffRow
              key={member.userId}
              member={member}
              currentUserId={currentUserId}
              canManage={canManage}
              wallOpsUserId={wallOpsUserId}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ComputerControlCard({
  member,
  serviceRoleConfigured,
  wallOpsReady,
}: {
  member: StaffMember | null;
  serviceRoleConfigured: boolean;
  wallOpsReady: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("Venue computer");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  if (!wallOpsReady) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Apply <code>{WALL_OPS_SQL}</code> before you can save a computer control login from Settings.
      </div>
    );
  }

  if (!serviceRoleConfigured) {
    return (
      <div className="space-y-2 rounded-xl border bg-card p-4">
        <h3 className="font-semibold">Computer control</h3>
        <p className="text-sm text-muted-foreground">
          Add <code>SUPABASE_SERVICE_ROLE_KEY</code> on the server to create the Wall & Screens login used on venue
          computers.
        </p>
      </div>
    );
  }

  if (member) {
    return (
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <div>
          <h3 className="font-semibold">Computer control</h3>
          <p className="text-sm text-muted-foreground">
            This login only opens Wall & Screens. On the venue computer, open{" "}
            <code className="text-foreground">{WALL_OPS_LOGIN_PATH}</code>, sign in, then install it from Chrome as an
            app.
          </p>
        </div>
        <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <p className="font-medium">{member.displayName}</p>
          <p className="text-muted-foreground">{member.email || "No email on file"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <a href={WALL_OPS_LOGIN_PATH} target="_blank" rel="noreferrer">
              Open /wall
            </a>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await clearComputerControlUserAction();
                if (!result.ok) toast.error(result.message);
                else {
                  toast.success(result.message);
                  router.refresh();
                }
              });
            }}
          >
            Clear designation
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        setFieldErrors({});
        startTransition(async () => {
          const result = await createComputerControlUserAction({ email, displayName, password });
          if (!result.ok) {
            setFieldErrors(result.fieldErrors ?? {});
            toast.error(result.message);
            return;
          }
          toast.success(result.message);
          setEmail("");
          setPassword("");
          setDisplayName("Venue computer");
          router.refresh();
        });
      }}
    >
      <div className="sm:col-span-2 space-y-1">
        <h3 className="font-semibold">Computer control</h3>
        <p className="text-sm text-muted-foreground">
          Add the login for the accessible venue computer. It only gets LED wall and screens controls — no sidebar.
        </p>
      </div>
      <Field error={fieldErrors.displayName?.[0]}>
        <Label htmlFor="wall-ops-name">Display name</Label>
        <Input
          id="wall-ops-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
      </Field>
      <Field error={fieldErrors.email?.[0]}>
        <Label htmlFor="wall-ops-email">Email</Label>
        <Input
          id="wall-ops-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </Field>
      <Field error={fieldErrors.password?.[0]}>
        <Label htmlFor="wall-ops-password">Password</Label>
        <div className="flex gap-2">
          <Input
            id="wall-ops-password"
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
      <div className="flex items-end">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Saving…" : "Add computer control user"}
        </Button>
      </div>
    </form>
  );
}

function CreateStaffForm({ serviceRoleConfigured }: { serviceRoleConfigured: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<StaffRole>("viewer");
  const [password, setPassword] = useState("");
  const [menus, setMenus] = useState<StaffMenuId[]>(defaultMenusForRole("viewer"));
  const [menusTouched, setMenusTouched] = useState(false);
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
          const result = await createStaffAction({ email, displayName, role, password, menus });
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
          setMenus(defaultMenusForRole("viewer"));
          setMenusTouched(false);
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
            onChange={(e) => {
              const next = e.target.value as StaffRole;
              setRole(next);
              if (!menusTouched || next === "interactor") setMenus(defaultMenusForRole(next));
            }}
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
        {role === "interactor" ? (
          <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            Audience Interactors only get the Audience console — no sidebar, dashboard, or settings.
          </p>
        ) : (
          <>
            <MenuToggles
              idPrefix="new-staff"
              menus={menus}
              onChange={(next) => {
                setMenusTouched(true);
                setMenus(next);
              }}
            />
            {fieldErrors.menus?.[0] ? <p className="mt-2 text-sm text-destructive">{fieldErrors.menus[0]}</p> : null}
            <p className="mt-2 text-xs text-muted-foreground">
              Checked menus show in the sidebar. Changing the role fills the usual menus until you edit a checkbox.
            </p>
          </>
        )}
      </div>
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
  wallOpsUserId,
}: {
  member: StaffMember;
  currentUserId: string;
  canManage: boolean;
  wallOpsUserId?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState<StaffRole>(member.role);
  const [menus, setMenus] = useState<StaffMenuId[]>(member.menus);
  const isSelf = member.userId === currentUserId;
  const isMaster = isMasterAdminEmail(member.email);
  const isWallOps = Boolean(wallOpsUserId && member.userId === wallOpsUserId);
  const locked = isSelf || isMaster;
  const menusLocked = locked || isWallOps;
  const dirty = role !== member.role || (!isWallOps && !sameMenus(menus, member.menus));
  const roleOptions = useMemo(() => STAFF_ROLES, []);

  return (
    <li className="flex flex-col gap-3 px-4 py-4">
      <div>
        <p className="font-medium">
          {member.displayName}
          {isSelf ? <span className="ml-2 text-xs text-muted-foreground">You</span> : null}
          {isMaster ? <span className="ml-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Master admin</span> : null}
          {isWallOps ? (
            <span className="ml-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Computer control
            </span>
          ) : null}
        </p>
        <p className="text-sm text-muted-foreground">{member.email || "No email on file"}</p>
        {canManage ? (
          <div className="mt-3">
            {role === "interactor" ? (
              <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Audience Interactors only see the Audience console (no sidebar or settings).
              </p>
            ) : isWallOps ? (
              <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Computer control login — LED wall and venue screens only (no sidebar). Sign in from{" "}
                {WALL_OPS_LOGIN_PATH} on the local computer.
              </p>
            ) : (
              <MenuToggles
                idPrefix={member.userId}
                menus={menusLocked ? member.menus : menus}
                disabled={menusLocked || pending}
                onChange={menusLocked ? undefined : setMenus}
              />
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {member.menus.map((id) => STAFF_MENUS.find((item) => item.id === id)?.label ?? id).join(", ")}
          </p>
        )}
      </div>
      {canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-11 min-h-11 rounded-lg border border-input bg-transparent px-3 text-sm"
            value={role}
            disabled={locked || pending}
            aria-label={`Role for ${member.displayName}`}
            onChange={(e) => {
              const next = e.target.value as StaffRole;
              setRole(next);
              setMenus(defaultMenusForRole(next));
            }}
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
            disabled={locked || pending || !dirty}
            onClick={() => {
              startTransition(async () => {
                const result = await updateStaffRoleAction({ userId: member.userId, role, menus });
                if (!result.ok) {
                  toast.error(result.message);
                  setRole(member.role);
                  setMenus(member.menus);
                  return;
                }
                toast.success(result.message);
                router.refresh();
              });
            }}
          >
            Save access
          </Button>
          {isMaster ? (
            <p className="text-xs text-muted-foreground">This login cannot be removed or demoted.</p>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={locked || pending}
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
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{STAFF_ROLE_LABELS[member.role]}</p>
      )}
    </li>
  );
}

function MenuToggles({
  menus,
  onChange,
  disabled,
  idPrefix,
}: {
  menus: StaffMenuId[];
  onChange?: (menus: StaffMenuId[]) => void;
  disabled?: boolean;
  idPrefix: string;
}) {
  const selected = new Set(menus);
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Menus</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {STAFF_MENUS.map((item) => {
          const checked = selected.has(item.id);
          return (
            <label
              key={item.id}
              htmlFor={`${idPrefix}-${item.id}`}
              className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm"
            >
              <input
                id={`${idPrefix}-${item.id}`}
                type="checkbox"
                className="size-4"
                checked={checked}
                disabled={disabled || !onChange}
                onChange={(event) => {
                  if (!onChange) return;
                  const next = event.target.checked
                    ? STAFF_MENU_IDS.filter((id) => selected.has(id) || id === item.id)
                    : STAFF_MENU_IDS.filter((id) => selected.has(id) && id !== item.id);
                  onChange(next);
                }}
              />
              {item.label}
            </label>
          );
        })}
      </div>
    </fieldset>
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
