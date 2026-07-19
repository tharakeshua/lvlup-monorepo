import * as React from "react";
import { SchoolCodeStep } from "./SchoolCodeStep";
import { CredentialsStep } from "./CredentialsStep";

export interface SchoolCodeLoginFormProps {
  title: string;
  subtitle: string;
  showRollNumberToggle?: boolean;
  onConsumerClick?: () => void;
  lookupTenantByCode: (
    code: string
  ) => Promise<{ id: string; name: string; status: string; code: string } | null>;
  loginWithSchoolCode: (schoolCode: string, credential: string, password: string) => Promise<void>;
  onSuccess?: () => void;
}

export function SchoolCodeLoginForm({
  title,
  subtitle,
  showRollNumberToggle = false,
  onConsumerClick,
  lookupTenantByCode,
  loginWithSchoolCode,
  onSuccess,
}: SchoolCodeLoginFormProps) {
  const [step, setStep] = React.useState<"school-code" | "credentials">("school-code");
  const [school, setSchool] = React.useState<{ id: string; name: string; code: string } | null>(
    null
  );

  return (
    <div className="bg-card shadow-card rounded-lg border p-6">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
      </div>

      {step === "school-code" ? (
        <SchoolCodeStep
          lookupTenantByCode={lookupTenantByCode}
          onSchoolResolved={(resolved) => {
            setSchool(resolved);
            setStep("credentials");
          }}
          onConsumerClick={onConsumerClick}
        />
      ) : (
        <CredentialsStep
          schoolName={school?.name ?? ""}
          showRollNumberToggle={showRollNumberToggle}
          onBack={() => setStep("school-code")}
          onSubmit={async (credential, password) => {
            await loginWithSchoolCode(school!.code, credential, password);
            onSuccess?.();
          }}
        />
      )}
    </div>
  );
}
