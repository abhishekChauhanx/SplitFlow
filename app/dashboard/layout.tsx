import "./dashboard-shell.css";

export default function DashboardSectionLayout({ children }: { children: React.ReactNode }) {
  return <div className="dash-shell">{children}</div>;
}