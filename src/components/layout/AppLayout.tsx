import { Outlet } from "react-router-dom";
import NavBar from "./NavBar";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-yc-bg-deep text-yc-text-primary font-body">
      <NavBar />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
