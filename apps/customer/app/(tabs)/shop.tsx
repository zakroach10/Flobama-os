import { Link } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, type Merch } from "../../src/api";
import { useCart } from "../../src/cart";
import { colors, formatUsd } from "../../src/theme";
import { BrandHeader, Card, ErrorText, GoldButton, Muted, SampleNote, Title } from "../../src/ui";

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
        <BrandHeader kicker="Merch" />
        <SampleNote show={sample} />
        <ErrorText message={error} />
        <Muted>Pickup at the bar. Orders are paid with Stripe test mode until the venue turns on live payments.</Muted>
        {products.map((product) => (
          <Card key={product.id}>
            <Title>{product.name}</Title>
            {product.description ? <Muted>{product.description}</Muted> : null}
            <Text style={styles.price}>{formatUsd(product.priceCents)}</Text>
            <GoldButton label="Add to cart" onPress={() => cart.add(product)} />
          </Card>
        ))}
        {cart.count > 0 ? (
          <Link href="/checkout" style={styles.cart}>
            <Text style={styles.cartText}>
              Cart · {cart.count} · {formatUsd(cart.totalCents)}
            </Text>
          </Link>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0, backgroundColor: colors.bg },
  scroll: { flex: 1, minHeight: 0 },
  content: { padding: 20, paddingBottom: 28, gap: 16 },
  price: { color: colors.gold, fontSize: 18, fontWeight: "800" },
  cart: {
    backgroundColor: colors.gold,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  cartText: { color: colors.black, fontWeight: "800", fontSize: 16, textAlign: "center", width: "100%" },
});
