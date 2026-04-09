import { lazy, Suspense } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { I18nProvider } from "./lib/i18n";
import { CompetitionProvider } from "./lib/CompetitionProvider";
import AppLayout from "./components/layout/AppLayout";
import CompetitionHub from "./pages/CompetitionHub";

// Lazy load all pages — only HomePage is eager for fast first paint
import HomePage from "./pages/HomePage";
const OverviewTab = lazy(() => import("./pages/OverviewTab"));
const MatchesPage = lazy(() => import("./pages/MatchesPage"));
const MatchDetailPage = lazy(() => import("./pages/MatchDetailPage"));
const TeamPage = lazy(() => import("./pages/TeamPage"));
const BracketPage = lazy(() => import("./pages/BracketPage"));
const GroupsPage = lazy(() => import("./pages/GroupsPage"));
const StandingsPage = lazy(() => import("./pages/StandingsPage"));
const PredictionsPage = lazy(() => import("./pages/PredictionsPage"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const WatchPage = lazy(() => import("./pages/WatchPage"));
const SignInPage = lazy(() => import("./pages/SignInPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const PoolsPage = lazy(() => import("./pages/PoolsPage"));
const JoinPoolPage = lazy(() => import("./pages/JoinPoolPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
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
                {/* Home — competition cards, globe */}
                <Route index element={<HomePage />} />

                {/* Competition hub — tabbed layout for all competition-scoped routes */}
                <Route
                  path=":competition"
                  element={
                    <CompetitionProvider>
                      <CompetitionHub />
                    </CompetitionProvider>
                  }
                >
                  <Route index element={<Navigate to="overview" replace />} />
                  <Route path="overview" element={<OverviewTab />} />
                  <Route path="matches" element={<MatchesPage />} />
                  <Route path="match/:id" element={<MatchDetailPage />} />
                  <Route path="team/:teamId" element={<TeamPage />} />
                  <Route path="bracket" element={<BracketPage />} />
                  <Route path="groups" element={<GroupsPage />} />
                  <Route path="standings" element={<StandingsPage />} />
                  <Route path="predictions" element={<PredictionsPage />} />
                  <Route path="leaderboard" element={<LeaderboardPage />} />
                  <Route path="pools" element={<PoolsPage />} />
                </Route>

                {/* Backward-compatible redirects (old /matches → /WC/matches) */}
                <Route
                  path="matches"
                  element={<Navigate to="/WC/matches" replace />}
                />
                <Route
                  path="groups"
                  element={<Navigate to="/WC/groups" replace />}
                />
                <Route
                  path="predictions"
                  element={<Navigate to="/WC/predictions" replace />}
                />
                <Route
                  path="leaderboard"
                  element={<Navigate to="/WC/leaderboard" replace />}
                />

                {/* Pool join deeplink */}
                <Route path="pool/:joinCode" element={<JoinPoolPage />} />

                {/* Global routes (not competition-scoped) */}
                <Route path="profile" element={<ProfilePage />} />
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
