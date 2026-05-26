import { useState } from "react";
import { OnboardingCard, OnboardingButton } from "./OnboardingCard.jsx";

const D = {
  bg:"#F0EDE5", white:"#FAFAF7", bk:"#0A0A0A",
  border:"#E8E4DA", muted:"#9B9589", rd:"#C1121F", yl:"#E8B84B", bl:"#1D3557",
};

export function OnboardingFlow({ onComplete, onOpenMeditation }) {
  const [screen, setScreen] = useState(0);

  const handleComplete = () => {
    localStorage.setItem("mindwrite_onboarding_complete", "true");
    onComplete();
  };

  const handleSkip = () => {
    localStorage.setItem("mindwrite_onboarding_complete", "true");
    onComplete();
  };

  const nextScreen = () => setScreen(s => s + 1);

  // SCREEN 0: WELCOME
  if (screen === 0) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: D.bg,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: 20, maxWidth: 480, margin: "0 auto", width: "100%",
      }}>
        <OnboardingCard>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌙</div>
          <div style={{
            fontFamily: "'Unbounded', monospace",
            fontSize: 24,
            fontWeight: 900,
            color: D.bk,
            marginBottom: 16,
            lineHeight: 1.2,
          }}>
            Welcome to MindWrite
          </div>
          <p style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: D.muted,
            marginBottom: 24,
          }}>
            MindWrite is a private space for stillness, reflection, and self-awareness.
            <br /><br />
            It is designed to help you slow down, notice patterns, and build a clearer relationship with your inner life over time.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <OnboardingButton onClick={nextScreen} variant="primary">Continue</OnboardingButton>
            <OnboardingButton onClick={handleSkip} variant="secondary">Skip for now</OnboardingButton>
          </div>
        </OnboardingCard>
      </div>
    );
  }

  // SCREEN 1: MEDITATION
  if (screen === 1) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: D.bg,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: 20, maxWidth: 480, margin: "0 auto", width: "100%",
      }}>
        <OnboardingCard>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✨</div>
          <div style={{
            fontFamily: "'Unbounded', monospace",
            fontSize: 24,
            fontWeight: 900,
            color: D.bk,
            marginBottom: 16,
            lineHeight: 1.2,
          }}>
            Begin With Stillness
          </div>
          <p style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: D.muted,
            marginBottom: 24,
          }}>
            At the center of MindWrite is a 20-minute guided meditation inspired by José Silva's relaxation and visualization practices.
            <br /><br />
            This meditation is separate from journaling.
            <br /><br />
            Its purpose is preparation — helping you slow mental noise, relax the body, strengthen visualization, and enter a calm, focused state often associated with alpha brainwave activity.
            <br /><br />
            <strong>Use headphones if possible.<br />Sit or lie comfortably.<br />Don't force results.<br />Let the guidance carry you.</strong>
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <OnboardingButton onClick={() => { onOpenMeditation(); }} variant="primary">Begin Meditation</OnboardingButton>
            <OnboardingButton onClick={nextScreen} variant="secondary">Continue</OnboardingButton>
          </div>
        </OnboardingCard>
      </div>
    );
  }

  // SCREEN 2: JOURNAL PHILOSOPHY
  if (screen === 2) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: D.bg,
        overflowY: "auto",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: 20, maxWidth: 480, margin: "0 auto", width: "100%",
        minHeight: "100vh",
      }}>
        <div style={{ width: "100%", paddingTop: 20, paddingBottom: 20 }}>
          <OnboardingCard>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✍️</div>
            <div style={{
              fontFamily: "'Unbounded', monospace",
              fontSize: 24,
              fontWeight: 900,
              color: D.bk,
              marginBottom: 16,
              lineHeight: 1.2,
            }}>
              About the Journal
            </div>
            <p style={{
              fontSize: 13,
              lineHeight: 1.8,
              color: D.muted,
              marginBottom: 24,
              textAlign: "left",
            }}>
              MindWrite works best when you write honestly and intentionally.
              <br /><br />
              <strong>The quality of your reflection has a direct impact on the quality of the insights, patterns, and guidance you receive over time.</strong>
              <br /><br />
              You do not need to write perfectly.<br />
              You do not need to write endlessly.
              <br /><br />
              A few honest paragraphs are more valuable than pages written without presence.
              <br /><br />
              <strong>Consistency matters</strong> because patterns emerge across days, weeks, and months. The more context you give the system, the more meaningful your long-term insights can become.
              <br /><br />
              At the same time, don't become a slave to the process.
              <br /><br />
              MindWrite is here to support your life — not consume it.
              <br /><br />
              Some days may require deep reflection.<br />
              Other days may require simply living, resting, creating, connecting, or being present.
              <br /><br />
              <strong>Use the journal as a tool for awareness, not as a measure of your worth.</strong>
            </p>
            <OnboardingButton onClick={nextScreen} variant="primary">Continue</OnboardingButton>
          </OnboardingCard>
        </div>
      </div>
    );
  }

  // SCREEN 3: HOME SCREEN INSTALL
  if (screen === 3) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: D.bg,
        overflowY: "auto",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: 20, maxWidth: 480, margin: "0 auto", width: "100%",
        minHeight: "100vh",
      }}>
        <div style={{ width: "100%", paddingTop: 20, paddingBottom: 20 }}>
          <OnboardingCard>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📱</div>
            <div style={{
              fontFamily: "'Unbounded', monospace",
              fontSize: 24,
              fontWeight: 900,
              color: D.bk,
              marginBottom: 16,
              lineHeight: 1.2,
            }}>
              Save to Home Screen
            </div>
            <p style={{
              fontSize: 13,
              lineHeight: 1.8,
              color: D.muted,
              marginBottom: 20,
              textAlign: "left",
            }}>
              For the best experience, save MindWrite to your phone's home screen.
              <br /><br />
              It will feel more like a private daily app and less like a website.
            </p>

            <div style={{
              background: D.white,
              border: `1px solid ${D.border}`,
              borderRadius: 12,
              padding: 14,
              marginBottom: 16,
              textAlign: "left",
            }}>
              <div style={{
                fontFamily: "'Unbounded', monospace",
                fontSize: 10,
                fontWeight: 700,
                color: D.bk,
                letterSpacing: ".08em",
                marginBottom: 8,
              }}>
                ON IPHONE
              </div>
              <ol style={{
                fontSize: 12,
                lineHeight: 1.8,
                color: D.muted,
                paddingLeft: 20,
                margin: 0,
              }}>
                <li>Open MindWrite in Safari</li>
                <li>Tap the Share button</li>
                <li>Choose "Add to Home Screen"</li>
              </ol>
            </div>

            <div style={{
              background: D.white,
              border: `1px solid ${D.border}`,
              borderRadius: 12,
              padding: 14,
              marginBottom: 20,
              textAlign: "left",
            }}>
              <div style={{
                fontFamily: "'Unbounded', monospace",
                fontSize: 10,
                fontWeight: 700,
                color: D.bk,
                letterSpacing: ".08em",
                marginBottom: 8,
              }}>
                ON ANDROID
              </div>
              <ol style={{
                fontSize: 12,
                lineHeight: 1.8,
                color: D.muted,
                paddingLeft: 20,
                margin: 0,
              }}>
                <li>Open MindWrite in Chrome</li>
                <li>Tap the menu</li>
                <li>Choose "Add to Home screen" or "Install app"</li>
              </ol>
            </div>

            <OnboardingButton onClick={nextScreen} variant="primary">Continue</OnboardingButton>
          </OnboardingCard>
        </div>
      </div>
    );
  }

  // SCREEN 4: PRIVACY & AI
  if (screen === 4) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: D.bg,
        overflowY: "auto",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: 20, maxWidth: 480, margin: "0 auto", width: "100%",
        minHeight: "100vh",
      }}>
        <div style={{ width: "100%", paddingTop: 20, paddingBottom: 20 }}>
          <OnboardingCard>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
            <div style={{
              fontFamily: "'Unbounded', monospace",
              fontSize: 24,
              fontWeight: 900,
              color: D.bk,
              marginBottom: 16,
              lineHeight: 1.2,
            }}>
              Your Data &amp; Privacy
            </div>
            <p style={{
              fontSize: 13,
              lineHeight: 1.8,
              color: D.muted,
              marginBottom: 20,
              textAlign: "left",
            }}>
              MindWrite is designed to feel personal and private.
              <br /><br />
              Most of your journal entries, reflections, settings, and vault content are stored locally on your device whenever possible.
              <br /><br />
              <strong>Certain optional AI-powered features may send selected text, prompts, or uploaded content to external AI services</strong> in order to generate summaries, insights, guidance, transcriptions, or analysis.
              <br /><br />
              Examples may include:
            </p>
            <ul style={{
              fontSize: 12,
              lineHeight: 1.8,
              color: D.muted,
              paddingLeft: 20,
              marginBottom: 20,
              textAlign: "left",
            }}>
              <li>AI journal insights</li>
              <li>Counsel Mode conversations</li>
              <li>Voice transcription</li>
              <li>Image or handwriting analysis</li>
              <li>Automation or planning tools</li>
            </ul>
            <p style={{
              fontSize: 13,
              lineHeight: 1.8,
              color: D.muted,
              marginBottom: 20,
              textAlign: "left",
            }}>
              <strong>MindWrite should always make it clear when an AI feature is being used.</strong>
              <br /><br />
              You remain in control of what you choose to submit.
              <br /><br />
              For deeply sensitive, personal, medical, financial, or legal information, use discretion and good judgment before sending content to any external AI service.
              <br /><br />
              MindWrite is intended to support reflection, awareness, creativity, and growth — not replace professional medical, psychological, legal, or financial advice.
            </p>
            <div style={{
              background: D.bg,
              borderRadius: 8,
              padding: 12,
              marginBottom: 20,
              fontSize: 11,
              color: D.muted,
              fontStyle: "italic",
              lineHeight: 1.6,
            }}>
              Local device storage may be lost if browser/app data is cleared.
            </div>
            <OnboardingButton onClick={nextScreen} variant="primary">Continue</OnboardingButton>
          </OnboardingCard>
        </div>
      </div>
    );
  }

  // SCREEN 5: ENTER APP
  if (screen === 5) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: D.bg,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: 20, maxWidth: 480, margin: "0 auto", width: "100%",
      }}>
        <OnboardingCard>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌿</div>
          <div style={{
            fontFamily: "'Unbounded', monospace",
            fontSize: 24,
            fontWeight: 900,
            color: D.bk,
            marginBottom: 16,
            lineHeight: 1.2,
          }}>
            Enter MindWrite
          </div>
          <p style={{
            fontSize: 14,
            lineHeight: 1.8,
            color: D.muted,
            marginBottom: 28,
          }}>
            Your journey with MindWrite is meant to evolve over time.
            <br /><br />
            <strong>Move with honesty.<br />Move with awareness.<br />And remember to live beyond the screen.</strong>
          </p>
          <OnboardingButton onClick={handleComplete} variant="primary">Enter MindWrite</OnboardingButton>
        </OnboardingCard>
      </div>
    );
  }
}
