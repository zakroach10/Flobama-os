import { Link } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, type Merch } from "../../src/api";
import { useCart } from "../../src/cart";
import { colors, fonts, formatUsd, radii, space, type as typeScale } from "../../src/theme";
import { ErrorText, GoldButton, Muted, Reveal, SampleNote } from "../../src/ui";

export default function ShopScreen() {
  const cart = useCart();
  const [products, setProducts] = useState<Merch[]>([]);
  const [sample, setSample] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const merch = await api.merch();
      setProducts(merch.products);
      setSample(merch.sample);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load merch.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.fill} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} style={styles.scroll}>
        <SampleNote show={sample} />
        <ErrorText message={error} />
        <Muted>Pickup at the bar. Stripe stays in test mode until the venue turns on live payments.</Muted>
        {products.map((product, index) => (
          <Reveal key={product.id} index={index}>
            <View style={styles.card}>
              {product.imageUrl ? (
                <Image source={{ uri: product.imageUrl }} style={styles.photo} accessibilityLabel={product.name} />
              ) : (
                <View style={styles.swatch}>
                  <Text style={styles.initial}>{product.name.slice(0, 1)}</Text>
                </View>
              )}
              <View style={styles.body}>
                <View style={styles.titleRow}>
                  <Text style={styles.name}>{product.name}</Text>
                  <Text style={styles.price}>{formatUsd(product.priceCents)}</Text>
                </View>
                {product.description ? <Muted>{product.description}</Muted> : null}
                <GoldButton label="Add to cart" onPress={() => cart.add(product)} />
              </View>
            </View>
          </Reveal>
        ))}
      </ScrollView>
      {cart.count > 0 ? (
        <View style={styles.cartDock}>
          <Link href="/checkout" asChild>
            <Pressable style={styles.cart} accessibilityRole="button" accessibilityLabel="Open cart">
              <Text style={styles.cartText}>
                Cart · {cart.count} · {formatUsd(cart.totalCents)}
              </Text>
            </Pressable>
          </Link>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0, backgroundColor: colors.bg },
  scroll: { flex: 1, minHeight: 0 },
  content: { padding: space.xl, paddingBottom: 96, gap: space.lg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
  },
  photo: { width: "100%", height: 160 },
  swatch: {
    height: 112,
    backgroundColor: "#3a2414",
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { color: colors.gold, fontFamily: fonts.display, fontSize: 42 },
  body: { padding: space.lg, gap: space.md },
  titleRow: { flexDirection: "row", justifyContent: "space-between", gap: space.md, alignItems: "baseline" },
  name: { color: colors.text, fontFamily: fonts.displaySoft, fontSize: typeScale.card, flex: 1 },
  price: { color: colors.gold, fontFamily: fonts.textStrong, fontSize: typeScale.body },
  cartDock: { paddingHorizontal: space.lg, paddingBottom: space.md, paddingTop: space.sm },
  cart: {
    backgroundColor: colors.gold,
    borderRadius: radii.pill,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  cartText: { color: colors.ink, fontFamily: fonts.textStrong, fontSize: typeScale.body },
});
