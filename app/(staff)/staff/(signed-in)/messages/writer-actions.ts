import {
  attachToMessage,
  changeMessageConsentNow,
  deleteMessageDraft,
  detachFromMessage,
  newMessageWith,
  rescheduleMessageNow,
  saveMessage,
  scheduleMessageNow,
  sendMessageTestNow,
  stopMessageNow,
} from "../../message-actions";

/** The Server Actions a broadcast's pages give its writer and its view. */
export const messageWriterActions = {
  save: saveMessage,
  attach: attachToMessage,
  detach: detachFromMessage,
  sendTest: sendMessageTestNow,
  schedule: scheduleMessageNow,
  deleteDraft: deleteMessageDraft,
  changeConsent: changeMessageConsentNow,
  create: newMessageWith,
  stop: stopMessageNow,
  reschedule: rescheduleMessageNow,
};
