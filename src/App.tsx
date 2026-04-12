import { lazy, Suspense } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { I18nProvider } from "./lib/i18n";
import { CompetitionProvider } from "./lib/CompetitionProvider";
import AppLayout from "./components/layout/AppLayout";
import CompetitionHub from "./pages/CompetitionHub";

// Retry dynamic imports once — handles stale chunks after deploy
function lazyRetry(loader: () => Promise<{ default: React.ComponentType }>) {
  return lazy(() =>
    loader().catch(() => {
      // Chunk probably changed after a deploy — reload once
      const key = "chunk-reload";
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
      }
      return loader(); // Fallback: try once more before React error boundary catches it
    }),
  );
}

// Lazy load all pages — only HomePage is eager for fast first paint
import HomePage from "./pages/HomePage";
const OverviewTab = lazyRetry(() => import("./pages/OverviewTab"));
const MatchesPage = lazyRetry(() => import("./pages/MatchesPage"));
const MatchDetailPage = lazyRetry(() => import("./pages/MatchDetailPage"));
const TeamPage = lazyRetry(() => import("./pages/TeamPage"));
const BracketPage = lazyRetry(() => import("./pages/BracketPage"));
const GroupsPage = lazyRetry(() => import("./pages/GroupsPage"));
const StandingsPage = lazyRetry(() => import("./pages/StandingsPage"));
const PredictionsPage = lazyRetry(() => import("./pages/PredictionsPage"));
const LeaderboardPage = lazyRetry(() => import("./pages/LeaderboardPage"));
const WatchPage = lazyRetry(() => import("./pages/WatchPage"));
const SignInPage = lazyRetry(() => import("./pages/SignInPage"));
const AdminPage = lazyRetry(() => import("./pages/AdminPage"));
const PoolsPage = lazyRetry(() => import("./pages/PoolsPage"));
const JoinPoolPage = lazyRetry(() => import("./pages/JoinPoolPage"));
const ProfilePage = lazyRetry(() => import("./pages/ProfilePage"));
const NewsPage = lazyRetry(() => import("./pages/NewsPage"));
const ArticlePage = lazyRetry(() => import("./pages/ArticlePage"));
const NotFoundPage = lazyRetry(() => import("./pages/NotFoundPage"));
const TermsPage = lazyRetry(() => import("./pages/TermsPage"));
const PrivacyPage = lazyRetry(() => import("./pages/PrivacyPage"));
const HelpPage = lazyRetry(() => import("./pages/HelpPage"));
const ContactPage = lazyRetry(() => import("./pages/ContactPage"));

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
                  <Route path="news" element={<NewsPage />} />
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
                <Route path="news" element={<NewsPage />} />
                <Route path="news/:slug" element={<ArticlePage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="watch" element={<WatchPage />} />
                <Route path="sign-in" element={<SignInPage />} />
                <Route path="admin" element={<AdminPage />} />
                <Route path="terms" element={<TermsPage />} />
                <Route path="privacy" element={<PrivacyPage />} />
                <Route path="help" element={<HelpPage />} />
                <Route path="contact" element={<ContactPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </Suspense>
        </HashRouter>
      </AuthProvider>
    </I18nProvider>
  );
}
