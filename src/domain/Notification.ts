import type { ContactInfo } from "./ContactInfo.js";

/** Notification métier : indépendante de tout canal ou SDK. */
export interface Notification {
  contact: ContactInfo;
  subject: string;
  body: string;
}
