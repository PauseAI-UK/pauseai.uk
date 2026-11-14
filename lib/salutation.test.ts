import { describe, expect, it } from "vitest";
import { mpSalutation, mpTitled, peerSalutation, personalSalutation, surnameOf } from "./salutation";

describe("mpSalutation", () => {
  it("is the title Parliament gives and the surname", () => {
    expect(mpSalutation("Abbott, Ms Diane", "female")).toBe("Ms Abbott");
    expect(mpSalutation("Chowns, Dr Ellie", "female")).toBe("Dr Chowns");
    expect(mpSalutation("Prinsley, Dr Peter", "male")).toBe("Dr Prinsley");
    expect(mpSalutation("Brackenridge, Mrs Sureena", "female")).toBe("Mrs Brackenridge");
    expect(mpSalutation("Example, Prof. Sam", undefined)).toBe("Professor Example");
  });

  it("gives Sir and Dame the first name", () => {
    expect(mpSalutation("Tami, Sir Mark", "male")).toBe("Sir Mark");
    expect(mpSalutation("McDonagh, Dame Siobhain", "female")).toBe("Dame Siobhain");
    expect(mpSalutation("Onwurah, Dame Chi", "female")).toBe("Dame Chi");
  });

  it("without a title, is Mr or Ms by gender, Mx for another, and nothing if it isn't known", () => {
    expect(mpSalutation("Aquarone, Steff", "male")).toBe("Mr Aquarone");
    expect(mpSalutation("Baker, Alex", "female")).toBe("Ms Baker");
    expect(mpSalutation("Example, Sam", "other")).toBe("Mx Example");
    expect(mpSalutation("Example, Sam", undefined)).toBeNull();
    expect(mpSalutation("Example", "male")).toBe("Mr Example");
  });

  it("says whether the list name has a title", () => {
    expect(mpTitled("Tami, Sir Mark")).toBe(true);
    expect(mpTitled("Abbott, Ms Diane")).toBe(true);
    expect(mpTitled("Baker, Alex")).toBe(false);
  });

  it("keeps a surname of two words or with a hyphen whole", () => {
    expect(mpSalutation("Long Bailey, Rebecca", "female")).toBe("Ms Long Bailey");
    expect(mpSalutation("Sandher-Jones, Louise", "female")).toBe("Ms Sandher-Jones");
    expect(mpSalutation("Begley, Órfhlaith", "female")).toBe("Ms Begley");
  });
});

describe("peerSalutation", () => {
  it("is Lord or Lady and the title without its place", () => {
    expect(peerSalutation("Lord Addington")).toBe("Lord Addington");
    expect(peerSalutation("Lord Hunt of Kings Heath")).toBe("Lord Hunt");
    expect(peerSalutation("Baroness Adams of Craigielea")).toBe("Lady Adams");
    expect(peerSalutation("Baroness Smith of Basildon")).toBe("Lady Smith");
  });

  it("calls a viscount, an earl and a marquess Lord, and a countess Lady", () => {
    expect(peerSalutation("Viscount Colville of Culross")).toBe("Lord Colville");
    expect(peerSalutation("Viscount Camrose")).toBe("Lord Camrose");
    expect(peerSalutation("The Earl of Kinnoull")).toBe("Lord Kinnoull");
    expect(peerSalutation("Earl Howe")).toBe("Lord Howe");
    expect(peerSalutation("The Marquess of Lothian")).toBe("Lord Lothian");
    expect(peerSalutation("The Countess of Mar")).toBe("Lady Mar");
  });

  it("calls a bishop Bishop, an archbishop Archbishop and a duke Duke", () => {
    expect(peerSalutation("The Lord Bishop of Chelmsford")).toBe("Bishop");
    expect(peerSalutation("The Lord Archbishop of York")).toBe("Archbishop");
    expect(peerSalutation("The Duke of Norfolk")).toBe("Duke");
  });

  it("is nothing for a name with no rank it knows", () => {
    expect(peerSalutation("Jane Smith")).toBeNull();
    expect(peerSalutation("Lord")).toBeNull();
  });
});

describe("personalSalutation", () => {
  it("is the title and surname, or Mr or Ms by gender", () => {
    expect(personalSalutation({ title: "Dr", first: "Steve", surname: "Aiken" }, undefined)).toBe("Dr Aiken");
    expect(personalSalutation({ first: "Angela", surname: "Constance" }, "female")).toBe("Ms Constance");
    expect(personalSalutation({ first: "Q", surname: "Manivannan" }, "other")).toBe("Mx Manivannan");
    expect(personalSalutation({ first: "Rhun", surname: "ap Iorwerth" }, undefined)).toBeNull();
  });
});

describe("surnameOf", () => {
  it("is the last word, with the particles before it", () => {
    expect(surnameOf("Steve Bayliss")).toBe("Bayliss");
    expect(surnameOf("Rhun ap Iorwerth")).toBe("ap Iorwerth");
    expect(surnameOf("Mabon ap Gwynfor")).toBe("ap Gwynfor");
    expect(surnameOf("Rhys ab Owen")).toBe("ab Owen");
    expect(surnameOf("Huw Irranca-Davies")).toBe("Irranca-Davies");
  });

  it("never takes the first name as a particle", () => {
    expect(surnameOf("De Smith")).toBe("Smith");
    expect(surnameOf("Cher")).toBe("Cher");
  });
});
