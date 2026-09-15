import { loadSocialDeskHome } from "@/lib/ghl/social";
import { SocialDeskHome } from "@/components/social/social-desk-home";

export const dynamic = "force-dynamic";

export default async function SocialHomePage() {
  const desk = await loadSocialDeskHome();
  if (!desk.configured) {
    return <SocialDeskHome configured={false} accounts={[]} posts={[]} />;
  }
  return (
    <SocialDeskHome configured accounts={desk.accounts} posts={desk.posts} error={desk.error} />
  );
}
