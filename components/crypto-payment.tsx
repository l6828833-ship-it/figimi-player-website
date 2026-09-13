"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { CheckCircle2, ChevronDown, Copy, Loader2, X } from "lucide-react";

type AvailableCurrency = {
  ticker: string;
  name: string;
  network: string | null;
  logoUrl: string | null;
};

type CreatedPayment = {
  paymentId: string;
  payAddress: string;
  payAmount: number;
  payCurrency: string;
  payinExtraId: string | null;
  network: string | null;
  paymentStatus: string;
};

type Props = {
  deviceMac: string;
  planId: string;
  amount: number;
  onClose: () => void;
  onSuccess?: () => void;
};

export function CryptoPayment({ deviceMac, planId, amount, onClose, onSuccess }: Props) {
  const [currencies, setCurrencies] = useState<AvailableCurrency[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("");
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [currencyMenuDirection, setCurrencyMenuDirection] = useState<"down" | "up">("down");
  const [payment, setPayment] = useState<CreatedPayment | null>(null);
  const [creating, setCreating] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string>("");
  const [isPaid, setIsPaid] = useState(false);
  const [copied, setCopied] = useState<string>("");
  const currencyMenuRef = useRef<HTMLDivElement>(null);

  // Fetch available currencies
  useEffect(() => {
    async function fetchCurrencies() {
      try {
        const res = await fetch("/api/nowpayments/currencies");
        const data = await res.json();
        setCurrencies(data.currencies || []);
      } catch (error) {
        console.error("Failed to fetch currencies:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchCurrencies();
  }, []);

  // Close the coin menu when the user clicks outside it or presses Escape.
  useEffect(() => {
    if (!currencyOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (currencyMenuRef.current && !currencyMenuRef.current.contains(event.target as Node)) {
        setCurrencyOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCurrencyOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currencyOpen]);

  // Poll payment status
  useEffect(() => {
    if (!payment) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/nowpayments/status?paymentId=${payment.paymentId}`);
        const data = await res.json();
        
        if (data.status) {
          setPaymentStatus(data.status.paymentStatus);
          
          // Check if paid
          const paidStatuses = ["confirmed", "sending", "finished"];
          if (paidStatuses.includes(data.status.paymentStatus)) {
            setIsPaid(true);
            clearInterval(interval);
            setTimeout(() => {
              onSuccess?.();
            }, 2000);
          }
        }
      } catch (error) {
        console.error("Failed to fetch payment status:", error);
      }
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [payment, onSuccess]);

  const handleCreatePayment = async () => {
    if (!selectedCurrency) return;

    setCreating(true);
    try {
      const res = await fetch("/api/nowpayments/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceMac,
          planId,
          amount,
          payCurrency: selectedCurrency,
        }),
      });

      const data = await res.json();
      
      if (data.error) {
        alert(data.error);
      } else {
        setPayment(data.payment);
        setPaymentStatus(data.payment.paymentStatus);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create payment";
      alert(message);
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  const selectedCurrencyDetails = currencies.find((currency) => currency.ticker === selectedCurrency);

  if (isPaid) {
    return (
      <div className="fp-crypto-payment">
        <div className="fp-crypto-success">
          <CheckCircle2 size={60} className="fp-success-icon" />
          <h3>Payment Received!</h3>
          <p>Your subscription has been activated.</p>
        </div>
      </div>
    );
  }

  if (payment) {
    return (
      <div className="fp-crypto-payment">
        <div className="fp-crypto-header">
          <h3>Send Payment</h3>
          <button className="fp-icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="fp-crypto-body">
          <p className="fp-crypto-description">
            Send exactly the amount below. This updates automatically once your payment is detected.
          </p>

          {/* QR Code */}
          <div className="fp-qr-container">
            <Image
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payment.payAddress)}`}
              alt="Payment address QR"
              width={220}
              height={220}
              className="fp-qr-code"
            />
          </div>

          {/* Amount */}
          <div className="fp-payment-field">
            <label>Amount</label>
            <div className="fp-payment-value">
              <span className="fp-mono">
                {payment.payAmount} {payment.payCurrency.toUpperCase()}
              </span>
              <button
                className="fp-copy-button"
                onClick={() => copyToClipboard(String(payment.payAmount), "amount")}
              >
                {copied === "amount" ? <CheckCircle2 size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>

          {/* Address */}
          <div className="fp-payment-field">
            <label>
              {payment.network ? `Address (${payment.network})` : "Address"}
            </label>
            <div className="fp-payment-value">
              <span className="fp-mono fp-address">{payment.payAddress}</span>
              <button
                className="fp-copy-button"
                onClick={() => copyToClipboard(payment.payAddress, "address")}
              >
                {copied === "address" ? <CheckCircle2 size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>

          {/* Memo / Extra ID */}
          {payment.payinExtraId && (
            <div className="fp-payment-field fp-warning">
              <label>Memo / Extra ID (Required)</label>
              <div className="fp-payment-value">
                <span className="fp-mono">{payment.payinExtraId}</span>
                <button
                  className="fp-copy-button"
                  onClick={() => copyToClipboard(payment.payinExtraId!, "memo")}
                >
                  {copied === "memo" ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          )}

          {/* Status */}
          <div className="fp-payment-status">
            <Loader2 size={16} className="fp-spinner" />
            Waiting for payment{paymentStatus ? ` (${paymentStatus})` : ""}...
          </div>

          <p className="fp-crypto-note">
            Keep this page open. Once your payment is confirmed, your subscription will be activated automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fp-crypto-payment fp-crypto-picker">
      <div className="fp-crypto-header">
        <h3>Choose Cryptocurrency</h3>
        <button className="fp-icon-button" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="fp-crypto-body">
        <p className="fp-crypto-description">
          Select the coin and network you want to use for payment
        </p>

        {loading ? (
          <div className="fp-crypto-loading">
            <Loader2 size={32} className="fp-spinner" />
            <p>Loading currencies...</p>
          </div>
        ) : currencies.length === 0 ? (
          <div className="fp-crypto-empty">
            <p>No cryptocurrencies available. Payment system may not be configured yet.</p>
          </div>
        ) : (
          <>
            <div className="fp-currency-dropdown" ref={currencyMenuRef}>
              <span className="fp-currency-label">Coin / network</span>
              <button
                type="button"
                className={`fp-currency-trigger ${currencyOpen ? "open" : ""}`}
                onClick={() => {
                  const nextOpen = !currencyOpen;
                  if (nextOpen) {
                    const bounds = currencyMenuRef.current?.getBoundingClientRect();
                    const estimatedMenuHeight = Math.min(360, window.innerHeight * 0.48);
                    setCurrencyMenuDirection(
                      bounds && bounds.bottom + estimatedMenuHeight > window.innerHeight - 20 ? "up" : "down"
                    );
                  }
                  setCurrencyOpen(nextOpen);
                }}
                aria-haspopup="listbox"
                aria-expanded={currencyOpen}
              >
                {selectedCurrencyDetails ? (
                  <span className="fp-currency-trigger-content">
                    {selectedCurrencyDetails.logoUrl ? (
                      <Image
                        src={selectedCurrencyDetails.logoUrl}
                        alt=""
                        width={34}
                        height={34}
                        className="fp-currency-logo"
                      />
                    ) : (
                      <span className="fp-currency-placeholder" />
                    )}
                    <span className="fp-currency-trigger-text">
                      <strong>{selectedCurrencyDetails.name}</strong>
                      <span className="fp-currency-meta">
                        {selectedCurrencyDetails.network && (
                          <span className="fp-currency-network-badge">{selectedCurrencyDetails.network}</span>
                        )}
                        <span className="fp-currency-ticker">{selectedCurrencyDetails.ticker.toUpperCase()}</span>
                      </span>
                    </span>
                  </span>
                ) : (
                  <span className="fp-currency-empty">Choose a coin and network</span>
                )}
                <ChevronDown size={19} className="fp-currency-chevron" />
              </button>

              {currencyOpen && (
                <div className={`fp-currency-menu ${currencyMenuDirection}`} role="listbox" aria-label="Available coins">
                  {currencies.map((currency) => (
                    <button
                      key={currency.ticker}
                      type="button"
                      role="option"
                      aria-selected={selectedCurrency === currency.ticker}
                      className={`fp-currency-option ${selectedCurrency === currency.ticker ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedCurrency(currency.ticker);
                        setCurrencyOpen(false);
                      }}
                    >
                      {currency.logoUrl ? (
                        <Image
                          src={currency.logoUrl}
                          alt=""
                          width={36}
                          height={36}
                          className="fp-currency-logo"
                        />
                      ) : (
                        <span className="fp-currency-placeholder" />
                      )}
                      <span className="fp-currency-option-info">
                        <strong>{currency.name}</strong>
                        <span className="fp-currency-meta">
                          {currency.network && (
                            <span className="fp-currency-network-badge">{currency.network}</span>
                          )}
                          <span className="fp-currency-ticker">{currency.ticker.toUpperCase()}</span>
                        </span>
                      </span>
                      {selectedCurrency === currency.ticker && (
                        <CheckCircle2 size={19} className="fp-currency-check" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              className="fp-button primary wide"
              onClick={handleCreatePayment}
              disabled={!selectedCurrency || creating}
            >
              {creating ? (
                <>
                  <Loader2 size={16} className="fp-spinner" />
                  Generating Payment...
                </>
              ) : (
                "Generate Payment Address"
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
