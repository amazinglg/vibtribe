import { createFileRoute } from "@tanstack/react-router";
import AdminUserDetailPage from "@/pages/AdminUserDetailPage";
export const Route = createFileRoute("/admin/user/")({ component: AdminUserDetailPage });
