import { lazy, Suspense } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { I18nProvider } from "./lib/i18n";
import AppLayout from "./components/layout/AppLayout";

// Lazy load all pages — only HomePage is eager for fast first paint
import HomePage from "./pages/HomePage";
const MatchesPage = lazy(() => import("./pages/MatchesPage"));
const GroupsPage = lazy(() => import("./pages/GroupsPage"));
const PredictionsPage = lazy(() => import("./pages/PredictionsPage"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const WatchPage = lazy(() => import("./pages/WatchPage"));
const SignInPage = lazy(() => import("./pages/SignInPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 rounded-full border-2 border-yc-green border-t-transparent animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
    <AuthProvider>
      <HashRouter>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="matches" element={<MatchesPage />} />
            <Route path="groups" element={<GroupsPage />} />
            <Route path="predictions" element={<PredictionsPage />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
            <Route path="watch" element={<WatchPage />} />
            <Route path="sign-in" element={<SignInPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
        </Suspense>
      </HashRouter>
    </AuthProvider>
    </I18nProvider>
  );
}
