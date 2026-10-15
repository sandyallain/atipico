// node --experimental-strip-types src/lib/time.test.ts
import assert from "node:assert/strict";
import { madridToUtc } from "./time.ts";

assert.equal(madridToUtc("2026-07-01T12:00"), "2026-07-01T10:00:00.000Z"); // été, UTC+2
assert.equal(madridToUtc("2026-12-01T12:00"), "2026-12-01T11:00:00.000Z"); // hiver, UTC+1
assert.equal(madridToUtc("2026-10-25T01:30"), "2026-10-24T23:30:00.000Z"); // veille du passage à l'heure d'hiver
assert.equal(madridToUtc("2026-10-25T04:00"), "2026-10-25T03:00:00.000Z"); // juste après
assert.throws(() => madridToUtc("pas une date"));
console.log("time ok");
