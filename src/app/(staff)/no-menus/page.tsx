export const dynamic = "force-dynamic";

export default function NoMenusPage() {
  return (
    <div className="mx-auto max-w-lg space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">No menus are turned on</h1>
      <p className="text-muted-foreground">
        Ask an admin to enable a menu for this login. You can log out from the sidebar.
      </p>
    </div>
  );
}
