import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { FileText, Trash2, ExternalLink, Clock, CheckCircle, Loader2, Send, PenLine, Lock, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApplicationListSkeleton } from "@/components/loading-skeleton";
import { SEO } from '@/components/seo';
import { EmptyState } from "@/components/grants/empty-state";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Application, Grant, Company } from "@shared/schema";
import { ComplianceScoreBadge } from "@/components/compliance/compliance-report";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ApplicationWithDetails extends Application {
  grant?: Grant;
  company?: Company;
}

export default function ApplicationsList() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"all" | "drafts" | "submitted" | "decided">("all");
  const [approvalApp, setApprovalApp] = useState<ApplicationWithDetails | null>(null);
  const [approvedAmount, setApprovedAmount] = useState("");
  const [createProject, setCreateProject] = useState(true);

  const { data: userStatus } = useQuery<{ plan?: string; freeApplicationUsed?: boolean }>({
    queryKey: ["/api/user/status"],
  });
  const isFreePlan = userStatus?.plan === "free";

  function getStatusBadge(status: string) {
    switch (status) {
      case "draft":
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
            <Clock className="mr-1 h-3 w-3" />
            {t('applications.status.draft')}
          </Badge>
        );
      case "generated":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            <FileText className="mr-1 h-3 w-3" />
            {t('applications.status.generated')}
          </Badge>
        );
      case "submitted":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
            <CheckCircle className="mr-1 h-3 w-3" />
            {t('applications.status.submitted')}
          </Badge>
        );
      case "under_review":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            <Clock className="mr-1 h-3 w-3" />
            {t('applications.status.under_review', 'Under granskning')}
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
            <Trophy className="mr-1 h-3 w-3" />
            {t('applications.status.approved', 'Beviljad')}
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="secondary" className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
            {t('applications.status.rejected', 'Avslagen')}
          </Badge>
        );
      case "withdrawn":
        return <Badge variant="outline">{t('applications.status.withdrawn', 'Tillbakadragen')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  const { data: applications, isLoading: appsLoading } = useQuery<Application[]>({
    queryKey: ["/api/applications"],
  });

  const { data: grants } = useQuery<Grant[]>({
    queryKey: ["/api/grants"],
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  // Recording the outcome is where the product stopped short: applications
  // could be tracked to submission and no further, so a won grant showed as a
  // raw "approved" string and the amount had nowhere to go. The endpoint that
  // turns an approval into a project already existed and was unreachable.
  const approvalMutation = useMutation({
    mutationFn: async ({
      id,
      amount,
      shouldCreateProject,
    }: {
      id: string;
      amount: string;
      shouldCreateProject: boolean;
    }) => {
      await apiRequest("PATCH", `/api/applications/${id}`, {
        status: "approved",
        approvedAmount: amount,
      });
      if (shouldCreateProject) {
        const res = await apiRequest("POST", `/api/projects/from-application/${id}`);
        return res.json();
      }
      return null;
    },
    onSuccess: (project: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setApprovalApp(null);
      toast({
        title: t("applications.approved", "Beviljat — grattis!"),
        description: project
          ? t("applications.approvedWithProject", "Ansökan är markerad som beviljad och ett projekt är skapat.")
          : t("applications.approvedOnly", "Ansökan är markerad som beviljad."),
      });
    },
    onError: () => {
      toast({ title: t("applications.approvedFailed", "Kunde inte spara beslutet"), variant: "destructive" });
    },
  });

  const rejectionMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest("PATCH", `/api/applications/${id}`, { status: "rejected" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      setApprovalApp(null);
      toast({ title: t("applications.rejectedSaved", "Registrerat som avslag") });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/applications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      toast({
        title: t('applications.toast.deleted'),
        description: t('applications.toast.deletedDesc'),
      });
    },
    onError: () => {
      toast({
        title: t('applications.toast.deleteError'),
        description: t('applications.toast.deleteErrorDesc'),
        variant: "destructive",
      });
    },
  });

  const enrichedApplications: ApplicationWithDetails[] = (applications || []).map((app) => ({
    ...app,
    grant: grants?.find((g) => g.id === app.grantId),
    company: companies?.find((c) => c.id === app.companyId),
  }));

  const filteredApplications = enrichedApplications.filter((app) => {
    if (activeTab === "drafts") return app.status === "draft" || app.status === "generated";
    if (activeTab === "submitted") return app.status === "submitted" || app.status === "under_review";
    if (activeTab === "decided") return app.status === "approved" || app.status === "rejected";
    return true;
  });

  const draftCount = enrichedApplications.filter(
    (a) => a.status === "draft" || a.status === "generated"
  ).length;
  const submittedCount = enrichedApplications.filter(
    (a) => a.status === "submitted" || a.status === "under_review",
  ).length;
  const decidedCount = enrichedApplications.filter(
    (a) => a.status === "approved" || a.status === "rejected",
  ).length;

  if (appsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('applications.title')}</h1>
          <p className="text-muted-foreground">{t('applications.subtitle')}</p>
        </div>
        <ApplicationListSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SEO title={t('applications.title')} noindex={true} />
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('applications.title')}</h1>
        <p className="text-muted-foreground">{t('applications.subtitle')}</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">
            {t('applications.tabs.all', { count: enrichedApplications.length })}
          </TabsTrigger>
          <TabsTrigger value="drafts" data-testid="tab-drafts">
            {t('applications.tabs.drafts', { count: draftCount })}
          </TabsTrigger>
          <TabsTrigger value="submitted" data-testid="tab-submitted">
            {t('applications.tabs.submitted', { count: submittedCount })}
          </TabsTrigger>
          <TabsTrigger value="decided" data-testid="tab-decided">
            {t('applications.tabs.decided', { defaultValue: 'Avgjorda ({{count}})', count: decidedCount })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredApplications.length === 0 ? (
            activeTab === "drafts" ? (
              <EmptyState
                icon={PenLine}
                title={t('applications.empty.noDrafts')}
                description={t('applications.empty.noDraftsDesc')}
                actionLabel={t('applications.empty.exploreGrants')}
                onAction={() => navigate("/bidrag")}
              />
            ) : activeTab === "submitted" ? (
              <EmptyState
                icon={Send}
                title={t('applications.empty.noSubmitted')}
                description={t('applications.empty.noSubmittedDesc')}
                actionLabel={t('applications.empty.viewDrafts')}
                onAction={() => setActiveTab("drafts")}
              />
            ) : (
              <EmptyState
                icon={FileText}
                title={t('applications.empty.noApplications')}
                description={t('applications.empty.noApplicationsDesc')}
                actionLabel={t('applications.empty.exploreGrants')}
                onAction={() => navigate("/bidrag")}
                secondaryActionLabel={t('applications.empty.howItWorks')}
                onSecondaryAction={() => navigate("/")}
              />
            )
          ) : (
            <div className="space-y-4">
              {filteredApplications.map((app) => (
                <Card key={app.id} data-testid={`application-card-${app.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="font-semibold truncate">
                            {app.grant?.title || t('applications.unknownGrant')}
                          </h3>
                          {getStatusBadge(app.status)}
                          {(app as any).complianceReport && (
                            <ComplianceScoreBadge score={(app as any).complianceReport?.overallScore} small />
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                          <span>{app.grant?.sourceName || t('applications.unknownSource')}</span>
                          <span>•</span>
                          <span>{app.company?.companyName || t('applications.unknownCompany')}</span>
                          {app.createdAt && (
                            <>
                              <span>•</span>
                              <span>
                                {t('applications.createdAt', { date: format(new Date(app.createdAt), "d MMM yyyy", { locale: sv }) })}
                              </span>
                            </>
                          )}
                        </div>
                        {app.matchScore && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">{t('applications.matchLabel')}</span>
                            <span className="font-medium">{parseFloat(app.matchScore).toFixed(0)}%</span>
                          </div>
                        )}
                        {app.generatedContent && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {app.generatedContent.substring(0, 200)}...
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isFreePlan && (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" data-testid={`badge-pro-required-${app.id}`}>
                            <Lock className="mr-1 h-3 w-3" />
                            Pro krävs för export
                          </Badge>
                        )}
                        {(app.status === "submitted" || app.status === "under_review") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setApprovalApp(app);
                              setApprovedAmount("");
                              setCreateProject(true);
                            }}
                            data-testid={`button-record-outcome-${app.id}`}
                          >
                            <Trophy className="mr-2 h-4 w-4" />
                            {t('applications.recordOutcome', 'Registrera beslut')}
                          </Button>
                        )}
                        {app.grantId && (
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/bidrag/${app.grantId}`} data-testid={`link-view-grant-${app.id}`}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              {t('grantApply.viewGrant')}
                            </Link>
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              data-testid={`button-delete-${app.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('applications.deleteDialog.title')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('applications.deleteDialog.description')}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(app.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {deleteMutation.isPending ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : null}
                                {t('common.delete')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!approvalApp} onOpenChange={(open) => !open && setApprovalApp(null)}>
        <DialogContent data-testid="dialog-approval">
          <DialogHeader>
            <DialogTitle>{t('applications.outcomeDialog.title', 'Vad blev beslutet?')}</DialogTitle>
            <DialogDescription>
              {approvalApp?.grant?.title
                ? t('applications.outcomeDialog.descFor', {
                    defaultValue: 'Registrera utfallet för {{title}}.',
                    title: approvalApp.grant.title,
                  })
                : t('applications.outcomeDialog.desc', 'Registrera utfallet för ansökan.')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="approved-amount">
                {t('applications.outcomeDialog.amount', 'Beviljat belopp (SEK)')}
              </Label>
              <Input
                id="approved-amount"
                type="number"
                min={0}
                inputMode="numeric"
                value={approvedAmount}
                onChange={(e) => setApprovedAmount(e.target.value)}
                placeholder="500000"
                data-testid="input-approved-amount"
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div>
                <Label htmlFor="create-project" className="cursor-pointer">
                  {t('applications.outcomeDialog.createProject', 'Skapa ett projekt av den')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t(
                    'applications.outcomeDialog.createProjectHint',
                    'Beviljade medel behöver följas upp och redovisas — projektet blir platsen för det.',
                  )}
                </p>
              </div>
              <Switch
                id="create-project"
                checked={createProject}
                onCheckedChange={setCreateProject}
                data-testid="switch-create-project"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => approvalApp && rejectionMutation.mutate(approvalApp.id)}
              disabled={rejectionMutation.isPending || approvalMutation.isPending}
              data-testid="button-record-rejection"
            >
              {t('applications.outcomeDialog.rejected', 'Vi fick avslag')}
            </Button>
            <Button
              onClick={() =>
                approvalApp &&
                approvalMutation.mutate({
                  id: approvalApp.id,
                  amount: approvedAmount,
                  shouldCreateProject: createProject,
                })
              }
              disabled={approvalMutation.isPending || !approvedAmount}
              data-testid="button-confirm-approval"
            >
              {approvalMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trophy className="mr-2 h-4 w-4" />
              )}
              {t('applications.outcomeDialog.approved', 'Vi fick bidraget')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
