/**
 * OnboardingWizardScreen — first-run setup, presented as a root modal (/onboarding).
 *
 * Design: docs/rebuild-spec/design/build/prototypes/admin/onboarding-wizard.card.html
 * Route:  /onboarding (root-level modal, presents over the active tab)
 * Data:   useCreateOrgUser() (add the first staff/student natively) +
 *         useBulkImportStudents()/useBulkImportTeachers() — bulk CSV import is
 *         heavy, so those steps deep-link to "Continue on web" rather than parse
 *         spreadsheets on device. Reads soft-miss to empty until callables deploy.
 *
 * A lightweight local step machine; nothing here writes outside the lane.
 */
import { useState } from "react";
import { Linking, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  useBulkImportStudents,
  useBulkImportTeachers,
  useCreateOrgUser,
  useTenant,
} from "@levelup/query";

import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Icon,
  ProgressBar,
  Screen,
  SectionHeader,
  TextField,
  TopBar,
} from "../../components";
import { routes } from "../../lib/routes";
import { pickStr } from "./_shared";

const WEB_IMPORT_URL = "https://app.levelup.academy/admin/onboarding";

type StepKey = "welcome" | "firstUser" | "roster" | "done";
const ORDER: StepKey[] = ["welcome", "firstUser", "roster", "done"];
const TITLES: Record<StepKey, string> = {
  welcome: "Welcome",
  firstUser: "Add your first user",
  roster: "Import your roster",
  done: "You're all set",
};

export default function OnboardingWizardScreen() {
  const router = useRouter();
  const tenantQ = useTenant();
  const createUser = useCreateOrgUser();
  const importStudents = useBulkImportStudents();
  const importTeachers = useBulkImportTeachers();

  const tenant = tenantQ.data;
  const schoolName = pickStr(tenant, "name", "displayName", "schoolName") ?? "your academy";
  const joinCode = pickStr(tenant, "tenantCode", "code", "joinCode") ?? "—";

  const [step, setStep] = useState<StepKey>("welcome");
  const idx = ORDER.indexOf(step);
  const progress = ((idx + 1) / ORDER.length) * 100;

  // First-user form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"teacher" | "student">("teacher");

  const dismiss = () => {
    if (router.canGoBack()) router.back();
    else router.replace(routes.home());
  };
  const next = () => setStep(ORDER[Math.min(idx + 1, ORDER.length - 1)]);
  const back = () => setStep(ORDER[Math.max(idx - 1, 0)]);

  const onCreateUser = () => {
    if (!email.trim()) {
      next();
      return;
    }
    createUser.mutate(
      { displayName: name.trim(), email: email.trim(), role },
      { onSuccess: () => next() }
    );
  };

  return (
    <Screen scroll>
      <TopBar
        title="Setup"
        subtitle={TITLES[step]}
        left={
          <Button variant="ghost" size="sm" onPress={dismiss}>
            Cancel
          </Button>
        }
        right={<Badge variant="brand">{`${idx + 1}/${ORDER.length}`}</Badge>}
      />

      <ProgressBar value={progress} />

      {step === "welcome" ? (
        <Card className="gap-3">
          <SectionHeader title={`Set up ${schoolName}`} subtitle="A few quick steps to go live" />
          <View className="gap-2">
            {[
              { icon: "user-plus", label: "Add your first teacher or student" },
              { icon: "upload", label: "Import your roster (on web)" },
              { icon: "rocket", label: "Share your join code and go" },
            ].map((r) => (
              <View key={r.label} className="flex-row items-center gap-3">
                <Icon name={r.icon} size={18} />
                <Text className="text-text-secondary text-sm">{r.label}</Text>
              </View>
            ))}
          </View>
          <Divider />
          <View className="gap-1">
            <Text className="text-2xs text-text-muted font-semibold uppercase tracking-wide">
              Your join code
            </Text>
            <Text className="text-text-primary font-mono text-lg font-bold">{joinCode}</Text>
          </View>
          <Button variant="primary" block trailingIcon="arrow-right" onPress={next}>
            Get started
          </Button>
        </Card>
      ) : null}

      {step === "firstUser" ? (
        <Card className="gap-3">
          <SectionHeader title="Add your first user" subtitle="You can add more later" />
          <View className="flex-row gap-2">
            {(["teacher", "student"] as const).map((r) => (
              <Button
                key={r}
                variant={role === r ? "primary" : "secondary"}
                size="sm"
                onPress={() => setRole(r)}
              >
                {r === "teacher" ? "Teacher" : "Student"}
              </Button>
            ))}
          </View>
          <TextField
            label="Full name"
            placeholder="Anita Kapoor"
            value={name}
            onChangeText={setName}
          />
          <TextField
            label="Email"
            placeholder="anita@school.edu"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          {createUser.isError ? (
            <Text className="text-error text-xs">
              We couldn't save this user. Check the email and try again.
            </Text>
          ) : null}
          <View className="flex-row justify-between gap-2">
            <Button variant="ghost" size="sm" onPress={back}>
              Back
            </Button>
            <View className="flex-row gap-2">
              <Button variant="secondary" size="sm" onPress={next}>
                Skip
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={createUser.isPending}
                onPress={onCreateUser}
              >
                {email.trim() ? "Add & continue" : "Continue"}
              </Button>
            </View>
          </View>
        </Card>
      ) : null}

      {step === "roster" ? (
        <Card className="gap-3">
          <SectionHeader
            title="Import your roster"
            subtitle="Bulk CSV import is easiest on the web"
          />
          <Alert variant="info" title="Continue on web for bulk import">
            Uploading and mapping a spreadsheet of students or teachers is handled on the web
            dashboard. Your progress here is saved.
          </Alert>
          <Button
            variant="secondary"
            block
            leadingIcon="external-link"
            loading={importStudents.isPending}
            onPress={() => void Linking.openURL(`${WEB_IMPORT_URL}?import=students`)}
          >
            Import students on web
          </Button>
          <Button
            variant="secondary"
            block
            leadingIcon="external-link"
            loading={importTeachers.isPending}
            onPress={() => void Linking.openURL(`${WEB_IMPORT_URL}?import=teachers`)}
          >
            Import teachers on web
          </Button>
          <View className="flex-row justify-between gap-2">
            <Button variant="ghost" size="sm" onPress={back}>
              Back
            </Button>
            <Button variant="primary" size="sm" onPress={next}>
              Skip for now
            </Button>
          </View>
        </Card>
      ) : null}

      {step === "done" ? (
        <Card className="gap-3">
          <View className="items-center gap-2 py-2">
            <View className="rounded-pill bg-success-subtle p-3">
              <Icon name="check" size={28} color="#16a34a" />
            </View>
            <Text className="text-text-primary text-xl font-bold">You're all set</Text>
            <Text className="text-text-muted max-w-[260px] text-center text-sm">
              {schoolName} is ready. Share your join code so people can sign in.
            </Text>
          </View>
          <Divider />
          <View className="items-center gap-1">
            <Text className="text-2xs text-text-muted font-semibold uppercase tracking-wide">
              Join code
            </Text>
            <Text className="text-brand font-mono text-2xl font-bold">{joinCode}</Text>
          </View>
          <Button variant="primary" block leadingIcon="layout-dashboard" onPress={dismiss}>
            Go to dashboard
          </Button>
        </Card>
      ) : null}

      <Text className="text-2xs text-text-muted px-1 pb-2">
        You can change all of this later in Settings.
      </Text>
    </Screen>
  );
}
