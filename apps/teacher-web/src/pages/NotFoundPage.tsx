import { Link } from "react-router-dom";
import { FileQuestion } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <FileQuestion className="text-muted-foreground h-16 w-16" />
      <h1 className="font-display mt-4 text-2xl font-semibold">Page Not Found</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        to="/"
        className="bg-primary text-primary-foreground hover:bg-primary/90 mt-6 inline-flex h-9 items-center rounded-md px-4 text-sm font-medium"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
