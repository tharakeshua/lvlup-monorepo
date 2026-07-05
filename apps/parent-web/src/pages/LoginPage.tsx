import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@levelup/shared-stores";
import { lookupTenantByCode, getFirebaseServices } from "@levelup/shared-services";
import { evaluateTenantAccess } from "@levelup/domain";
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@levelup/shared-ui";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { sendPasswordResetEmail } from "firebase/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithSchoolCode, loading, error, clearError } = useAuthStore();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/";
  const [step, setStep] = useState<"school-code" | "credentials">("school-code");
  const [schoolCode, setSchoolCode] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [codeError, setCodeError] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");

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

    try {
      await loginWithSchoolCode(schoolCode.trim(), email, password);
      navigate(from, { replace: true });
    } catch {
      // Error is already set in the store
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setForgotMessage("Please enter your email address first.");
      return;
    }
    setForgotLoading(true);
    setForgotMessage("");
    try {
      const { auth } = getFirebaseServices();
      await sendPasswordResetEmail(auth, email);
      setForgotMessage("Password reset email sent. Check your inbox.");
    } catch {
      setForgotMessage("Failed to send reset email. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Parent Portal</CardTitle>
        <CardDescription>Sign in to view your child's progress</CardDescription>
      </CardHeader>
      <CardContent>
        {step === "school-code" ? (
          <form onSubmit={handleSchoolCodeSubmit} className="space-y-4">
            {codeError && (
              <div
                id="schoolCode-error"
                role="alert"
                className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-md p-3 text-sm"
              >
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {codeError}
              </div>
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
                aria-describedby={codeError ? "schoolCode-error" : undefined}
                aria-invalid={!!codeError}
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
                size="sm"
                className="ml-2 h-auto p-0"
                onClick={() => {
                  setStep("school-code");
                  clearError();
                  setCodeError("");
                  setForgotMessage("");
                }}
              >
                Change
              </Button>
            </div>

            {error && (
              <div
                id="login-error"
                role="alert"
                className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-md p-3 text-sm"
              >
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="parent@email.com"
                aria-describedby={error ? "login-error" : undefined}
                aria-invalid={!!error}
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
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto px-0 text-xs"
                  onClick={handleForgotPassword}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? "Sending..." : "Forgot password?"}
                </Button>
              </div>
              {forgotMessage && <p className="text-muted-foreground text-xs">{forgotMessage}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
