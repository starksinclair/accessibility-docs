import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthorPage } from "@/pages/AuthorPage";
import { HubPage } from "@/pages/HubPage";
import { WorkbenchPage } from "@/pages/WorkbenchPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HubPage />} />
        <Route path="/author" element={<AuthorPage />} />
        <Route path="/workbench" element={<WorkbenchPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
