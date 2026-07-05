import { useState, type FormEvent } from "react";
import { lookupTenantByCode } from "@levelup/shared-services";
import { evaluateTenantAccess } from "@levelup/domain";
import { Button, Input } from "@levelup/shared-ui";
import { Loader2 } from "lucide-react";

interface SchoolCodeFormProps {
  onCodeVerified: (code: string, name: string) => void;
  onSwitchToConsumer: () => void;
}

export function SchoolCodeForm({ onCodeVerified, onSwitchToConsumer }: SchoolCodeFormProps) {
  const [schoolCode, setSchoolCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCodeError("");
    setCodeLoading(true);

    try {
      const code = schoolCode.trim();
      if (!code) {
        setCodeError("Please enter a school code.");
        return;
      }

      const tenant = await lookupTenantByCode(code);
      if (!tenant) {
        setCodeError("Invalid school code. Please try again.");
        return;
      }
      const access = evaluateTenantAccess(
        tenant as { status: string; trialEndsAt?: string | null }
      );
      if (!access.allowed) {
        setCodeError(
          access.reason === "trial_expired"
            ? "This school's trial has ended. Please contact support to reactivate."
            : "This school is currently inactive."
        );
        return;
      }

      onCodeVerified(code, tenant.name);
    } catch {
      setCodeError("Failed to look up school code. Please try again.");
    } finally {
      setCodeLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {codeError && (
          <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
            {codeError}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="schoolCode" className="text-sm font-medium">
            School Code
          </label>
          <Input
            id="schoolCode"
            type="text"
            required
            autoFocus
            value={schoolCode}
            onChange={(e) => setSchoolCode(e.target.value)}
            placeholder="Enter your school code"
          />
        </div>

        <Button type="submit" disabled={codeLoading} className="w-full">
          {codeLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {codeLoading ? "Validating..." : "Continue"}
        </Button>
      </form>

      <div className="mt-4 text-center">
        <Button variant="link" onClick={onSwitchToConsumer}>
          Don't have a school code? Sign in as learner
        </Button>
      </div>
    </>
  );
}
