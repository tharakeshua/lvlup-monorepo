import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLookupTenantByCode } from "@levelup/query";
import { evaluateTenantAccess } from "@levelup/domain";
import { useAuthSession } from "../sdk/session";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button, Input, Label, Card, CardContent } from "@levelup/shared-ui";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithSchoolCode, loading, error, clearError } = useAuthSession();
  const lookupTenant = useLookupTenantByCode();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/";
  const [step, setStep] = useState<"school-code" | "credentials">("school-code");
  const [schoolCode, setSchoolCode] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [codeError, setCodeError] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSchoolCodeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCodeError("");
    setCodeLoading(true);

    try {
      const code = schoolCode.trim();
      if (!code) {
        setCodeError("Please enter a school code.");
        return;
      }

      const tenant = (await lookupTenant.mutateAsync(code)) as {
        name: string;
        status: string;
        trialEndsAt?: string | null;
      } | null;
      if (!tenant) {
        setCodeError("Invalid school code. Please try again.");
        return;
      }
      const access = evaluateTenantAccess(tenant);
      if (!access.allowed) {
        setCodeError(
          access.reason === "trial_expired"
            ? "This school's trial has ended. Please contact your administrator to reactivate."
            : "This school is currently inactive."
        );
        return;
      }

      setSchoolName(tenant.name);
      setStep("credentials");
    } catch {
      setCodeError("Failed to look up school code. Please try again.");
    } finally {
      setCodeLoading(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setSubmitting(true);

    try {
      await loginWithSchoolCode(schoolCode.trim(), email, password);
      navigate(from, { replace: true });
    } catch {
      // Error is already set in the store
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-subtle shadow-e2 rounded-lg">
      <CardContent className="p-6">
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-semibold">Teacher Portal</h1>
          <p className="text-muted-foreground mt-1 text-sm">Sign in to your teaching dashboard</p>
        </div>

        {step === "school-code" ? (
          <form onSubmit={handleSchoolCodeSubmit} className="space-y-4">
            {codeError && (
              <div className="bg-error-subtle text-error rounded-md p-3 text-sm">{codeError}</div>
            )}

            <div className="space-y-2">
              <Label htmlFor="schoolCode">School Code</Label>
              <Input
                id="schoolCode"
                type="text"
                required
                value={schoolCode}
                onChange={(e) => setSchoolCode(e.target.value)}
                placeholder="Enter your school code"
                autoComplete="organization"
              />
            </div>

            <Button type="submit" disabled={codeLoading} className="w-full">
              {codeLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {codeLoading ? "Validating..." : "Continue"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="bg-surface-sunken rounded-md p-3 text-sm">
              <span className="font-medium">{schoolName}</span>
              <Button
                type="button"
                variant="link"
                className="ml-2 h-auto p-0"
                onClick={() => {
                  setStep("school-code");
                  clearError();
                  setCodeError("");
                }}
              >
                Change
              </Button>
            </div>

            {error && (
              <div className="bg-error-subtle text-error rounded-md p-3 text-sm">{error}</div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@school.com"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button type="submit" disabled={loading || submitting} className="w-full">
              {(loading || submitting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading || submitting ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
