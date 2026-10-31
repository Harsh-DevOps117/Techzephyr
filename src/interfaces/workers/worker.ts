import { writeFile, mkdir, rm, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { v7 as uuidv7 } from "uuid";
import { buildSchedule, decideBookings, type CitDataset, type Disruption, type Placement } from "../../application/scheduling/solver.js";
import { getChannel, QUEUE_NAME, closeQueue } from "../../infrastructure/messaging/rabbitmq.js";
import { config } from "../../infrastructure/config/env.js";
import { logger } from "../../infrastructure/logging/logger.js";
import { pool, transaction } from "../../infrastructure/database/postgres.js";
import type { JobEnvelope } from "../../domain/shared/types.js";
import { invalidateCache } from "../../infrastructure/cache/redis-cache.js";
type ExportSchedule = ReturnType<typeof buildSchedule>;
async function scheduleContext(scheduleVersionId:string){
  const found=await pool.query<{payload:CitDataset;disruption:Disruption|null;baseline_schedule_id:string|null;objective:Record<string,unknown>}>(`SELECT d.payload,s.disruption,s.baseline_schedule_id,s.objective FROM schedule_version s JOIN dataset_version d ON d.id=s.dataset_version_id WHERE s.id=$1`,[scheduleVersionId]);
  if(!found.rowCount)throw new Error("Schedule or dataset version not found");
  let baseline:Placement[]|undefined;
  if(found.rows[0].baseline_schedule_id){const rows=await pool.query<Placement>(`SELECT session_id,day,start_period,room_id FROM schedule_session WHERE schedule_version_id=$1`,[found.rows[0].baseline_schedule_id]);baseline=rows.rows;}
  return {...found.rows[0],baseline};
}

async function persistSchedule(scheduleVersionId:string,schedule:ExportSchedule){
  await transaction(async(client)=>{
    await client.query("DELETE FROM schedule_session WHERE schedule_version_id=$1",[scheduleVersionId]);
    for(const p of schedule.sessions)await client.query(`INSERT INTO schedule_session(schedule_version_id,session_id,day,start_period,room_id) VALUES($1,$2,$3,$4,$5)`,[scheduleVersionId,p.session_id,p.day,p.start_period,p.room_id]);
    await client.query("DELETE FROM booking_decision WHERE schedule_version_id=$1",[scheduleVersionId]);
    for(const b of schedule.fest_week.bookings)await client.query(`INSERT INTO booking_decision(id,schedule_version_id,request_id,status,day,start_period,end_period,room_id,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[uuidv7(),scheduleVersionId,b.request_id,b.status,b.day??null,b.start_period??null,b.end_period??null,b.room_id??null,b.reason]);
    await client.query(`UPDATE schedule_version SET objective=$2,updated_at=now() WHERE id=$1`,[scheduleVersionId,{export:schedule}]);
  });
}

async function exportFor(scheduleVersionId:string){
  const found=await pool.query<{objective:{export?:ExportSchedule}}>("SELECT objective FROM schedule_version WHERE id=$1",[scheduleVersionId]);
  const stored=found.rows[0]?.objective?.export;
  if(stored)return stored;
  const context=await scheduleContext(scheduleVersionId);
  const sessions=await pool.query<Placement>("SELECT session_id,day,start_period,room_id FROM schedule_session WHERE schedule_version_id=$1",[scheduleVersionId]);
  return {team:"TechZephyr",dataset_id:context.payload.dataset_id,sessions:sessions.rows,fest_week:{bookings:[],session_overrides:[]},exams:[]};
}

async function runValidator(scheduleVersionId: string): Promise<Record<string,unknown>> {
  const context=await scheduleContext(scheduleVersionId),schedule=await exportFor(scheduleVersionId);
  const tempDir=resolve(process.cwd(),".tmp",`validation-${uuidv7()}`);await mkdir(tempDir,{recursive:true});
  const dataPath=join(tempDir,"data.json"),schedulePath=join(tempDir,"schedule.json"),reportPath=join(tempDir,"report.json"),disruptionPath=join(tempDir,"disruption.json"),baselinePath=join(tempDir,"baseline.json");
  try{
    await writeFile(dataPath,JSON.stringify(context.payload));await writeFile(schedulePath,JSON.stringify(schedule));
    const args=[config.VALIDATOR_PATH,"--data",dataPath,"--schedule",schedulePath,"--json",reportPath,"--quiet"];
    if(context.disruption&&context.baseline_schedule_id){await writeFile(disruptionPath,JSON.stringify(context.disruption));await writeFile(baselinePath,JSON.stringify(await exportFor(context.baseline_schedule_id)));args.push("--disruption",disruptionPath,"--baseline",baselinePath);}
    await new Promise<void>((done,reject)=>{const child=spawn(config.PYTHON_BIN,args);let stderr="";child.stderr.on("data",(part)=>{stderr+=part.toString();});child.on("error",reject);child.on("exit",(code)=>code===0?done():reject(new Error(stderr||`validator exited ${code}`)));});
    return JSON.parse(await readFile(reportPath,"utf8")) as Record<string,unknown>;
  }finally{await rm(tempDir,{recursive:true,force:true});}
}

async function solve(scheduleVersionId:string){
  const context=await scheduleContext(scheduleVersionId);
  const schedule=buildSchedule(context.payload,{baseline:context.baseline,disruption:context.disruption??undefined});
  schedule.team=config.TEAM_NAME;
  await persistSchedule(scheduleVersionId,schedule);
  const validation=await runValidator(scheduleVersionId);const hard=Number(validation.hard_violation_count??1);
  await pool.query(`UPDATE schedule_version SET validation_report=$2,status=$3,updated_at=now() WHERE id=$1`,[scheduleVersionId,validation,hard===0?"pending_admin_approval":"failed"]);
  return {scheduleVersionId,status:hard===0?"pending_admin_approval":"failed",validation,moved:(validation.stability as {sessions_moved?:number}|undefined)?.sessions_moved??0};
}

async function processJob(job:JobEnvelope):Promise<unknown>{
  const scheduleVersionId=job.payload.scheduleVersionId;if(typeof scheduleVersionId!=="string")throw new Error("Job payload requires scheduleVersionId");
  if(job.type==="GENERATE_SCHEDULE"||job.type==="REPAIR_SCHEDULE")return solve(scheduleVersionId);
  if(job.type==="DECIDE_BOOKINGS"){
    const context=await scheduleContext(scheduleVersionId),schedule=await exportFor(scheduleVersionId);schedule.fest_week={bookings:decideBookings(context.payload,schedule.sessions),session_overrides:[]};await persistSchedule(scheduleVersionId,schedule);return {scheduleVersionId,decisions:schedule.fest_week.bookings.length};
  }
  return runValidator(scheduleVersionId);
}

async function main(){const channel=await getChannel();await channel.prefetch(1);await channel.consume(QUEUE_NAME,async(message)=>{if(!message)return;let job:JobEnvelope|undefined;try{job=JSON.parse(message.content.toString()) as JobEnvelope;await pool.query("UPDATE job SET status='running',started_at=now(),attempt_count=attempt_count+1 WHERE id=$1",[job.id]);const result=await processJob(job);await pool.query("UPDATE job SET status='succeeded',result=$2,completed_at=now() WHERE id=$1",[job.id,result]);channel.ack(message);await invalidateCache(`job:${job.id}`,`schedule:${String(job.payload.scheduleVersionId??"")}`);}catch(error){const detail=error instanceof Error?error.message:"Unknown worker error";if(job)await pool.query("UPDATE job SET status='failed',error=$2,completed_at=now() WHERE id=$1",[job.id,detail]);if(job)await invalidateCache(`job:${job.id}`);logger.error("worker.job_failed",{jobId:job?.id,error:detail});channel.ack(message);}},{noAck:false});logger.info("worker.consuming");}
for(const signal of ["SIGINT","SIGTERM"] as const)process.on(signal,()=>void closeQueue().finally(()=>process.exit(0)));
main().catch((error)=>{console.error(error);process.exitCode=1;});
