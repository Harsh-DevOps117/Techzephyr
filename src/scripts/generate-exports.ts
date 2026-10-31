import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildSchedule, type CitDataset, type Disruption } from "../application/scheduling/solver.js";

const root=resolve(import.meta.dirname,"../..");
const data=JSON.parse(await readFile(resolve(root,"data/cit_public.json"),"utf8")) as CitDataset;
const disruption=JSON.parse(await readFile(resolve(root,"examples/sample_disruption.json"),"utf8")) as Disruption;
const baseline=buildSchedule(data);
const repaired=buildSchedule(data,{baseline:baseline.sessions,disruption});
await mkdir(resolve(root,"exports"),{recursive:true});
await writeFile(resolve(root,"exports/schedule.json"),`${JSON.stringify(baseline,null,2)}\n`);
await writeFile(resolve(root,"exports/schedule_after.json"),`${JSON.stringify(repaired,null,2)}\n`);
console.log(`Generated ${baseline.sessions.length} baseline and ${repaired.sessions.length} repaired placements.`);
