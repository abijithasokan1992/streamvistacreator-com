import { Navigate } from "react-router-dom";

/**
 * Legacy/non-StreamVista product route retained only for backward compatibility.
 *
 * College ERP is outside the StreamVista Core 5 runtime boundary. Keep the
 * historical route from rendering an unrelated application inside the
 * production StreamVista bundle while old bookmarks are phased out.
 */
export default function CollegeERP() {
  return <Navigate to="/" replace />;
}
