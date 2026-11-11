import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform } from "react-native";

import { useAuth } from "../../core/auth/AuthProvider";
import { apiErrorMessage } from "../../core/admin/http";
import { billingApi, type BillingStatus } from "./billing.api";
import { openWebCheckout, pollUntil, purchaseApplied } from "./checkout";

export type CheckoutPhase =
  | "idle"
  | "starting"
  | "checkout"
  | "verifying"
  | "processing"
  | "timeout";

/**
 * One-time Razorpay checkout shared by the billing gate (activation / expiry) and
 * the active-plan screen (early renewal). Handles: double taps, cancellation,
 * failure, browser refresh/restart reconciliation, app backgrounding, slow
 * networks and bounded confirmation polling. It never grants access itself: it
 * only asks the backend and re-reads the session.
 */
export function useOrderCheckout(canManageBilling: boolean) {
  const { session, refreshSession } = useAuth();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(canManageBilling);
  const [phase, setPhase] = useState<CheckoutPhase>("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const mounted = useRef(true);
  const busy = useRef(false); // request de-duplication
  const awaitingReturn = useRef(false);
  const baseline = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** One backend reconcile with Razorpay + session refresh when access changed. */
  const reconcile = useCallback(async () => {
    const next = await billingApi.refresh();
    if (mounted.current) setStatus(next);
    if (next.accessAllowed) await refreshSession();
    return next;
  }, [refreshSession]);

  const awaitConfirmation = useCallback(async () => {
    setPhase("processing");
    setError("");
    setNotice("Payment received. Waiting for Razorpay to confirm it…");
    const result = await pollUntil({
      step: reconcile,
      done: (value) => purchaseApplied(value, baseline.current),
      shouldStop: () => !mounted.current,
    });
    if (!mounted.current) return;
    if (result.state === "done") {
      setPhase("idle");
      setNotice("Payment confirmed.");
      return;
    }
    setPhase("timeout");
    setNotice("");
    setError(
      "We are still waiting for confirmation from Razorpay. Your payment is not lost — check again in a minute. Access starts as soon as it is confirmed.",
    );
  }, [reconcile]);

  const loadStatus = useCallback(async () => {
    if (!canManageBilling) return;
    setLoadingStatus(true);
    try {
      const current = await billingApi.status();
      if (!mounted.current) return;
      setStatus(current);
      setError("");
    } catch (cause) {
      if (mounted.current) {
        setError(apiErrorMessage(cause, "Could not load your subscription."));
      }
    } finally {
      if (mounted.current) setLoadingStatus(false);
    }
  }, [canManageBilling]);

  // Mount / browser refresh / app restart: read status, then reconcile once in
  // case a payment completed (or was only authorized) while we were away.
  useEffect(() => {
    if (!canManageBilling) return;
    let cancelled = false;
    (async () => {
      await loadStatus();
      if (cancelled) return;
      try {
        await reconcile();
      } catch {
        // Best effort; the explicit buttons report errors.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canManageBilling, loadStatus, reconcile]);

  // Native hosted checkout: when the app returns to the foreground, check the outcome.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && awaitingReturn.current && !busy.current) {
        awaitingReturn.current = false;
        busy.current = true;
        void awaitConfirmation().finally(() => {
          busy.current = false;
        });
      }
    });
    return () => subscription.remove();
  }, [awaitConfirmation]);

  const refreshNow = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setError("");
    setNotice("");
    setPhase("starting");
    try {
      if (canManageBilling) {
        const next = await reconcile();
        if (mounted.current && !purchaseApplied(next, baseline.current)) {
          setNotice("Status updated. No confirmed payment yet.");
        }
      } else {
        // Non-owners cannot pay; re-read the session in case the owner did.
        await refreshSession();
        setNotice("Status refreshed.");
      }
    } catch (cause) {
      if (mounted.current) setError(apiErrorMessage(cause, "Could not refresh your status."));
    } finally {
      busy.current = false;
      if (mounted.current) setPhase("idle");
    }
  }, [canManageBilling, reconcile, refreshSession]);

  const pay = useCallback(async () => {
    if (busy.current || !canManageBilling) return;
    busy.current = true;
    setError("");
    setNotice("");
    setPhase("starting");
    baseline.current = status?.expiresAt ? Date.parse(status.expiresAt) : 0;
    try {
      // The backend reuses a valid unpaid order, so repeated taps, refreshes and
      // network retries never create duplicate orders.
      const order = await billingApi.createOrder();
      if (!mounted.current) return;

      if (Platform.OS === "web") {
        setPhase("checkout");
        try {
          const outcome = await openWebCheckout(order, {
            name: session?.user.name,
            email: session?.user.email,
          });
          if (!mounted.current) return;
          if (outcome.outcome === "success") {
            setPhase("verifying");
            try {
              const verified = await billingApi.verify(outcome.response);
              if (verified.state === "FAILED" || verified.state === "REJECTED") {
                if (mounted.current) {
                  setPhase("idle");
                  setError(verified.message);
                }
                await reconcile().catch(() => undefined);
                return;
              }
            } catch (cause) {
              // Verification errors never grant access; polling below still asks
              // the backend (which may already have the webhook).
              if (mounted.current) setError(apiErrorMessage(cause, "We could not verify the payment yet."));
            }
            await awaitConfirmation();
            return;
          }
          setPhase("idle");
          if (outcome.outcome === "dismissed") {
            setNotice("Checkout was closed. You were not charged by this window — try again when ready.");
          } else {
            setError(`Payment failed: ${outcome.message}`);
          }
          await reconcile().catch(() => undefined);
          return;
        } catch {
          // checkout.js unavailable (offline / blocked): use the hosted page.
        }
      }

      awaitingReturn.current = true;
      setPhase("checkout");
      setNotice(
        "Complete the payment in the page that opened, then return here. We will confirm it automatically.",
      );
      await Linking.openURL(order.hostedCheckoutUrl);
    } catch (cause) {
      if (mounted.current) {
        setPhase("idle");
        setError(apiErrorMessage(cause, "Could not start the payment. Please try again."));
      }
    } finally {
      busy.current = false;
    }
  }, [awaitConfirmation, canManageBilling, reconcile, session, status]);

  const working = phase === "starting" || phase === "verifying" || phase === "processing";

  return {
    status,
    loadingStatus,
    phase,
    working,
    error,
    notice,
    pay,
    refreshNow,
    loadStatus,
  };
}
