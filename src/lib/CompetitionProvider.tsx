import { createContext, useContext } from "react";
import { useParams } from "react-router-dom";
import {
  COMPETITIONS,
  type CompetitionConfig,
} from "./competitions";

// WC is always present — safe to assert
const defaultComp = COMPETITIONS["WC"] as CompetitionConfig;
const CompetitionContext = createContext<CompetitionConfig>(defaultComp);

/** Access the current competition config from anywhere inside competition routes */
export function useCompetition(): CompetitionConfig {
  return useContext(CompetitionContext);
}

/**
 * Reads `:competition` from route params and provides the matching config.
 * Falls back to WC if the param is missing or invalid.
 */
export function CompetitionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { competition } = useParams<{ competition: string }>();
  const key = competition?.toUpperCase() ?? "";
  const config = COMPETITIONS[key] ?? defaultComp;

  return (
    <CompetitionContext.Provider value={config}>
      {children}
    </CompetitionContext.Provider>
  );
}
