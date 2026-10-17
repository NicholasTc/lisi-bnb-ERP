import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { preparationInput, preparationState } from "../../src/server/preparation-input";
it("accepts bounded explicit preparation actions and normalizes retry identity", () => {
  const id=randomUUID(), orderId=randomUUID();
  expect(preparationInput({id,kind:"claim",orderId})).toEqual({id,kind:"claim",orderId});
  expect(preparationInput({id,kind:"hold",orderId,reason:" No stock "}).reason).toBe("No stock");
  expect(preparationInput({id,kind:"pause",version:1,reason:" Busy "})).toEqual({id,kind:"pause",version:1,reason:"Busy"});
  expect(preparationState("ready")).toBe("ready");
});
it("rejects forged permissions, unsupported state/payment actions and incomplete reasons", () => {
  const id=randomUUID(),orderId=randomUUID();
  for(const body of [{id,kind:"paid",orderId},{id,kind:"claim",orderId,actorId:randomUUID()},
    {id,kind:"hold",orderId,reason:" "},{id,kind:"pause",reason:"Busy"},{id,kind:"ready",orderId,reason:"extra"},
    {id,kind:"resume",version:0},{id,kind:"hold",orderId,reason:"x".repeat(201)}]) expect(()=>preparationInput(body)).toThrow();
  expect(()=>preparationState("completed")).toThrow();
});
