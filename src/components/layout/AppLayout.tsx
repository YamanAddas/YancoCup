import { Outlet } from "react-router-dom";
import NavBar from "./NavBar";
import MobileNav from "./MobileNav";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-yc-bg-deep text-yc-text-primary font-body">
      <NavBar />
      <main className="pb-16 sm:pb-0">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}
