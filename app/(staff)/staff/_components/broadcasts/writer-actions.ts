import {
  attachToBroadcast,
  changeBroadcastConsentNow,
  deleteBroadcastDraft,
  deleteTemplateNow,
  detachFromBroadcast,
  newBroadcastWith,
  rescheduleBroadcastNow,
  resumeBroadcastNow,
  saveBroadcast,
  scheduleBroadcastNow,
  sendBroadcastTestNow,
  stopBroadcastNow,
  submitTemplateNow,
  withdrawTemplateNow,
} from "./actions";

/** The Server Actions a broadcast's pages give its writer and its view. */
export const broadcastWriterActions = {
  save: saveBroadcast,
  attach: attachToBroadcast,
  detach: detachFromBroadcast,
  sendTest: sendBroadcastTestNow,
  schedule: scheduleBroadcastNow,
  deleteDraft: deleteBroadcastDraft,
  changeConsent: changeBroadcastConsentNow,
  create: newBroadcastWith,
  submitTemplate: submitTemplateNow,
  withdrawTemplate: withdrawTemplateNow,
  deleteTemplate: deleteTemplateNow,
  stop: stopBroadcastNow,
  reschedule: rescheduleBroadcastNow,
  resume: resumeBroadcastNow,
};
