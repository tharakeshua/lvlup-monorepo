import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "@levelup/shared-services";
import { getApiErrorMessage } from "../../lib/api-error";
import { Button, Input } from "@levelup/shared-ui";
import { Loader2 } from "lucide-react";

interface ConsumerSignupFormProps {
  onSwitchToLogin: () => void;
  onSwitchToSchool: () => void;
}

export function ConsumerSignupForm({ onSwitchToLogin, onSwitchToSchool }: ConsumerSignupFormProps) {
  const navigate = useNavigate();

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupError, setSignupError] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSignupError("");
    setSignupLoading(true);

    try {
      const cred = await authService.signUp(signupEmail, signupPassword);
      await authService.updateUserProfile(cred.user, {
        displayName: signupName,
      });
      navigate("/consumer", { replace: true });
    } catch (err) {
      const { message } = getApiErrorMessage(err);
      setSignupError(message || "Signup failed");
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {signupError && (
          <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
            {signupError}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="signupName" className="text-sm font-medium">
            Display Name
          </label>
          <Input
            id="signupName"
            type="text"
            required
            autoFocus
            value={signupName}
            onChange={(e) => setSignupName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="signupEmail" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="signupEmail"
            type="email"
            required
            value={signupEmail}
            onChange={(e) => setSignupEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="signupPassword" className="text-sm font-medium">
            Password
          </label>
          <Input
            id="signupPassword"
            type="password"
            required
            value={signupPassword}
            onChange={(e) => setSignupPassword(e.target.value)}
            placeholder="Choose a password"
          />
        </div>

        <Button type="submit" disabled={signupLoading} className="w-full">
          {signupLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {signupLoading ? "Creating account..." : "Create Account"}
        </Button>
      </form>

      <div className="mt-4 flex flex-col items-center gap-2">
        <Button variant="link" onClick={onSwitchToLogin}>
          Already have an account? Sign in
        </Button>
        <Button variant="link" onClick={onSwitchToSchool} className="text-muted-foreground">
          Back to school login
        </Button>
      </div>
    </>
  );
}
