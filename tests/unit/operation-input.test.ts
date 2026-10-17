import {randomUUID} from "node:crypto";
import {it,expect} from "vitest";
import {operationInput} from "../../src/server/operation-input";
it("requires explicit physical checks for privileged recovery and contact for absent/refused customers",()=>{
 const base={id:randomUUID(),orderId:randomUUID(),version:2};
 expect(operationInput({...base,kind:"reassign",targetId:randomUUID(),reason:" Shift ",physicalCheck:" Checked drinks "})).toMatchObject({reason:"Shift",physicalCheck:"Checked drinks"});
 for(const body of [{...base,kind:"complete"},{...base,kind:"claim",paid:true},{...base,kind:"cancel",reason:"Cancel"},{...base,kind:"hold",incident:"absent",reason:"Not found"},{...base,kind:"hold",incident:"unknown",reason:"No"},{...base,kind:"claim",version:0}])expect(()=>operationInput(body)).toThrow();
});
