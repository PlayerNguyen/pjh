import { describe, expect, test } from "bun:test";
import { parseLcov, percent } from "./check-coverage.ts";

describe("parseLcov", () => {
  test("should sum line and function totals from an lcov report", () => {
    const lcov = [
      "TN:",
      "SF:src/a.ts",
      "FNF:2",
      "FNH:1",
      "LF:10",
      "LH:8",
      "end_of_record",
      "SF:src/b.ts",
      "FNF:3",
      "FNH:3",
      "LF:5",
      "LH:5",
      "end_of_record",
    ].join("\n");
    expect(parseLcov(lcov)).toEqual({
      linesFound: 15,
      linesHit: 13,
      functionsFound: 5,
      functionsHit: 4,
    });
  });

  test("should ignore DA records and malformed lines", () => {
    const lcov = ["DA:16,26", "garbage", "LF:2", "LH:1"].join("\n");
    expect(parseLcov(lcov)).toEqual({
      linesFound: 2,
      linesHit: 1,
      functionsFound: 0,
      functionsHit: 0,
    });
  });

  test("should return zeroed totals for an empty report", () => {
    expect(parseLcov("")).toEqual({
      linesFound: 0,
      linesHit: 0,
      functionsFound: 0,
      functionsHit: 0,
    });
  });
});

describe("percent", () => {
  test("should compute the covered percentage", () => {
    expect(percent(8, 10)).toBe(80);
    expect(percent(1, 3)).toBeCloseTo(33.33, 1);
  });

  test("should return 100 when there is nothing to cover", () => {
    expect(percent(0, 0)).toBe(100);
  });
});
