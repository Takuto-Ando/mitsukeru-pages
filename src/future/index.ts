// No import from the current app. These loaders run only when a future caller invokes them.
export const futureFeatures = {
  postUseSurvey: () => import("./postUseSurvey"),
  postUseSurveyView: () => import("./SurveyQuestionnaire"),
  storageCheck: () => import("./storageCheck"),
  photoCard: () => import("./photoCard"),
  observationComparison: () => import("./observationComparison"),
  noticingComparisonView: () => import("./NoticingComparison"),
};
