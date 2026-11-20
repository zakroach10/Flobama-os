import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, type MenuItem, type Special } from "../../src/api";
import { colors, fonts, radii, space, type as typeScale } from "../../src/theme";
import { ErrorText, Eyebrow, GoldButton, Muted, SampleNote, Screen } from "../../src/ui";

const ONLINE_ORDER_URL = "https://order.spoton.com/so-flobama-1346/florence-alabama/5e850eff9adef353aa477611";

export default function MenuScreen() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [specials, setSpecials] = useState<Special[]>([]);
  const [sample, setSample] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState("All");

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

  const categories = ["All", ...new Set(items.map((item) => item.category))];
  const visible = category === "All" ? items : items.filter((item) => item.category === category);
  const grouped = [...new Set(visible.map((item) => item.category))];

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void load().finally(() => setRefreshing(false));
      }}
    >
      <GoldButton label="Order online" onPress={() => void WebBrowser.openBrowserAsync(ONLINE_ORDER_URL)} />
      <SampleNote show={sample} />
      <ErrorText message={error} />
      {specials.length ? (
        <View style={styles.specials}>
          <Eyebrow>Specials</Eyebrow>
          {specials.map((special) => (
            <View key={special.id} style={styles.row}>
              <View style={styles.copy}>
                <Text style={styles.name}>{special.title}</Text>
                {special.subtitle ? <Text style={styles.desc}>{special.subtitle}</Text> : null}
              </View>
              {special.priceLabel ? <Text style={styles.price}>{special.priceLabel}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {categories.map((name) => {
          const on = name === category;
          return (
            <Pressable key={name} onPress={() => setCategory(name)} style={[styles.chip, on && styles.chipOn]} accessibilityRole="button">
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {grouped.map((name) => (
        <View key={name} style={styles.group}>
          <Eyebrow>{name}</Eyebrow>
          {visible
            .filter((item) => item.category === name)
            .map((item) => (
              <View key={item.id} style={styles.row}>
                <View style={styles.copy}>
                  <Text style={styles.name}>{item.name}</Text>
                  {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
                </View>
                <Text style={styles.price}>{item.priceLabel}</Text>
              </View>
            ))}
        </View>
      ))}
      {items.length === 0 && !error ? <Muted>The kitchen has not published a menu yet.</Muted> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  specials: { gap: space.md },
  chips: { gap: space.sm, paddingVertical: space.xs },
  chip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.raised,
  },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.text, fontFamily: fonts.textMedium, fontSize: typeScale.small },
  chipTextOn: { color: colors.ink, fontFamily: fonts.textStrong },
  group: { gap: space.sm },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  copy: { flex: 1, gap: 2 },
  name: { color: colors.text, fontFamily: fonts.textMedium, fontSize: typeScale.body },
  desc: { color: colors.muted, fontFamily: fonts.text, fontSize: typeScale.small, lineHeight: 20 },
  price: { color: colors.gold, fontFamily: fonts.textStrong, fontSize: typeScale.body },
});
