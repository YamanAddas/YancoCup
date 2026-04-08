import { HashRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import HomePage from "./pages/HomePage";
import MatchesPage from "./pages/MatchesPage";
import GroupsPage from "./pages/GroupsPage";
import PredictionsPage from "./pages/PredictionsPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import WatchPage from "./pages/WatchPage";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="matches" element={<MatchesPage />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="predictions" element={<PredictionsPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="watch" element={<WatchPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
