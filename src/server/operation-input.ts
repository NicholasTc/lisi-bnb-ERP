import { checkKeys,idField,integerField,textField } from "./catalog-input";
import { HttpError } from "./http";
import type { OperationAction,OperationInput } from "../operations/types";
const kinds=["claim","collect","arrive","hold","contact","return","resume","reassign","cancel","correct","unpaid_handover","pause_delivery","resume_delivery"];
export const managedActions=["resume","reassign","cancel","correct","unpaid_handover"];
export function operationInput(raw:Record<string,unknown>):OperationInput{
 if(typeof raw.kind!=="string"||!kinds.includes(raw.kind))throw new HttpError(400,"INVALID_INPUT");const kind=raw.kind as OperationAction;
 const service=kind==="pause_delivery"||kind==="resume_delivery",managed=managedActions.includes(kind);
 const reason=managed||["hold","return","pause_delivery"].includes(kind);
 const allowed=["id","kind","version",...(service?[]:["orderId"]),...(reason?["reason"]:[]),...(managed?["physicalCheck"]:[]),...(kind==="reassign"?["targetId"]:[]),...(kind==="correct"?["locationId"]:[]),...(kind==="hold"?["incident","contactAttempt"]:[]),...(kind==="contact"?["contactAttempt"]:[])];
 checkKeys(raw,allowed);
 const input:OperationInput={id:idField(raw.id),kind,version:integerField(raw,"version",1)};
 if(!service)input.orderId=idField(raw.orderId);if(reason)input.reason=textField(raw,"reason",200);if(managed)input.physicalCheck=textField(raw,"physicalCheck",200);
 if(kind==="reassign")input.targetId=idField(raw.targetId);if(kind==="correct")input.locationId=idField(raw.locationId);
 if(kind==="hold"){
  const incident=raw.incident??"other";if(incident!=="other"&&incident!=="absent"&&incident!=="refused")throw new HttpError(400,"INVALID_INPUT");input.incident=incident;
  if(incident!=="other")input.contactAttempt=textField(raw,"contactAttempt",200);
  else if(raw.contactAttempt!==undefined)input.contactAttempt=textField(raw,"contactAttempt",200,true);
 }
 if(kind==="contact")input.contactAttempt=textField(raw,"contactAttempt",200);
 return input;
}
