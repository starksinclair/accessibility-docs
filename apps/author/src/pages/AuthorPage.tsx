import { Link } from "react-router-dom";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";

export function AuthorPage() {
  return (
    <div className="route-shell">
      <div className="route-banner">
        <Link to="/" className="route-back">
          ← Accessibility Workbench
        </Link>
        <span className="route-banner-label">Author</span>
      </div>
      <SimpleEditor />
    </div>
  );
}
