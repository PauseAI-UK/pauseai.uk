import {
  attachToBroadcast,
  changeBroadcastConsentNow,
  deleteBroadcastDraft,
  detachFromBroadcast,
  newBroadcastWith,
  rescheduleBroadcastNow,
  saveBroadcast,
  scheduleBroadcastNow,
  sendBroadcastTestNow,
  stopBroadcastNow,
  submitTemplateNow,
  withdrawTemplateNow,
} from "../../broadcast-actions";

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
  stop: stopBroadcastNow,
  reschedule: rescheduleBroadcastNow,
};
