export type ParticipantSlipFiles = Record<number, File | null>;

let participantSlipFiles: ParticipantSlipFiles = {};

export function getParticipantSlipFiles() {
  return participantSlipFiles;
}

export function setParticipantSlipFiles(next: ParticipantSlipFiles) {
  participantSlipFiles = { ...next };
}

export function clearParticipantSlipFiles() {
  participantSlipFiles = {};
}

