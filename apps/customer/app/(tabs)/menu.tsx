import { useCallback, useEffect, useState } from "react";
import { api, type MenuItem, type Special } from "../../src/api";
import { BrandHeader, Card, ErrorText, Muted, SampleNote, Screen, SectionTitle, Title } from "../../src/ui";

export default function MenuScreen() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [specials, setSpecials] = useState<Special[]>([]);
  const [sample, setSample] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const menu = await api.menu();
      setItems(menu.items);
      setSpecials(menu.specials);
      setSample(menu.sample);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the menu.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = [...new Set(items.map((item) => item.category))];

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void load().finally(() => setRefreshing(false));
      }}
    >
      <BrandHeader kicker="Food and drinks" />
      <SampleNote show={sample} />
      <ErrorText message={error} />
      {specials.length ? (
        <>
          <SectionTitle>Tonight&apos;s specials</SectionTitle>
          {specials.map((special) => (
            <Card key={special.id}>
              <Title>{special.title}</Title>
              <Muted>
                {[special.subtitle, special.priceLabel].filter(Boolean).join(" · ")}
              </Muted>
            </Card>
          ))}
        </>
      ) : null}
      {categories.flatMap((category) => [
        <SectionTitle key={`${category}-title`}>{category}</SectionTitle>,
        ...items
          .filter((item) => item.category === category)
          .map((item) => (
            <Card key={item.id}>
              <Title>{item.name}</Title>
              {item.description ? <Muted>{item.description}</Muted> : null}
              <Muted>{item.priceLabel}</Muted>
            </Card>
          )),
      ])}
      {items.length === 0 && !error ? <Muted>The kitchen has not published a menu yet.</Muted> : null}
    </Screen>
  );
}
