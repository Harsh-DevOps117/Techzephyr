import OpenAI from "openai";
import { z } from "zod";
import { config } from "../../infrastructure/config/env.js";
import { AiUnavailableError } from "./booking-request-parser.js";

const changeSchema=z.discriminatedUnion("type",[
  z.object({type:z.literal("faculty_unavailable"),faculty_id:z.string().min(1),days:z.array(z.enum(["MON","TUE","WED","THU","FRI"])).min(1),periods:z.array(z.number().int().min(1).max(9)).min(1),reason:z.string().min(1)}),
  z.object({type:z.literal("room_unavailable"),room_id:z.string().min(1),days:z.array(z.enum(["MON","TUE","WED","THU","FRI"])).min(1),periods:z.array(z.number().int().min(1).max(9)).min(1),reason:z.string().min(1)}),
  z.object({type:z.literal("remove_session"),session_id:z.string().min(1),reason:z.string().min(1)}),
]);
const responseSchema=z.object({changes:z.array(changeSchema).max(10),assumptions:z.array(z.string()).max(10),follow_up:z.string().nullable()});
export type ScheduleChangeDraft=z.infer<typeof responseSchema>;

const prompt=`Convert a CIT faculty schedule-change request into a disruption draft. Return ONLY JSON in this shape: {"changes":[],"assumptions":string[],"follow_up":string|null}. Each change is exactly one of {"type":"faculty_unavailable","faculty_id":string,"days":["MON"],"periods":[1],"reason":string}, {"type":"room_unavailable","room_id":string,"days":["MON"],"periods":[1],"reason":string}, or {"type":"remove_session","session_id":string,"reason":string}. Days are MON-FRI and periods are integers P1-P9. Never invent an identifier: when one is missing, return changes:[] and a precise follow_up. This is only an editable draft; never claim the resulting timetable is valid or approved.`;

export async function parseScheduleChange(text:string):Promise<ScheduleChangeDraft>{
  if(!config.GROQ_API_KEY)throw new AiUnavailableError();
  try{
    const client=new OpenAI({apiKey:config.GROQ_API_KEY,baseURL:"https://api.groq.com/openai/v1"});
    const completion=await client.chat.completions.create({model:config.GROQ_MODEL,temperature:0,response_format:{type:"json_object"},messages:[{role:"system",content:prompt},{role:"user",content:text}]});
    const raw=completion.choices[0]?.message.content;if(!raw)throw new Error("AI provider returned no schedule-change draft");
    return responseSchema.parse(JSON.parse(raw));
  }catch{throw new AiUnavailableError("AI change parsing failed. Upload the manual disruption file instead.");}
}
