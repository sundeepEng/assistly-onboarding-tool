import { TEST_HOME_ID } from "../constants";

/** A home as GET /v1/home/{id} returns it. */
export const buildHome = ({
  homeName = "Comfort Cove",
  homeType = "Residential",
  authorizedModules = ["CRM", "CLINICAL", "STAFF MANAGEMENT", "COMPLIANCE", "REVOPS"],
  campaigns = [],
  thresholds,
  budget,
  complianceTraining = [],
  documents = [],
  ...rest
}: Partial<{
  homeName: string;
  homeType: string;
  authorizedModules: string[];
  campaigns: any[];
  /** RevOps budget caps, keyed `thresholds[year][monthAbbr][category]`. */
  thresholds: Record<string, any>;
  /**
   * RevOps forecasts, keyed `budget[year][monthAbbr][income|expense][camelKey]`.
   * Amounts are **dollars**, unlike everything the metrics endpoint returns.
   */
  budget: Record<string, any>;
  /** Compliance training modules the home has uploaded. */
  complianceTraining: any[];
  /** Home-level compliance documents (permits, inspections). */
  documents: any[];
}> = {}) => ({
  home: {
    homeId: TEST_HOME_ID,
    homeName,
    homeType,
    authorizedModules,
    campaigns,
    complianceTraining,
    documents,
    ...(thresholds ? { thresholds } : {}),
    ...(budget ? { budget } : {}),
    ...rest,
  },
});
