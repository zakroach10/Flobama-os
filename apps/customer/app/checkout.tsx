import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../src/api";
import { useCart } from "../src/cart";
import { colors, formatUsd } from "../src/theme";
import { ErrorText, GoldButton, Muted, Screen, Title } from "../src/ui";

function checkoutKey() {
  return `cart-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function CheckoutScreen() {
  const cart = useCart();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [mode, setMode] = useState<"test" | "stripe" | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [key] = useState(checkoutKey);

  async function start() {
    setPending(true);
    setError(null);
    try {
      const result = await api.checkout({
        email,
        idempotencyKey: key,
        items: cart.lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
      });
      setOrderId(result.order.id);
      setToken(result.accessToken);
      setMode(result.mode);
      setStatus(result.order.status);
      if (result.mode === "stripe") {
        await WebBrowser.openBrowserAsync(result.checkoutUrl);
        const latest = await api.order(result.order.id, result.accessToken);
        setStatus(latest.order.status);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Checkout failed.");
    } finally {
      setPending(false);
    }
  }

  async function confirmTest() {
    if (!orderId || !token) return;
    setPending(true);
    setError(null);
    try {
      const result = await api.complete({ orderId, token });
      setStatus(result.order.status);
      cart.clear();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the order.");
    } finally {
      setPending(false);
    }
  }

  if (status === "paid" || status === "fulfilled") {
    return (
      <Screen>
        <Title>Order received</Title>
        <Muted>Nothing was charged in test mode. The bar can see this order in FloBama OS.</Muted>
        {orderId ? <Muted>Order {orderId.slice(0, 8)}</Muted> : null}
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Checkout</Title>
      {cart.lines.length === 0 && !orderId ? <Muted>Your cart is empty.</Muted> : null}
      {cart.lines.map((line) => (
        <View key={line.product.id} style={styles.row}>
          <Text style={styles.name}>
            {line.quantity} × {line.product.name}
          </Text>
          <Text style={styles.name}>{formatUsd(line.product.priceCents * line.quantity)}</Text>
        </View>
      ))}
      <Text style={styles.total}>Total {formatUsd(cart.totalCents)}</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email for the order"
        placeholderTextColor="#8a8178"
        style={styles.input}
      />
      <ErrorText message={error} />
      {!orderId ? <GoldButton label={pending ? "Starting…" : "Continue"} onPress={() => void start()} disabled={pending || cart.lines.length === 0} /> : null}
      {mode === "test" && orderId ? (
        <>
          <Muted>Stripe is not connected, so this confirms the order without a card charge.</Muted>
          <GoldButton label={pending ? "Saving…" : "Place test order"} onPress={() => void confirmTest()} disabled={pending} />
        </>
      ) : null}
      {mode === "stripe" && status !== "paid" ? (
        <Muted>Finish payment in the browser, then come back. Pull the order if the status still says pending.</Muted>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  name: { color: colors.text, fontSize: 16 },
  total: { color: colors.gold, fontSize: 20, fontWeight: "800" },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
});
