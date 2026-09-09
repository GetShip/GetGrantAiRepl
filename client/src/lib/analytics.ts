import posthog from 'posthog-js';

interface EventProperties {
  [key: string]: string | number | boolean | undefined;
}

// Every call below used to reach window.__analytics, which nothing ever
// assigned — so all of it was a no-op behind an empty catch. Two sinks now:
// PostHog for product funnels and replay, GA4 so paid traffic has history to
// compare against when it starts. Either is optional; a missing key just
// disables that sink.
class AnalyticsService {
  private posthogOn = false;
  private gaOn = false;
  private get enabled() {
    return this.posthogOn || this.gaOn;
  }

  init() {
    if (typeof window === 'undefined') return;

    const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
    if (posthogKey) {
      posthog.init(posthogKey, {
        api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: false,
      });
      this.posthogOn = true;
    }

    const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    if (gaId) {
      const tag = document.createElement('script');
      tag.async = true;
      tag.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
      document.head.appendChild(tag);
      (window as any).dataLayer = (window as any).dataLayer || [];
      this.gtag('js', new Date());
      this.gtag('config', gaId, { anonymize_ip: true });
      this.gaOn = true;
    }
  }

  private gtag(...args: unknown[]) {
    (window as any).dataLayer?.push(args);
  }

  private send(eventName: string, properties?: EventProperties) {
    if (!this.enabled) return;
    if (this.posthogOn) posthog.capture(eventName, properties);
    if (this.gaOn) this.gtag('event', eventName, properties);
  }

  pageView(pageName: string) {
    if (this.posthogOn) posthog.capture('$pageview', { page: pageName });
    if (this.gaOn) this.gtag('event', 'page_view', { page_title: pageName });
  }

  identify(userId: string, traits?: Record<string, string>) {
    if (this.posthogOn) posthog.identify(userId, traits);
    if (this.gaOn) this.gtag('set', { user_id: userId });
  }

  signupStarted(method: string) {
    this.send('signup_started', { method });
  }

  signupCompleted(userId: string) {
    this.send('signup_completed', { userId });
  }

  onboardingStarted() {
    this.send('onboarding_started');
  }

  onboardingCompleted(props?: {
    sessionId?: string;
    totalSteps?: number;
    timeToCompleteMs?: number;
    usedAiExtraction?: boolean;
    fieldsAutoFilled?: number;
    fieldsUserEdited?: number;
    extractionRating?: number;
  }) {
    this.send('onboarding_completed', props);
  }

  onboardingSkipped(sessionId: string, skippedAtStep: number) {
    this.send('onboarding_skipped', { sessionId, skippedAtStep });
  }

  extractionStarted(sessionId: string, websiteUrl: string, attemptNumber: number) {
    this.send('extraction_started', { sessionId, websiteUrl, attemptNumber });
  }

  extractionCompleted(props: { status: string; fieldsFound: number; avgConfidence: number; pagesScraped: number; durationMs: number }) {
    this.send('extraction_completed', props);
  }

  fieldEdited(fieldName: string, wasAiFilled: boolean, confidenceScore: number) {
    this.send('field_edited', { fieldName, wasAiFilled, confidenceScore });
  }

  companyProfileCreated(companyId: string, completeness: number) {
    this.send('company_profile_created', { companyId, completeness });
  }

  companyProfileUpdated(companyId: string, completeness: number) {
    this.send('company_profile_updated', { companyId, completeness });
  }

  grantViewed(grantId: string, source: string, matchScore?: number) {
    this.send('grant_viewed', { grantId, source, matchScore });
  }

  grantSearched(query: string, resultsCount: number) {
    this.send('grant_searched', { query, resultsCount });
  }

  grantFiltered(filters: Record<string, string | number | boolean | undefined>) {
    this.send('grant_filtered', filters);
  }

  aiAnalysisStarted(grantId: string) {
    this.send('ai_analysis_started', { grantId });
  }

  aiAnalysisCompleted(grantId: string, matchScore: number, tokensUsed: number) {
    this.send('ai_analysis_completed', { grantId, matchScore, tokensUsed });
  }

  applicationGenerationStarted(grantId: string) {
    this.send('application_generation_started', { grantId });
  }

  applicationGenerationCompleted(applicationId: string, grantId: string, tokensUsed: number, wordCount: number) {
    this.send('application_generation_completed', { applicationId, grantId, tokensUsed, wordCount });
  }

  applicationExported(applicationId: string, format: string) {
    this.send('application_exported', { applicationId, format });
  }

  applicationStatusUpdated(applicationId: string, fromStatus: string, toStatus: string) {
    this.send('application_status_updated', { applicationId, fromStatus, toStatus });
  }

  pricingPageViewed() {
    this.send('pricing_page_viewed');
  }

  upgradeClicked(plan: string) {
    this.send('upgrade_clicked', { plan });
  }

  checkoutStarted(plan: string, amount: number) {
    this.send('checkout_started', { plan, amount });
  }

  checkoutCompleted(plan: string, amount: number) {
    this.send('checkout_completed', { plan, amount });
  }
}

export const analytics = new AnalyticsService();
analytics.init();
