import { describe, expect, it } from "vitest";
import { customerCodeLabel, customerDisplayCode, customerSearchCode } from "./customerCode";

describe("customerDisplayCode", () => {
  it("shows the Sd VIP code for a plain customer", () => {
    expect(customerDisplayCode({ vipNumber: 1 })).toBe("Sd 0001");
  });

  it("shows the Mandir code for a Mandir customer with a mandirNumber set", () => {
    expect(customerDisplayCode({ vipNumber: 2, isMandir: true, mandirNumber: 1 })).toBe("Man001");
  });

  it("shows the Shop code for a Shop customer with a shopNumber set", () => {
    expect(customerDisplayCode({ vipNumber: 3, isShop: true, shopNumber: 1 })).toBe("Shop001");
  });

  it("falls back to the Sd code for a Mandir customer with no mandirNumber set", () => {
    expect(customerDisplayCode({ vipNumber: 4, isMandir: true, mandirNumber: null })).toBe("Sd 0004");
  });

  it("prefers Mandir over Shop when a customer is flagged as both", () => {
    expect(customerDisplayCode({ vipNumber: 5, isMandir: true, mandirNumber: 2, isShop: true, shopNumber: 7 })).toBe("Man002");
  });

  it("is empty for a customer with no vipNumber at all", () => {
    expect(customerDisplayCode({ vipNumber: null })).toBe("");
  });
});

describe("customerSearchCode", () => {
  it("is the lowercase, unspaced form of the display code", () => {
    expect(customerSearchCode({ vipNumber: 1 })).toBe("sd0001");
    expect(customerSearchCode({ vipNumber: 2, isMandir: true, mandirNumber: 1 })).toBe("man001");
    expect(customerSearchCode({ vipNumber: 3, isShop: true, shopNumber: 1 })).toBe("shop001");
  });
});

describe("customerCodeLabel", () => {
  it("labels a plain customer's code as VIP #", () => {
    expect(customerCodeLabel({ vipNumber: 1 })).toBe("VIP #");
  });

  it("labels a Mandir customer's code as Mandir #", () => {
    expect(customerCodeLabel({ vipNumber: 2, isMandir: true, mandirNumber: 1 })).toBe("Mandir #");
  });

  it("labels a Shop customer's code as Shop #", () => {
    expect(customerCodeLabel({ vipNumber: 3, isShop: true, shopNumber: 1 })).toBe("Shop #");
  });
});
