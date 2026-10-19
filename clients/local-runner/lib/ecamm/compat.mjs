import { isNonIdempotentEndpoint, VERIFIED_ENDPOINTS } from "./constants.mjs";

export const NON_IDEMPOTENT_ACTIONS = Object.keys(VERIFIED_ENDPOINTS).filter((name) =>
  isNonIdempotentEndpoint(name),
);

export const ENDPOINT_BY_NAME = VERIFIED_ENDPOINTS;

export const PRODUCTION_COMMAND_KINDS = [
  "ecamm_discover",
  "ecamm_select_host",
  "ecamm_forget_host",
  "ecamm_refresh",
  "ecamm_diagnostics_probe",
  "ecamm_call",
  "session_note",
  "recording_associate",
];
