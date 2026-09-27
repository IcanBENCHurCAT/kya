import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  buildDefaultData,
  parseOFACCSV,
  parseOFACJSON,
  saveSanctionsList,
  loadSanctionsList,
  downloadOFACSDN,
  SanctionsList,
} from "../src/services/ofac.js";

describe("OFAC Service Unit Tests", () => {
  describe("buildDefaultData", () => {
    it("should return sample entries with required fields", () => {
      const entries = buildDefaultData();
      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        expect(entry).toHaveProperty("id");
        expect(entry).toHaveProperty("name");
        expect(entry).toHaveProperty("type");
        expect(entry).toHaveProperty("source", "OFAC-SDN");
        expect(entry).toHaveProperty("program");
        expect(Array.isArray(entry.addresses)).toBe(true);
        expect(Array.isArray(entry.aliases)).toBe(true);
        expect(Array.isArray(entry.nationalities)).toBe(true);
        expect(Array.isArray(entry.nationalIds)).toBe(true);
        expect(Array.isArray(entry.birthdates)).toBe(true);
        expect(typeof entry.lastUpdated).toBe("string");
      }
    });
  });

  describe("parseOFACCSV", () => {
    it("should return empty array if csv has fewer than 2 lines or empty text", () => {
      expect(parseOFACCSV("")).toEqual([]);
      expect(parseOFACCSV("Header Line Only")).toEqual([]);
    });

    it("should parse valid CSV lines and handle comment/empty lines", () => {
      const csv = `Record Type,Last Name,First Name,Type,Address,City,State,Country,SSN,DOB
# This is a comment
! This is another comment

101,DOE,JOHN,Individual,123 St,NYC,NY,USA,1212,1980-01-01
102,ACME CORP,,Entity,456 Ave,LAX,CA,USA,,
103,SHIP ONE,,Vessel,Port,,,"Panama",,
104,PLANE ONE,,Aircraft,Hangar,,,"USA",,
105,SHORT,LINE`;

      const entries = parseOFACCSV(csv);
      expect(entries.length).toBe(4); // 105 has < 5 parts, ignored

      expect(entries[0]).toMatchObject({
        id: "101",
        name: "DOE, JOHN",
        type: "individual",
        source: "OFAC-SDN",
        program: "SDN",
        addresses: ["USA"],
        nationalities: ["USA"],
      });

      expect(entries[1]).toMatchObject({
        id: "102",
        name: "ACME CORP",
        type: "entity",
        addresses: ["USA"],
      });

      expect(entries[2]).toMatchObject({
        id: "103",
        name: "SHIP ONE",
        type: "vessel",
        addresses: ["Panama"],
      });

      expect(entries[3]).toMatchObject({
        id: "104",
        name: "PLANE ONE",
        type: "aircraft",
        addresses: ["USA"],
      });
    });

    it("should strip quotes and trim whitespace from fields", () => {
      const csv = `Header Line
"201","SMITH","JANE","Corp Entity","","","","UK"`;

      const entries = parseOFACCSV(csv);
      expect(entries.length).toBe(1);
      expect(entries[0].id).toBe("201");
      expect(entries[0].name).toBe("SMITH, JANE");
      expect(entries[0].type).toBe("entity");
      expect(entries[0].nationalities).toEqual(["UK"]);
    });

    it("should handle lines with empty fields or missing parts defaulting id and names", () => {
      const csv = `Header Line
,ALICE,,Individual,,,,""`;

      const entries = parseOFACCSV(csv);
      expect(entries.length).toBe(1);
      expect(entries[0].id).toBe("unknown-1");
      expect(entries[0].name).toBe("ALICE");
      expect(entries[0].type).toBe("individual");
      expect(entries[0].addresses).toEqual([]);
    });
  });

  describe("parseOFACJSON", () => {
    it("should handle empty or null input gracefully", () => {
      expect(parseOFACJSON([])).toEqual([]);
      expect(parseOFACJSON({})).toEqual([]);
    });

    it("should parse an array of JSON items correctly", () => {
      const json = [
        {
          uid: "301",
          name: "Test Person",
          entityType: "Individual",
          type: ["SDGT", "IRAN"],
          address: ["Tehran, Iran", { city: "Qom" }],
          aka: ["Testy", { alias: "TP" }],
          nationalities: ["Iran", { country: "IR" }],
          identifications: [
            "ID-999",
            { country: "IR", idNumber: "123456", type: "Passport" },
          ],
          associatedPersons: [{ dob: "1975-06-20" }],
        },
      ];

      const entries = parseOFACJSON(json);
      expect(entries.length).toBe(1);
      expect(entries[0]).toMatchObject({
        id: "301",
        name: "Test Person",
        type: "individual",
        program: "SDGT,IRAN",
        addresses: ["Tehran, Iran", '{"city":"Qom"}'],
        aliases: ["Testy", '{"alias":"TP"}'],
        nationalities: ["Iran", '{"country":"IR"}'],
        nationalIds: ["ID-999", "IR 123456 Passport"],
        birthdates: ["1975-06-20"],
      });
    });

    it("should parse an object containing SDNList property", () => {
      const json = {
        SDNList: [
          {
            id: "302",
            name: "Vessel Carrier",
            entityType: "Vessel",
            type: "SYRIA",
          },
        ],
      };

      const entries = parseOFACJSON(json);
      expect(entries.length).toBe(1);
      expect(entries[0].id).toBe("302");
      expect(entries[0].type).toBe("vessel");
      expect(entries[0].program).toBe("SDN"); // non-array type defaults item.type join check
    });

    it("should generate random UUID for missing uid and id", () => {
      const json = [{ name: "No ID Entity", entityType: "Entity" }];
      const entries = parseOFACJSON(json);
      expect(entries.length).toBe(1);
      expect(entries[0].id).toMatch(
        /^unknown-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(entries[0].type).toBe("entity");
    });
  });

  describe("saveSanctionsList and loadSanctionsList", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ofac-test-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("should save and load a sanctions list to/from disk", () => {
      const listPath = path.join(tmpDir, "nested", "sanctions.json");
      const testList: SanctionsList = {
        name: "Test SDN",
        version: "1.0",
        lastUpdated: "2025-01-01",
        totalEntries: 1,
        entries: buildDefaultData().slice(0, 1),
      };

      saveSanctionsList(testList, listPath);
      expect(fs.existsSync(listPath)).toBe(true);

      const loaded = loadSanctionsList(listPath);
      expect(loaded).toEqual(testList);
    });

    it("should return null if file does not exist or is invalid JSON", () => {
      const nonExistentPath = path.join(tmpDir, "nonexistent.json");
      expect(loadSanctionsList(nonExistentPath)).toBeNull();

      const invalidJsonPath = path.join(tmpDir, "invalid.json");
      fs.writeFileSync(invalidJsonPath, "{ bad json }");
      expect(loadSanctionsList(invalidJsonPath)).toBeNull();
    });
  });

  describe("downloadOFACSDN", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should download and parse CSV from treasury.gov when response is ok", async () => {
      const mockCsv = `Header Line
101,DOE,JOHN,Individual,,,,USA,,`;

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        if (typeof url === "string" && url.endsWith(".csv")) {
          return new Response(mockCsv, { status: 200 });
        }
        return new Response("Not found", { status: 444 });
      });

      const entries = await downloadOFACSDN();
      expect(fetchSpy).toHaveBeenCalled();
      expect(entries.length).toBe(1);
      expect(entries[0].name).toBe("DOE, JOHN");
    });

    it("should download and parse JSON from sanctionslistservice.ofac.gov when CSV fails and JSON succeeds", async () => {
      const mockJson = [
        {
          uid: "501",
          name: "JSON Entry",
          entityType: "Individual",
        },
      ];

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        if (typeof url === "string" && url.endsWith(".csv")) {
          return new Response("Error", { status: 500, statusText: "Internal Server Error" });
        }
        if (typeof url === "string" && url.endsWith(".json")) {
          return new Response(JSON.stringify(mockJson), { status: 200 });
        }
        return new Response("Not found", { status: 404 });
      });

      const entries = await downloadOFACSDN();
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(entries.length).toBe(1);
      expect(entries[0].id).toBe("501");
      expect(entries[0].name).toBe("JSON Entry");
    });

    it("should fallback to buildDefaultData if all downloads fail or throw exceptions", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        throw new Error("Network error");
      });

      const entries = await downloadOFACSDN();
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(entries).toEqual(buildDefaultData());
    });
  });
});
