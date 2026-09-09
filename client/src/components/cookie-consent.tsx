import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { analytics } from "@/lib/analytics";

/**
 * GA4 sets cookies, so it cannot load before the visitor agrees. PostHog is
 * initialised opted-out and stores the answer itself, so this component holds
 * no consent state of its own — it reads and writes PostHog's, which keeps one
 * source of truth for both sinks.
 *
 * Declining is one click, same size button, no dark pattern — that is the part
 * that makes the banner lawful rather than decorative.
 */
export function CookieConsent() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(analytics.consentStatus() === "pending");
  }, []);

  if (!visible) return null;

  const decide = (granted: boolean) => {
    if (granted) analytics.grantConsent();
    else analytics.denyConsent();
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t("consent.label", "Samtycke till mätning")}
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-card p-4 shadow-lg"
      data-testid="cookie-consent"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-muted-foreground">
          {t(
            "consent.body",
            "Vi mäter hur tjänsten används för att förbättra den — vilka sidor som besöks och var det tar stopp. Väljer du Nej sparas inga kakor och ingen mätning sker.",
          )}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            onClick={() => decide(false)}
            data-testid="button-consent-decline"
          >
            {t("consent.decline", "Nej tack")}
          </Button>
          <Button onClick={() => decide(true)} data-testid="button-consent-accept">
            {t("consent.accept", "Jag godkänner")}
          </Button>
        </div>
      </div>
    </div>
  );
}
