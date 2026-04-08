import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { I18nProvider } from "./lib/i18n";
import AppLayout from "./components/layout/AppLayout";
import HomePage from "./pages/HomePage";
import MatchesPage from "./pages/MatchesPage";
import GroupsPage from "./pages/GroupsPage";
import PredictionsPage from "./pages/PredictionsPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import WatchPage from "./pages/WatchPage";
import SignInPage from "./pages/SignInPage";

export default function App() {
  return (
    <I18nProvider>
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="matches" element={<MatchesPage />} />
            <Route path="groups" element={<GroupsPage />} />
            <Route path="predictions" element={<PredictionsPage />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
            <Route path="watch" element={<WatchPage />} />
            <Route path="sign-in" element={<SignInPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
    </I18nProvider>
  );
}
