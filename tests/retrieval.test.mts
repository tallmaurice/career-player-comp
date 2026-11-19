// classifyCareer on invented résumés. Pure code, no model call, nothing spent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rootUrl } from "./setup.mts";

const { classifyCareer } = await import(rootUrl("lib/engine/retrieval.ts"));

const A = {
  q1: "I ran something already working and kept it humming",
  q2: "By running a large operation",
  q3: "Sets up whoever takes it",
  q4: "A steady climb up one ladder",
  q5: "Try to coach them up",
  q6: "They think I run more than I do",
  q7: "Still here, still steady, that's the win",
  q8: "The people I'd let down if I left",
};

const oneEmployer = `Marguerite Test (she/her)
Northfield Standard Media, Managing Editor, Features
2019-Present
- Run a 31-person desk; a harbor-contracts series ran in 2022.
Northfield Standard Media, Deputy Managing Editor
2016-2019
Northfield Standard Media, Senior Editor, Local News
2013-2016
The Larkspur Ledger, City Editor
2009-2013
The Larkspur Ledger, Night Copy Editor
2005-2009
Tidewater Weekly, Reporter and Stringer
2003-2005
Columbia Heights Technical Institute, A.S. Journalism, 2001-2003
2023: A three-part look at a county revaluation, edited at the desk.
2022: A series on port contracts, edited line-by-line in 2022.
2021: A features package on restaurants, ten-profile run.
2020: The paper's own account of a corrections failure.
2019: Launch of the investigations unit, a 14-month request.`;

const fiveEmployers = `Ana Test
Editor, Acme Press, 2022-Present
Editor, Birch Daily News, 2020-2022
Editor, Cedar Courier Group, 2018-2020
Editor, Delta Gazette Company, 2016-2018
Editor, Elm Street Journal, 2014-2016`;

test("a Managing Editor title raises prominence", () => {
  const withTitle = classifyCareer("Managing Editor, Features\nDaily News, 2019-Present", A);
  const without = classifyCareer("Reporter, Features\nDaily News, 2019-Present", A);
  assert.equal(withTitle.prominenceLevel, without.prominenceLevel + 1);
});

test("a long one-region record is not tagged journeyman", () => {
  const q = classifyCareer(oneEmployer, A);
  assert.ok(!q.trajectory.includes("journeyman"));
  assert.ok(!q.descriptors.includes("journeyman-survivor"));
});

test("five separate employers still tag journeyman", () => {
  assert.ok(classifyCareer(fiveEmployers, A).trajectory.includes("journeyman"));
});

test("Columbia Heights Technical Institute is not an elite school", () => {
  assert.ok(!classifyCareer(oneEmployer, A).descriptors.includes("high-pedigree"));
});

test("Columbia University still reads as an elite school", () => {
  const q = classifyCareer("B.A., Columbia University, 2010\nEditor, Daily News, 2012-Present", A);
  assert.ok(q.descriptors.includes("high-pedigree"));
});
