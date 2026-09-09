import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { analytics } from "@/lib/analytics";

/**
 * Withdrawing consent has to be as easy as giving it, so the same choice lives
 * here permanently — the banner only appears once.
 */
export function ConsentSettings() {
  const { t } = useTranslation();
  const [status, setStatus] = useState(analytics.consentStatus());

  const set = (granted: boolean) => {
    if (granted) analytics.grantConsent();
    else analytics.denyConsent();
    setStatus(analytics.consentStatus());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("consent.settingsTitle", "Mätning")}</CardTitle>
        <CardDescription>
          {status === "granted"
            ? t("consent.settingsGranted", "Du har godkänt mätning.")
            : status === "denied"
              ? t("consent.settingsDenied", "Mätning är avstängd.")
              : t("consent.settingsPending", "Du har inte svarat än.")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status === "granted" ? (
          <Button variant="outline" onClick={() => set(false)} data-testid="button-withdraw-consent">
            {t("consent.withdraw", "Återkalla samtycke")}
          </Button>
        ) : (
          <Button variant="outline" onClick={() => set(true)} data-testid="button-give-consent">
            {t("consent.give", "Tillåt mätning")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
