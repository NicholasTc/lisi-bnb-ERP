import type { Role } from "../server/roles";
export type TeamMember={id:string;name:string;email:string;enabled:boolean;version:number;mustChangePassword:boolean;roles:Role[];activeTasks:number};
export type TeamView={employee:{id:string;name:string};members:TeamMember[];next:string|null;counts:{total:number;active:number;disabled:number}};
