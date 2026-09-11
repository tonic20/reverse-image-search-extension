import { MSG } from './messages';
import { SearchAction, uploadAction } from './telemetry';

/** What the router needs to be able to do. Injected, so a test needs no browser. */
export interface SearchHandlers {
  upload(dataUrl: string, action: SearchAction | undefined, engineIds?: string[]): void;
  face(dataUrl: string, action: SearchAction | undefined): void;
  faceUrl(srcUrl: string): void;
}

export interface SearchMessage {
  type?: string;
  dataUrl?: string;
  srcUrl?: string;
  engineIds?: string[];
  action?: string;
}

/**
 * Route one runtime message to a search, naming where it came from.
 *
 * The action is narrowed here rather than at each sender: these are all upload
 * paths, and a message that names none — a content script injected before this
 * update — must produce undefined, so the column goes NULL instead of carrying
 * a guess. Returns true if the message was one of ours.
 */
export function routeSearchMessage(msg: SearchMessage, handlers: SearchHandlers): boolean {
  if (msg?.type === MSG.SEARCH_IMAGE && msg.dataUrl) {
    handlers.upload(msg.dataUrl, uploadAction(msg.action), msg.engineIds);
    return true;
  }
  if (msg?.type === MSG.SEARCH_FACE && msg.dataUrl) {
    handlers.face(msg.dataUrl, uploadAction(msg.action));
    return true;
  }
  if (msg?.type === MSG.SEARCH_FACE_URL && msg.srcUrl) {
    handlers.faceUrl(msg.srcUrl);
    return true;
  }
  return false;
}
