import { lazy, Suspense } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { I18nProvider } from "./lib/i18n";
import { CompetitionProvider } from "./lib/CompetitionProvider";
import AppLayout from "./components/layout/AppLayout";

// Lazy load all pages — only HomePage is eager for fast first paint
import HomePage from "./pages/HomePage";
const MatchesPage = lazy(() => import("./pages/MatchesPage"));
const MatchDetailPage = lazy(() => import("./pages/MatchDetailPage"));
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

/**
 * Wrapper that provides CompetitionProvider for competition-scoped routes.
 */
function CompetitionLayout({ children }: { children: React.ReactNode }) {
  return <CompetitionProvider>{children}</CompetitionProvider>;
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

                {/* Competition-scoped routes */}
                <Route
                  path=":competition/matches"
                  element={
                    <CompetitionLayout>
                      <MatchesPage />
                    </CompetitionLayout>
                  }
                />
                <Route
                  path=":competition/match/:id"
                  element={
                    <CompetitionLayout>
                      <MatchDetailPage />
                    </CompetitionLayout>
                  }
                />
                <Route
                  path=":competition/groups"
                  element={
                    <CompetitionLayout>
                      <GroupsPage />
                    </CompetitionLayout>
                  }
                />
                <Route
                  path=":competition/standings"
                  element={
                    <CompetitionLayout>
                      <StandingsPage />
                    </CompetitionLayout>
                  }
                />
                <Route
                  path=":competition/predictions"
                  element={
                    <CompetitionLayout>
                      <PredictionsPage />
                    </CompetitionLayout>
                  }
                />
                <Route
                  path=":competition/pools"
                  element={
                    <CompetitionLayout>
                      <PoolsPage />
                    </CompetitionLayout>
                  }
                />
                <Route
                  path=":competition/leaderboard"
                  element={
                    <CompetitionLayout>
                      <LeaderboardPage />
                    </CompetitionLayout>
                  }
                />

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
