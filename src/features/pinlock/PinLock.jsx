import { useState, useEffect } from "react";

const D = {
  bg:"#F0EDE5", white:"#FAFAF7", bk:"#0A0A0A",
  border:"#E8E4DA", muted:"#9B9589", rd:"#C1121F",
};

// ── PIN LOCK ───────────────────────────────────────────────
export function PinLock({ isLocked, onUnlock }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shaking, setShaking] = useState(false);

  const handleDigit = (digit) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) {
        checkPin(newPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setError("");
  };

  const checkPin = (enteredPin) => {
    const storedPin = localStorage.getItem("mv_pin");
    if (storedPin === enteredPin) {
      onUnlock();
      setPin("");
      setError("");
    } else {
      setError("Incorrect PIN");
      setPin("");
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    }
  };

  if (!isLocked) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: D.bg,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 24, padding: 24,
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontFamily: "'Unbounded',monospace", fontSize: 28, fontWeight: 900,
          color: D.bk, lineHeight: 1, marginBottom: 8,
        }}>🔒</div>
        <div style={{
          fontFamily: "'Unbounded',monospace", fontSize: 13, fontWeight: 700,
          color: D.bk, letterSpacing: ".06em", marginBottom: 4,
        }}>MINDVAULT LOCKED</div>
        <p style={{ fontSize: 11, color: D.muted }}>Enter your PIN to unlock</p>
      </div>

      {/* PIN display */}
      <div style={{
        display: "flex", gap: 12, justifyContent: "center",
        animation: shaking ? "shake 0.5s" : "none",
      }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: 50, height: 50, borderRadius: 12,
              background: pin.length > i ? D.bk : D.white,
              border: `2px solid ${pin.length > i ? D.bk : D.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, color: D.white, fontWeight: 700,
            }}
          >
            {pin.length > i ? "●" : ""}
          </div>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <p style={{ fontSize: 12, color: D.rd, fontWeight: 600 }}>{error}</p>
      )}

      {/* Keypad */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10,
        width: "100%", maxWidth: 240,
      }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <button
            key={digit}
            onClick={() => handleDigit(String(digit))}
            style={{
              padding: 16, borderRadius: 12, border: "none",
              background: D.white, border: `1.5px solid ${D.border}`,
              fontSize: 18, fontWeight: 700, color: D.bk,
              cursor: "pointer", transition: "all .15s",
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            {digit}
          </button>
        ))}
        <div />
        <button
          onClick={() => handleDigit("0")}
          style={{
            padding: 16, borderRadius: 12, border: "none",
            background: D.white, border: `1.5px solid ${D.border}`,
            fontSize: 18, fontWeight: 700, color: D.bk,
            cursor: "pointer", transition: "all .15s",
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          0
        </button>
        <button
          onClick={handleBackspace}
          style={{
            padding: 16, borderRadius: 12, border: "none",
            background: D.white, border: `1.5px solid ${D.border}`,
            fontSize: 18, fontWeight: 700, color: D.muted,
            cursor: "pointer", transition: "all .15s",
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          ⌫
        </button>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
      `}</style>
    </div>
  );
}

// ── PIN SETUP ──────────────────────────────────────────────
export function PinSetup({ onComplete }) {
  const [step, setStep] = useState("create"); // create | confirm
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [error, setError] = useState("");

  const handleDigit = (digit) => {
    if (step === "create") {
      if (pin1.length < 4) {
        const newPin = pin1 + digit;
        setPin1(newPin);
        if (newPin.length === 4) {
          setStep("confirm");
        }
      }
    } else {
      if (pin2.length < 4) {
        const newPin = pin2 + digit;
        setPin2(newPin);
        if (newPin.length === 4) {
          if (newPin === pin1) {
            localStorage.setItem("mv_pin", newPin);
            localStorage.setItem("mv_pin_set", "true");
            onComplete();
          } else {
            setError("PINs don't match");
            setPin1("");
            setPin2("");
            setStep("create");
          }
        }
      }
    }
  };

  const handleBackspace = () => {
    if (step === "create") {
      setPin1(pin1.slice(0, -1));
    } else {
      setPin2(pin2.slice(0, -1));
    }
    setError("");
  };

  const currentPin = step === "create" ? pin1 : pin2;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: D.bg,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 24, padding: 24,
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontFamily: "'Unbounded',monospace", fontSize: 28, fontWeight: 900,
          color: D.bk, lineHeight: 1, marginBottom: 8,
        }}>🔐</div>
        <div style={{
          fontFamily: "'Unbounded',monospace", fontSize: 13, fontWeight: 700,
          color: D.bk, letterSpacing: ".06em", marginBottom: 4,
        }}>SET UP PIN LOCK</div>
        <p style={{ fontSize: 11, color: D.muted }}>
          {step === "create"
            ? "Create a 4-digit PIN"
            : "Confirm your PIN"}
        </p>
      </div>

      {/* PIN display */}
      <div style={{
        display: "flex", gap: 12, justifyContent: "center",
      }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: 50, height: 50, borderRadius: 12,
              background: currentPin.length > i ? D.bk : D.white,
              border: `2px solid ${currentPin.length > i ? D.bk : D.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, color: D.white, fontWeight: 700,
            }}
          >
            {currentPin.length > i ? "●" : ""}
          </div>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <p style={{ fontSize: 12, color: D.rd, fontWeight: 600 }}>{error}</p>
      )}

      {/* Keypad */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10,
        width: "100%", maxWidth: 240,
      }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <button
            key={digit}
            onClick={() => handleDigit(String(digit))}
            style={{
              padding: 16, borderRadius: 12, border: "none",
              background: D.white, border: `1.5px solid ${D.border}`,
              fontSize: 18, fontWeight: 700, color: D.bk,
              cursor: "pointer", transition: "all .15s",
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            {digit}
          </button>
        ))}
        <div />
        <button
          onClick={() => handleDigit("0")}
          style={{
            padding: 16, borderRadius: 12, border: "none",
            background: D.white, border: `1.5px solid ${D.border}`,
            fontSize: 18, fontWeight: 700, color: D.bk,
            cursor: "pointer", transition: "all .15s",
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          0
        </button>
        <button
          onClick={handleBackspace}
          style={{
            padding: 16, borderRadius: 12, border: "none",
            background: D.white, border: `1.5px solid ${D.border}`,
            fontSize: 18, fontWeight: 700, color: D.muted,
            cursor: "pointer", transition: "all .15s",
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
