import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";

export function AuthorPage() {
  return (
    <div className="route-shell">
      <div className="route-banner">
        <Link to="/" className="route-back">
          ← Accessibility Workbench
        </Link>
        <span className="route-banner-tools">
          <ThemeToggle />
          <span className="route-banner-label">Author</span>
        </span>
      </div>
      <SimpleEditor />
    </div>
  );
}
