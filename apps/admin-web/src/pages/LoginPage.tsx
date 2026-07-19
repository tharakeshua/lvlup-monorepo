import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLookupTenantByCode } from "@levelup/query";
import { evaluateTenantAccess } from "@levelup/domain";
import { Input, Button } from "@levelup/shared-ui";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useSession } from "@/sdk/identity";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithSchoolCode, error, clearError } = useSession();
  const lookupTenant = useLookupTenantByCode();
  const [loading, setLoading] = useState(false);
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/";
  const [step, setStep] = useState<"school-code" | "credentials">("school-code");
  const [schoolCode, setSchoolCode] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);

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
        name?: string;
        status?: string;
        trialEndsAt?: string | null;
      } | null;
      if (!tenant) {
        setCodeError("Invalid school code. Please try again.");
        return;
      }
      const access = evaluateTenantAccess({
        status: tenant.status ?? "",
        trialEndsAt: tenant.trialEndsAt,
      });
      if (!access.allowed) {
        setCodeError(
          access.reason === "trial_expired"
            ? "This school's trial has ended. Please contact support to reactivate."
            : "This school is currently inactive."
        );
        return;
      }

      setSchoolName(tenant.name ?? code);
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

    setLoading(true);
    try {
      await loginWithSchoolCode(schoolCode, email, password);
      navigate(from, { replace: true });
    } catch {
      // Error is already set in the session context
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card shadow-card rounded-lg border p-6">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">School Admin</h1>
        <p className="text-muted-foreground mt-1 text-sm">Sign in to manage your school</p>
      </div>

      {step === "school-code" ? (
        <form onSubmit={handleSchoolCodeSubmit} className="space-y-4">
          {codeError && (
            <div
              id="schoolCode-error"
              role="alert"
              className="bg-destructive/10 text-destructive rounded-md p-3 text-sm"
            >
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
              aria-describedby={codeError ? "schoolCode-error" : undefined}
            />
          </div>

          <Button type="submit" className="w-full" disabled={codeLoading}>
            {codeLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {codeLoading ? "Validating..." : "Continue"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="bg-muted rounded-md p-3 text-sm">
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
            <div
              id="login-error"
              role="alert"
              className="bg-destructive/10 text-destructive rounded-md p-3 text-sm"
            >
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@school.com"
              aria-describedby={error ? "login-error" : undefined}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                aria-describedby={error ? "login-error" : undefined}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-10 w-10"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      )}
    </div>
  );
}
