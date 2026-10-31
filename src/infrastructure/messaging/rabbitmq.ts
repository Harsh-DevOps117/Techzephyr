import amqp, { type Channel, type ChannelModel } from "amqplib";
import { config } from "../config/env.js";
import type { JobEnvelope } from "../../domain/shared/types.js";

export const QUEUE_NAME = "techzephyr.jobs";
let connection: ChannelModel | undefined;
let channel: Channel | undefined;

export async function getChannel(): Promise<Channel> {
  if (channel) return channel;
  connection = await amqp.connect(config.RABBITMQ_URL);
  channel = await connection.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true, arguments: { "x-max-priority": 4 } });
  return channel;
}

export async function publish(job: JobEnvelope, priority: number): Promise<void> {
  const queue = await getChannel();
  const accepted = queue.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(job)), {
    persistent: true,
    messageId: job.id,
    correlationId: job.correlationId,
    priority
  });
  if (!accepted) throw new Error("RabbitMQ write buffer is full; publication will be retried from the outbox");
}

export async function closeQueue(): Promise<void> {
  await channel?.close();
  await connection?.close();
  channel = undefined;
  connection = undefined;
}
