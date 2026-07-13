import { useState } from "react";
import { useAuthStore } from "@levelup/shared-stores";
import { SchoolCodeForm } from "../components/auth/SchoolCodeForm";
import { SchoolCredentialsForm } from "../components/auth/SchoolCredentialsForm";
import { ConsumerLoginForm } from "../components/auth/ConsumerLoginForm";
import { ConsumerSignupForm } from "../components/auth/ConsumerSignupForm";

type View = "school-code" | "credentials" | "consumer-login" | "consumer-signup";

export default function LoginPage() {
  const { clearError, error } = useAuthStore();

  const [view, setView] = useState<View>("school-code");
  const [schoolCode, setSchoolCode] = useState("");
  const [schoolName, setSchoolName] = useState("");

  const switchView = (next: View) => {
    clearError();
    setView(next);
  };

  return (
    <div className="bg-card shadow-card rounded-lg border p-6">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Student Portal</h1>
        <p className="text-muted-foreground mt-1 text-sm">Sign in to start learning</p>
      </div>

      {error && (
        <div
          className="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm"
          role="alert"
        >
          {error}
        </div>
      )}

      {view === "school-code" && (
        <SchoolCodeForm
          onCodeVerified={(code, name) => {
            setSchoolCode(code);
            setSchoolName(name);
            setView("credentials");
          }}
          onSwitchToConsumer={() => switchView("consumer-login")}
        />
      )}

      {view === "credentials" && (
        <SchoolCredentialsForm
          schoolCode={schoolCode}
          schoolName={schoolName}
          onBack={() => switchView("school-code")}
        />
      )}

      {view === "consumer-login" && (
        <ConsumerLoginForm
          onSwitchToSignup={() => switchView("consumer-signup")}
          onSwitchToSchool={() => switchView("school-code")}
        />
      )}

      {view === "consumer-signup" && (
        <ConsumerSignupForm
          onSwitchToLogin={() => switchView("consumer-login")}
          onSwitchToSchool={() => switchView("school-code")}
        />
      )}
    </div>
  );
}
